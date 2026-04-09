from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import func, select
from typing import List, Optional, Dict, Any, Set, Tuple
import hashlib
import json
import time
import re
from app.models import Universe, Character, Location, Chapter, Note, TimelineEvent, OutlineItem, Technology, Artifact
from app.schemas import ChatMessage, ChatTime
from app.services import knowledge
from app.services import timeline as timeline_service
from app.services import character_context as character_context_service
from app.services.time_service import time_service

class ContextManager:
    """
    Сервис для управления контекстом чата с оптимизацией и кэшированием.
    Обеспечивает стабильность системного промпта для эффективного использования Prefix Caching в LLM.
    """

    def __init__(self):
        # Кэш собранных контекстов: cache_key -> (timestamp, context_string)
        self._context_cache: Dict[str, Tuple[float, str]] = {}
        # Кэш версий вселенных: universe_id -> (timestamp, version_hash)
        self._version_cache: Dict[int, Tuple[float, str]] = {}
        # Кэш списков имён для обнаружения упоминаний: universe_id -> (timestamp, [(id, name), ...])
        self._names_cache: Dict[int, Tuple[float, Dict[str, List[Tuple[int, str]]]]] = {}

        # Лимиты для стабильности и производительности (в символах, ~4 символа на токен)
        self.BUDGET_BASE = 4000
        self.BUDGET_MENTIONS = 2000
        self.BUDGET_CREATOR_CHARS = 8000  # для Помощника Создателя: список всех персонажей
        
        # TTL для кэшей (в секундах)
        self.CACHE_TTL = 300  # 5 минут для контекста
        self.NAMES_CACHE_TTL = 60  # 1 минута для списков имён

    async def get_universe_state_hash(self, db: AsyncSession, universe_id: int, master_db: AsyncSession = None) -> str:
        """
        Генерирует хэш текущего состояния вселенной на основе дат обновления сущностей.
        """
        now = time.time()
        if universe_id in self._version_cache:
            ts, h = self._version_cache[universe_id]
            if now - ts < 1:
                return h

        updates = []
        # Universe находится в master database, а не в universe database
        if not master_db:
            raise ValueError("master_db is required for get_universe_state_hash")
        u_res = await master_db.execute(select(Universe.updated_at).filter(Universe.id == universe_id))
        u_val = u_res.scalar()
        updates.append(u_val.isoformat() if u_val else "none")

        for model in [Character, Location, Chapter, Note, TimelineEvent, Technology, Artifact]:
            col = getattr(model, "universe_id", None) or getattr(model, "universe_id", None)
            if col is not None:
                res = await db.execute(
                    select(func.count(model.id), func.max(model.updated_at)).filter(col == universe_id)
                )
                count, max_upd = res.first()
                updates.append(f"{model.__name__}:{count}:{max_upd.isoformat() if max_upd else ''}")

        state_str = "|".join(updates)
        state_hash = hashlib.md5(state_str.encode()).hexdigest()
        self._version_cache[universe_id] = (now, state_hash)
        return state_hash

    async def build_smart_context_optimized(
        self,
        db: AsyncSession,
        universe_id: int,
        messages: List[ChatMessage],
        character_id: Optional[int] = None,
        user_query: str = "",
        user_role: Optional[str] = None,
        use_character_knowledge: bool = True,
        chat_time: Optional[ChatTime] = None,
        master_db: Optional[AsyncSession] = None,
    ) -> str:
        """
        Построение умного контекста. Если задан chat_time — контекст и время диалога привязаны к этому моменту.
        """
        state_hash = await self.get_universe_state_hash(db, universe_id, master_db=master_db)

        recent_text = " ".join([msg.content for msg in messages[-2:]]) + " " + user_query
        mentioned_ids = await self._detect_mentions(db, universe_id, recent_text)
        mention_hash = hashlib.md5(",".join(sorted([f"{t}:{i}" for t, i in mentioned_ids])).encode()).hexdigest()

        h = (chat_time.universe_hour if chat_time else None) or 0
        m = (chat_time.universe_minute if chat_time else None) or 0
        ct_key = f"{chat_time.universe_year}-{chat_time.universe_day}-{h}-{m}" if chat_time else "now"
        # Лимиты из настроек (с fallback на дефолты)
        draft_budget = 3000
        include_all_drafts = False
        budget_base = self.BUDGET_BASE
        budget_mentions = self.BUDGET_MENTIONS
        budget_creator_chars = self.BUDGET_CREATOR_CHARS
        budget_ta = 4000
        if master_db:
            try:
                from app.repositories.settings import get_system_settings
                system_settings = await get_system_settings(master_db)
                draft_budget = max(0, getattr(system_settings, "draft_context_budget", 3000) or 3000)
                include_all_drafts = bool(getattr(system_settings, "include_all_drafts_in_context", False))
                budget_base = max(0, getattr(system_settings, "context_base_budget", None) or self.BUDGET_BASE)
                budget_mentions = max(0, getattr(system_settings, "context_mentions_budget", None) or self.BUDGET_MENTIONS)
                budget_creator_chars = max(0, getattr(system_settings, "context_creator_chars", None) or self.BUDGET_CREATOR_CHARS)
                budget_ta = max(0, getattr(system_settings, "context_technologies_budget", None) or 4000)
            except Exception:
                pass
        cache_key = f"{universe_id}:{character_id}:{user_role}:{state_hash}:{mention_hash}:{use_character_knowledge}:{ct_key}:{draft_budget}:{budget_base}:{budget_mentions}:{budget_creator_chars}:{budget_ta}"

        # Проверяем кэш с учётом TTL
        now = time.time()
        if cache_key in self._context_cache:
            cached_time, cached_context = self._context_cache[cache_key]
            if now - cached_time < self.CACHE_TTL:
                return cached_context
            else:
                del self._context_cache[cache_key]

        context_parts = []

        # Universe находится в master database, а не в universe database
        if not master_db:
            raise ValueError("master_db is required for build_smart_context_optimized")
        book = await knowledge.get_universe(universe_id, master_db)
        if book:
            context_parts.append(f"=== КНИГА: {book.title} ===")
            if book.description: context_parts.append(f"Описание: {book.description[:1000]}")

        notes = await knowledge.get_notes(db, universe_id)
        avoid_notes = [n for n in notes if (n.note_type or "").strip().lower() == "avoid" and getattr(n, "enabled", True)]
        if avoid_notes:
            context_parts.append("\n=== ПРАВИЛА (ЧЕГО ИЗБЕГАТЬ) ===")
            for note in avoid_notes:
                context_parts.append(f"- {note.title}: {note.content}")

        # Черновики в базовый контекст не подставляем — только релевантные по запросу
        # попадают через search_context и RAG. Так укладываемся в бюджет и убираем повторы.
        # Опционально: если в настройках включён "все черновики", можно вернуть старый режим.
        draft_notes = [n for n in notes if (n.note_type or "").strip().lower() == "draft" and getattr(n, "enabled", True)]
        if include_all_drafts and draft_notes:
            context_parts.append("\n=== ЧЕРНОВИКИ (идеи автора для обсуждения/критики) ===")
            budget_drafts = draft_budget
            for note in draft_notes:
                head = f"[Черновик: {note.title}]"
                content = (note.content or "").strip()
                if len(content) > budget_drafts:
                    content = content[:budget_drafts] + "\n...[обрезано]"
                if content:
                    context_parts.append(f"{head}\n{content}")
                else:
                    context_parts.append(f"{head} (пусто)")
                budget_drafts -= len(head) + len(content) + 2
                if budget_drafts <= 0:
                    context_parts.append("...(остальные черновики скрыты)")
                    break

        # Помощник Создателя (без выбранного персонажа) — даём список персонажей, технологий и артефактов
        if character_id is None:
            chars = await knowledge.get_characters(db, universe_id)
            enabled_chars = [c for c in chars if getattr(c, "enabled", True)]
            if enabled_chars:
                context_parts.append("\n=== ВСЕ ПЕРСОНАЖИ ВСЕЛЕННОЙ (со страницы персонажей) ===")
                section_len = 0
                for c in enabled_chars:
                    if section_len >= budget_creator_chars:
                        context_parts.append("... (и другие персонажи; полный список на странице персонажей)")
                        break
                    entry = f"- {c.name}"
                    if getattr(c, "role", None):
                        entry += f" ({c.role})"
                    if getattr(c, "profession", None):
                        entry += f", профессия: {c.profession}"
                    if getattr(c, "description", None):
                        desc = (c.description or "")[:300]
                        if desc:
                            entry += f" — {desc}"
                    context_parts.append(entry)
                    section_len += len(entry)
            # Технологии и артефакты вселенной (чтобы ИИ знал о HexRuner и др.)
            try:
                from app.repositories import technology as tech_repo
                techs = await tech_repo.get_technologies(db, universe_id)
                artifacts = await tech_repo.get_artifacts(db, universe_id)
                if techs or artifacts:
                    context_parts.append("\n=== ТЕХНОЛОГИИ И АРТЕФАКТЫ ВСЕЛЕННОЙ ===")
                    budget_ta_used = budget_ta
                    for t in techs:
                        entry = f"- Технология: {t.name}"
                        if getattr(t, "tech_level", None):
                            entry += f" (уровень: {t.tech_level})"
                        desc = (getattr(t, "description", None) or "")[:200]
                        if desc:
                            entry += f" — {desc}"
                        principles = (getattr(t, "principles", None) or "").strip()
                        if principles:
                            entry += f" Принципы: {principles[:150]}{'…' if len(principles) > 150 else ''}"
                        context_parts.append(entry)
                        budget_ta_used -= len(entry)
                        if budget_ta_used <= 0:
                            context_parts.append("... (остальные технологии и артефакты на странице Технологии и Артефакты)")
                            break
                    if budget_ta_used > 0:
                        for a in artifacts:
                            entry = f"- Артефакт: {a.name}"
                            if getattr(a, "artifact_type", None):
                                entry += f" ({a.artifact_type})"
                            desc = (getattr(a, "description", None) or "")[:200]
                            if desc:
                                entry += f" — {desc}"
                            context_parts.append(entry)
                            budget_ta_used -= len(entry)
                            if budget_ta_used <= 0:
                                context_parts.append("... (остальные на странице Технологии и Артефакты)")
                                break
            except Exception:
                pass

        before_year = chat_time.universe_year if chat_time else None
        before_day = chat_time.universe_day if chat_time else None
        if character_id and use_character_knowledge:
            if not master_db:
                raise ValueError("master_db is required for build_smart_context_optimized when use_character_knowledge=True")
            base_character_info = await character_context_service.get_character_accessible_context(
                db, universe_id, character_id, user_query,
                before_universe_year=before_year,
                before_universe_day=before_day,
                master_db=master_db,
            )
            if base_character_info:
                if len(base_character_info) > budget_base:
                    base_character_info = base_character_info[:budget_base] + "\n...[часть знаний скрыта для краткости]"
                context_parts.append(base_character_info)

        mentions_text = await self._build_mentions_section(db, universe_id, mentioned_ids, exclude_id=character_id, budget_mentions=budget_mentions)
        if mentions_text:
            context_parts.append(mentions_text)

        if book:
            if chat_time:
                epoch = getattr(book, "universe_epoch_name", None) or "н.э."
                h = chat_time.universe_hour or 0
                m = chat_time.universe_minute or 0
                time_display = f"{h:02d}:{m:02d}, {chat_time.universe_day} день {chat_time.universe_year} года {epoch}"
                context_parts.append(f"\nВРЕМЯ ДИАЛОГА ВО ВСЕЛЕННОЙ (персонаж не знает событий после этого момента): {time_display}")
            else:
                u_time = time_service.get_current_universe_time(book)
                context_parts.append(f"\nТЕКУЩЕЕ ВРЕМЯ ВО ВСЕЛЕННОЙ: {u_time['display']}")

        context = "\n".join(context_parts)
        
        # Очищаем устаревшие записи и ограничиваем размер кэша
        if len(self._context_cache) > 200:
            # Удаляем самые старые записи
            sorted_items = sorted(self._context_cache.items(), key=lambda x: x[1][0])
            for key, _ in sorted_items[:50]:  # Удаляем 50 самых старых
                del self._context_cache[key]
        
        self._context_cache[cache_key] = (now, context)
        return context

    async def _detect_mentions(self, db: AsyncSession, universe_id: int, text: str) -> Set[Tuple[str, int]]:
        text_lower = text.lower()
        mentions = set()
        now = time.time()

        # Используем кэш списков имён
        if universe_id in self._names_cache:
            cached_time, cached_names = self._names_cache[universe_id]
            if now - cached_time < self.NAMES_CACHE_TTL:
                # Используем кэшированные имена
                for cid, name in cached_names.get("characters", []):
                    if name.lower() in text_lower:
                        mentions.add(("char", cid))
                for lid, name in cached_names.get("locations", []):
                    if name.lower() in text_lower:
                        mentions.add(("loc", lid))
                return mentions

        # Загружаем и кэшируем имена
        chars_res = await db.execute(select(Character.id, Character.name).filter(Character.universe_id == universe_id, Character.enabled == True))
        char_names = [(cid, name) for cid, name in chars_res.all()]
        for cid, name in char_names:
            if name.lower() in text_lower:
                mentions.add(("char", cid))

        locs_res = await db.execute(select(Location.id, Location.name).filter(Location.universe_id == universe_id, Location.enabled == True))
        loc_names = [(lid, name) for lid, name in locs_res.all()]
        for lid, name in loc_names:
            if name.lower() in text_lower:
                mentions.add(("loc", lid))

        # Сохраняем в кэш
        self._names_cache[universe_id] = (now, {
            "characters": char_names,
            "locations": loc_names
        })

        return mentions

    async def _build_mentions_section(self, db: AsyncSession, universe_id: int, mentions: Set[Tuple[str, int]], exclude_id: Optional[int] = None, budget_mentions: int = None) -> str:
        if not mentions: return ""
        if budget_mentions is None:
            budget_mentions = self.BUDGET_MENTIONS
        parts = ["\n=== ТЕКУЩИЙ КОНТЕКСТ (УПОМИНАНИЯ) ==="]
        found = False
        budget = budget_mentions

        for m_type, m_id in mentions:
            if budget <= 0: break
            if m_type == "char":
                if m_id == exclude_id: continue
                char = await knowledge.get_character(db, m_id)
                if char:
                    entry = f"- Персонаж: {char.name} ({char.role or 'второстепенный'})\n  {char.description[:400]}"
                    parts.append(entry)
                    budget -= len(entry)
                    found = True
            elif m_type == "loc":
                loc = await knowledge.get_location(db, m_id)
                if loc:
                    entry = f"- Локация: {loc.name}\n  {loc.description[:400]}"
                    parts.append(entry)
                    budget -= len(entry)
                    found = True

        return "\n".join(parts) if found else ""

    async def build_context(self, db: AsyncSession, universe_id: int, master_db: Optional[AsyncSession] = None) -> str:
        """Полный контекст для UI"""
        # Universe находится в master database, а не в universe database
        if not master_db:
            raise ValueError("master_db is required for build_context")
        book = await knowledge.get_universe(universe_id, master_db)
        if not book: return ""
        parts = [f"=== КНИГА: {book.title} ==="]
        if book.description: 
            parts.append(f"Описание: {book.description}")
        if book.genre:
            parts.append(f"Жанр: {book.genre}")
        if book.direction:
            parts.append(f"\n=== НАПРАВЛЕНИЕ / ПРЕМИСА ВСЕЛЕННОЙ ===")
            parts.append(book.direction)
        if book.style_notes:
            parts.append(f"\n=== СТИЛИСТИКА И ТОН ===")
            parts.append(book.style_notes)
        if book.universe_type:
            parts.append(f"Тип вселенной: {book.universe_type}")
        chars = await knowledge.get_characters(db, universe_id)
        if chars:
            parts.append("\n=== СУЩЕСТВУЮЩИЕ ПЕРСОНАЖИ ===")
            for c in chars:
                if getattr(c, "enabled", True):
                    char_info = f"- {c.name}"
                    if c.role:
                        char_info += f" ({c.role})"
                    if c.profession:
                        char_info += f", профессия: {c.profession}"
                    if c.description:
                        char_info += f" — {c.description[:100]}"
                    parts.append(char_info)
        return "\n".join(parts)

context_manager = ContextManager()
