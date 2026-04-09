"""
Сервис для построения промптов с учетом настроек пользователя.
"""
import json
from typing import List, Optional, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from app.schemas import ChatMessage, ChatTime
from app.models import Character
from app.services import knowledge
from app.services.context_manager import context_manager
from app.services.rag import rag_service
from app.services.search import SearchService
from app.services.time_service import time_service


class PromptBuilder:
    """Построитель промптов с настраиваемой структурой"""
    
    DEFAULT_SETTINGS = {
        "language": "ru",
        "language_instruction": "⚠️ КРИТИЧЕСКИ ВАЖНО: ВСЕГДА отвечай ТОЛЬКО на РУССКОМ языке. Даже в атмосферных, «вселенских» или стилизованных ответах — только русский, никогда не переключайся на английский.",
        "blocks": {
            "character_identity": {
                "enabled": True,
                "order": 1,
                "include_name": True,
                "include_format_instructions": True,
                "include_canonical_dates": True,
                "include_age_speech": True,
                "character_attributes": [
                    "role", "description", "gender", "profession", "traits", 
                    "appearance", "backstory", "goals", "fears", "conflicts", 
                    "character_values", "speech_pattern", "mannerisms", "habits"
                ]
            },
            "universe_context": {
                "enabled": True,
                "order": 2,
                "header": "=== ВАШ МИР И ЗНАНИЯ ===",
                "use_smart_context": True,
                "max_length": None
            },
            "search_context": {
                "enabled": True,
                "order": 3,
                "header": "=== РЕЗУЛЬТАТЫ ПОИСКА ПО ЗАПРОСУ ===",
                "max_results_per_category": 5,
                "max_note_content_chars": 4000,
                "max_notes_with_content": 5
            },
            "rag_context": {
                "enabled": True,
                "order": 4,
                "header": "=== НАЙДЕННЫЕ ФАКТЫ (RAG) ==="
            },
            "speaker_info": {
                "enabled": True,
                "order": 5,
                "header": "=== ТЕКУЩИЙ ДИАЛОГ ==="
            }
        },
        "formatting": {
            "use_sections": True,
            "section_separator": "\n\n",
            "line_separator": "\n"
        },
        "assistant_prompt": {
            "enabled": True,
            "role": (
                "Ты — Помощник Создателя: экспертный помощник писателя по вселенной книги.\n\n"
                "ВАЖНО: Ты НЕ отыгрываешь роль. Ты не персонаж вселенной и не говоришь от лица мира или героев. "
                "Ты помогаешь создавать вселенную и общаешься только с автором (создателем книги) — ни с кем другим. "
                "Отвечай как помощник-редактор: по делу, без «вхождения в образ».\n\n"
                "Твои обязанности:\n"
                "- ДАВАТЬ СОВЕТЫ ПО СЮЖЕТУ: предлагать развитие линий, конфликты, повороты, связность с уже описанным.\n"
                "- ИСКАТЬ НЕТОЧНОСТИ: замечать противоречия в фактах, датах, характерах персонажей и мире; вежливо указывать на них и предлагать варианты исправления.\n"
                "- ПОМОГАТЬ ОБОГАТИТЬ ВСЕЛЕННУЮ: подсказывать новые детали (события, локации, связи персонажей, эпохи), идеи для глав и заметок, способы углубить мир и персонажей.\n"
                "Ты знаешь всё о книге и всех персонажах; используй контекст ниже для точных и полезных ответов."
            ),
            "language_note": True
        }
    }
    
    def __init__(self, settings: Optional[Dict[str, Any]] = None):
        """Инициализация с настройками"""
        if settings is None:
            settings = {}
        self.settings = {**self.DEFAULT_SETTINGS, **settings}
        # Объединяем настройки блоков
        if "blocks" in settings:
            for block_name, block_settings in settings["blocks"].items():
                if block_name in self.settings["blocks"]:
                    self.settings["blocks"][block_name] = {
                        **self.DEFAULT_SETTINGS["blocks"][block_name],
                        **block_settings
                    }
        # Всегда добавляем недостающие блоки из дефолтов (новые блоки, например search_context)
        for block_name, default_config in self.DEFAULT_SETTINGS["blocks"].items():
            if block_name not in self.settings["blocks"]:
                self.settings["blocks"][block_name] = dict(default_config)
    
    async def build_prompt(
        self,
        db: AsyncSession,
        universe_id: int,
        messages: List[ChatMessage],
        character: Optional[Character] = None,
        user_query: str = "",
        user_role: Optional[str] = None,
        chat_time: Optional[ChatTime] = None,
        no_context: bool = False,
        master_db: Optional[AsyncSession] = None,
        universe_obj: Optional[Any] = None,
        use_character_knowledge: bool = True,
        enable_rag: bool = True,
        include_note_ids: Optional[List[int]] = None,
        include_chapter_ids: Optional[List[int]] = None,
        other_chats_history: Optional[List[Dict[str, Any]]] = None,
    ) -> str:
        """
        Построить системный промпт с учетом настроек.
        
        Args:
            db: Сессия базы данных вселенной
            universe_id: ID вселенной
            messages: История сообщений
            character: Персонаж (если диалог с персонажем)
            user_query: Запрос пользователя
            user_role: Роль пользователя (author, character:X)
            chat_time: Время диалога во вселенной
            no_context: Режим "только сообщение"
            master_db: Сессия главной базы данных
            
        Returns:
            Сформированный системный промпт
        """
        if no_context:
            return self.settings["language_instruction"]
        
        blocks = []
        
        # Получаем настройки блоков, отсортированные по order
        block_configs = sorted(
            [(name, config) for name, config in self.settings["blocks"].items() if config.get("enabled", True)],
            key=lambda x: x[1].get("order", 999)
        )
        
        for block_name, block_config in block_configs:
            block_content = None
            
            if block_name == "character_identity" and character:
                block_content = await self._build_character_block(
                    character, chat_time, universe_id, block_config, universe_obj
                )
            elif block_name == "universe_context":
                block_content = await self._build_universe_context_block(
                    db, universe_id, messages, character, user_query, 
                    user_role, chat_time, master_db, block_config, use_character_knowledge
                )
            elif block_name == "search_context":
                block_content = await self._build_search_context_block(
                    db, universe_id, user_query, block_config
                )
            elif block_name == "rag_context":
                block_content = await self._build_rag_block(
                    db, universe_id, user_query, character, block_config, chat_time, enable_rag
                )
            elif block_name == "speaker_info":
                block_content = await self._build_speaker_info_block(
                    db, user_role, block_config, character
                )
            
            if block_content:
                blocks.append(block_content)

        # Явно включённые в контекст заметки и главы (пользователь выбрал их вручную)
        if include_note_ids or include_chapter_ids:
            included_block = await self._build_included_context_block(
                db, universe_id, include_note_ids or [], include_chapter_ids or []
            )
            if included_block:
                # Вставляем сразу после контекста вселенной (если есть), иначе в начало
                idx = next((i for i, b in enumerate(blocks) if "=== ВАШ МИР И ЗНАНИЯ ===" in b or "=== КНИГА:" in b), 0)
                blocks.insert(idx + 1, included_block)

        # Диалоги персонажей (автор↔персонаж и персонаж↔персонаж) для контекста помощника
        if other_chats_history:
            other_block = self._build_other_chats_block(other_chats_history)
            if other_block:
                blocks.append(other_block)

        # Если это помощник (без персонажа) и включен промпт помощника
        if not character and self.settings["assistant_prompt"]["enabled"]:
            assistant_parts = []
            if self.settings["assistant_prompt"]["role"]:
                assistant_parts.append(self.settings["assistant_prompt"]["role"])
            assistant_parts.append(
                "В контексте ниже тебе передан полный список персонажей вселенной (как на странице персонажей). Используй его для точных ответов о персонажах, советах по сюжету и поиска неточностей.\n"
                "КРИТИЧНО: Если есть раздел «ТЕКСТ НАЙДЕННЫХ ЧЕРНОВИКОВ/ЗАМЕТОК» — твой ответ о запрошенном человеке/понятии должен опираться ТОЛЬКО на этот текст. Не выдумывай фактов, имён и сюжетов, которых там нет. Если в черновике чего-то не сказано — так и ответь.\n"
                "Если такого раздела нет, но есть «РЕЗУЛЬТАТЫ ПОИСКА ПО ЗАПРОСУ» — используй найденные фрагменты; для вопросов «кто такой X» приоритет у черновиков и заметок, а не у списка карточек персонажей."
            )
            if other_chats_history:
                assistant_parts.append(
                    "Если в контексте есть раздел «ДИАЛОГИ ПЕРСОНАЖЕЙ (ДЛЯ ОБСУЖДЕНИЯ)» — автор мог общаться с персонажами или от имени одного персонажа с другим. Используй эти диалоги, чтобы обсуждать с автором сюжет, реплики и развитие сцен."
                )
            if self.settings["assistant_prompt"]["language_note"]:
                assistant_parts.append(self.settings["language_instruction"])
            
            if blocks:
                # Добавляем контекст вселенной
                universe_block = next((b for b in blocks if "=== ВАШ МИР И ЗНАНИЯ ===" in b or "=== КОНТЕКСТ КНИГИ ===" in b), None)
                if universe_block:
                    blocks.remove(universe_block)
                    assistant_parts.append(universe_block)
            
            return self.settings["formatting"]["line_separator"].join(assistant_parts) + (
                self.settings["formatting"]["section_separator"] + 
                self.settings["formatting"]["section_separator"].join(blocks) 
                if blocks else ""
            )
        
        # Объединяем блоки
        separator = self.settings["formatting"]["section_separator"]
        return separator.join(blocks)
    
    async def _build_character_block(
        self,
        character: Character,
        chat_time: Optional[ChatTime],
        universe_id: int,
        config: Dict[str, Any],
        universe_obj: Optional[Any] = None
    ) -> Optional[str]:
        """Построить блок идентичности персонажа"""
        parts = []
        
        if config.get("include_name", True):
            parts.append(f"ТЫ — {character.name}")
        
        if config.get("include_format_instructions", True):
            parts.append(self.settings["language_instruction"])
            parts.append("")
            parts.append("ФОРМАТ ОБЩЕНИЯ:")
            parts.append("Ты говоришь ОТ СВОЕГО ИМЕНИ: только прямая речь персонажа, с учётом твоего возраста, характера, мотивации и того, что ты ЗНАЕШЬ на данный момент времени (ничего из того, чего ты ещё не узнал в сюжете).")
            parts.append("")
            parts.append("ЗАПРЕЩЕНО (никогда не делай этого в ответах):")
            parts.append("- Писать «отрывок из романа», «novel excerpt», «The following is...», любой мета-текст о произведении или сюжете")
            parts.append("- Вставлять код (Python, def, print, и т.д.), блоки кода или технические примеры")
            parts.append("- Описывать себя или события в третьем лице; анализировать «текст как художественное произведение»")
            parts.append("- Отвечать как рассказчик или автор — ты только сам персонаж в чате")
            parts.append("")
            parts.append("ОБЯЗАТЕЛЬНО:")
            parts.append("- Ты общаешься в ЧАТЕ через терминал — пиши только то, что говоришь собеседнику (от первого лица)")
            parts.append("- НЕ пиши текст вселенной, НЕ описывай свои действия в третьем лице")
            parts.append("- Просто ОБЩАЙСЯ напрямую, естественно, как живой человек в диалоге")
            parts.append("- Строго запрещено писать в ответе таймштампы в формате [ЧЧ:ММ, N день Y года Название эпохи] — ни одного раза. Время к сообщению подставляет интерфейс сам. Пиши только реплику персонажа (и при необходимости ремарки в скобках).")
            parts.append("")
            parts.append("[EN] You are in-character in a chat. Reply ONLY with your character's direct speech (first person). Never output novel excerpts, code, or meta-descriptions of the story.")
            parts.append("")
        
        # Канонические даты и возраст
        if config.get("include_canonical_dates", True):
            dial_year = dial_day = None
            if chat_time:
                dial_year, dial_day = chat_time.universe_year, chat_time.universe_day
            elif universe_obj:
                u_time = time_service.get_current_universe_time(universe_obj)
                dial_year = u_time.get("year")
                dial_day = u_time.get("day")
            
            by = getattr(character, "birth_universe_year", None)
            bd = getattr(character, "birth_universe_day", None)
            dy = getattr(character, "death_universe_year", None)
            dd = getattr(character, "death_universe_day", None)
            
            if by is not None and bd is not None and dial_year is not None and dial_day is not None:
                age = knowledge.character_age_at_universe_time(character, dial_year, dial_day)
                if age is not None:
                    parts.append("=== КАНОНИЧЕСКИЕ ДАТЫ (НЕ МЕНЯЙ ИХ НИ ПРИ КАКИХ ВОПРОСАХ) ===")
                    parts.append(f"Дата рождения во вселенной: год {by}, день {bd}.")
                    if dy is not None and dd is not None:
                        parts.append(f"Дата смерти во вселенной: год {dy}, день {dd}.")
                    parts.append(f"Момент, в который идёт диалог: год {dial_year}, день {dial_day}.")
                    parts.append(f"На этот момент тебе ровно {age} лет (вычислено из канонической даты рождения).")
                    parts.append("Всегда называй ТОЛЬКО этот возраст и эту дату рождения. Запрещено придумывать другую дату рождения или другой возраст.")
                    parts.append("ВАЖНО: Если в описании, предыстории или чертах персонажа указан другой возраст (например 46) — это устаревшие данные. Игнорируй их. На момент этого диалога тебе ровно указанный выше возраст.")
                    
                    # Речь по возрасту
                    if config.get("include_age_speech", True):
                        speech_dev = (getattr(character, "speech_development", None) or "human").lower()
                        if speech_dev == "ageless":
                            parts.append("РЕЧЬ: тип «не зависит от возраста» (ИИ, робот, существо). Говори полноценно в любом возрасте.")
                        else:
                            parts.append("РЕЧЬ ПО ВОЗРАСТУ (человек) — ОБЯЗАТЕЛЬНО ОТЫГРЫВАЙ:")
                            parts.append("Твои сообщения в чате — это твоя речь. Пиши ТОЛЬКО то, что реально может сказать человек твоего возраста. Не описывай «мне год», а ГОВОРИ как годовалый.")
                            parts.append("- До 1.5 лет: твой ответ = только лепет и звуки (агу, ба-ба, ма, няня). Никаких предложений, никаких развёрнутых фраз.")
                            parts.append("- 1.5–3 года: только очень короткие фразы (1–3 слова), детские слова (няма, дай, мама). Не пиши сложные мысли.")
                            parts.append("- С 3 лет: обычная речь по возрасту.")
                            parts.append(f"Сейчас тебе {age} лет. Значит каждый твой ответ должен быть написан строго в этой форме — как говорит {age}-летний, не как взрослый.")
                    parts.append("")
        
        # Атрибуты персонажа
        attr_mapping = {
            "character_values": "Ценности и принципы",
            "speech_pattern": "Особенности речи",
            "mannerisms": "Манеры и жесты",
            "habits": "Привычки",
            "goals": "Цели",
            "fears": "Страхи",
            "conflicts": "Конфликты"
        }
        
        for attr in config.get("character_attributes", []):
            value = getattr(character, attr, None)
            if value:
                label = attr_mapping.get(attr, attr.capitalize())
                parts.append(f"{label}: {value}")
        
        return self.settings["formatting"]["line_separator"].join(parts) if parts else None
    
    async def _build_universe_context_block(
        self,
        db: AsyncSession,
        universe_id: int,
        messages: List[ChatMessage],
        character: Optional[Character],
        user_query: str,
        user_role: Optional[str],
        chat_time: Optional[ChatTime],
        master_db: Optional[AsyncSession],
        config: Dict[str, Any],
        use_character_knowledge: bool = True
    ) -> Optional[str]:
        """Построить блок контекста вселенной"""
        if config.get("use_smart_context", True):
            context = await context_manager.build_smart_context_optimized(
                db, universe_id, messages, character_id=character.id if character else None,
                user_query=user_query, user_role=user_role, use_character_knowledge=use_character_knowledge,
                chat_time=chat_time, master_db=master_db
            )
        else:
            # Простой контекст (можно расширить)
            context = ""
        
        if not context:
            return None
        
        header = config.get("header", "=== ВАШ МИР И ЗНАНИЯ ===")
        max_length = config.get("max_length")
        
        if max_length and len(context) > max_length:
            context = context[:max_length] + "..."
        
        return f"{header}\n{context}"

    async def _build_included_context_block(
        self,
        db: AsyncSession,
        universe_id: int,
        include_note_ids: List[int],
        include_chapter_ids: List[int],
    ) -> Optional[str]:
        """Блок с текстом заметок и глав, которые пользователь явно включил в контекст."""
        parts = []
        max_note_chars = 12000
        max_chapter_chars = 8000
        for nid in include_note_ids[:20]:
            try:
                note = await knowledge.get_note(db, nid)
                if not note or getattr(note, "universe_id", None) != universe_id:
                    continue
                title = getattr(note, "title", None) or "Без названия"
                note_type = (getattr(note, "note_type", None) or "").strip().lower()
                type_label = "Черновик" if note_type == "draft" else "Заметка"
                raw = (note.content or "").strip()
                take = min(len(raw), max_note_chars)
                content = raw[:take] + ("…" if len(raw) > take else "")
                if content:
                    parts.append(f"[{type_label}: {title}]\n{content}")
            except Exception:
                continue
        for cid in include_chapter_ids[:10]:
            try:
                chapter = await knowledge.get_chapter(db, cid)
                if not chapter or getattr(chapter, "universe_id", None) != universe_id:
                    continue
                if getattr(chapter, "enabled", True) is False:
                    continue  # Скрытые главы не попадают в контекст
                title = getattr(chapter, "title", None) or "Без названия"
                num = getattr(chapter, "chapter_number", None)
                head = f"Глава {num}: {title}" if num is not None else title
                summary = (getattr(chapter, "summary", None) or "").strip()
                content = (getattr(chapter, "content", None) or "").strip()
                text = summary + "\n\n" + content if summary else content
                take = min(len(text), max_chapter_chars)
                text = text[:take] + ("…" if len(text) > take else "")
                if text:
                    parts.append(f"[{head}]\n{text}")
            except Exception:
                continue
        if not parts:
            return None
        header = "=== ВКЛЮЧЁННЫЕ В КОНТЕКСТ ЗАМЕТКИ И ГЛАВЫ (автор выбрал их вручную) ==="
        return header + "\n\n" + "\n\n---\n\n".join(parts)

    async def _build_search_context_block(
        self,
        db: AsyncSession,
        universe_id: int,
        user_query: str,
        config: Dict[str, Any],
    ) -> Optional[str]:
        """Предварительный поиск по всей базе и вставка в промпт. Для найденных черновиков/заметок подставляем полный текст."""
        if not (user_query and (user_query or "").strip()):
            return None
        limit = config.get("max_results_per_category", 5) or 5
        max_note_content_chars = config.get("max_note_content_chars", 4000)
        max_notes_with_content = config.get("max_notes_with_content", 3)
        try:
            search_service = SearchService(db, universe_id)
            results = await search_service.search(user_query.strip(), limit=limit)
        except Exception:
            return None
        header = config.get("header", "=== РЕЗУЛЬТАТЫ ПОИСКА ПО ЗАПРОСУ ===")
        parts = [f"Запрос: «{user_query.strip()}»"]

        # Сначала подставляем полный текст найденных черновиков/заметок — модель должна опираться на него, а не выдумывать
        note_items = results.get("notes") or []
        if note_items:
            content_parts = []
            total_content = 0
            cap_total = 12000
            for item in note_items[:max_notes_with_content]:
                nid = item.get("id")
                if nid is None:
                    continue
                try:
                    note = await knowledge.get_note(db, nid)
                    if not note or getattr(note, "universe_id", None) != universe_id:
                        continue
                    raw = (note.content or "").strip()
                    if not raw:
                        continue
                    title = getattr(note, "title", None) or item.get("title") or "Без названия"
                    note_type = (getattr(note, "note_type", None) or "").strip().lower()
                    type_label = "Черновик" if note_type == "draft" else "Заметка"
                    take = min(len(raw), max_note_content_chars)
                    chunk = raw[:take] + ("…" if len(raw) > take else "")
                    content_parts.append(f"[{type_label}: {title}]\n{chunk}")
                    total_content += len(chunk) + len(title) + 50
                    if total_content >= cap_total:
                        break
                except Exception:
                    continue
            if content_parts:
                instruction = (
                    "ИНСТРУКЦИЯ: Ниже — текст из черновиков/заметок автора по этому запросу. "
                    "Опирайся ТОЛЬКО на этот текст. Не придумывай фактов, имён или сюжетов, которых в нём нет. "
                    "Если чего-то в тексте нет — так и скажи."
                )
                parts.append("\n\n--- ТЕКСТ НАЙДЕННЫХ ЧЕРНОВИКОВ/ЗАМЕТОК (основывай ответ только на нём) ---\n" + instruction + "\n\n" + "\n\n---\n\n".join(content_parts))

        # Полный текст найденных технологий и артефактов — чтобы модель знала HexRuner и др.
        tech_items = results.get("technologies") or []
        artifact_items = results.get("artifacts") or []
        if tech_items or artifact_items:
            from app.repositories import technology as tech_repo
            ta_parts = []
            for item in (tech_items + artifact_items)[:5]:
                tid, aid = item.get("id"), None
                typ = item.get("type")
                if typ == "technology" and tid is not None:
                    tech = await tech_repo.get_technology(db, tid)
                    if tech and getattr(tech, "universe_id", None) == universe_id:
                        text = f"Технология: {tech.name}"
                        if getattr(tech, "tech_level", None):
                            text += f"\nУровень: {tech.tech_level}"
                        if getattr(tech, "description", None):
                            text += f"\nОписание: {tech.description}"
                        if getattr(tech, "principles", None):
                            text += f"\nПринципы: {tech.principles}"
                        if getattr(tech, "application", None):
                            text += f"\nПрименение: {tech.application}"
                        ta_parts.append(text)
                elif typ == "artifact" and tid is not None:
                    art = await tech_repo.get_artifact(db, tid)
                    if art and getattr(art, "universe_id", None) == universe_id:
                        text = f"Артефакт: {art.name}"
                        if getattr(art, "artifact_type", None):
                            text += f"\nТип: {art.artifact_type}"
                        if getattr(art, "description", None):
                            text += f"\nОписание: {art.description}"
                        if getattr(art, "origin", None):
                            text += f"\nПроисхождение: {art.origin}"
                        if getattr(art, "abilities", None):
                            text += f"\nСпособности: {art.abilities}"
                        ta_parts.append(text)
            if ta_parts:
                parts.append("\n\n--- ТЕКСТ НАЙДЕННЫХ ТЕХНОЛОГИЙ/АРТЕФАКТОВ (используй эти данные в ответе) ---\n" + "\n\n---\n\n".join(ta_parts))

        section_labels = {
            "characters": "Персонажи",
            "locations": "Локации",
            "chapters": "Главы",
            "notes": "Заметки и черновики",
            "timeline": "Таймлайн",
            "wiki": "Вики",
            "technologies": "Технологии",
            "artifacts": "Артефакты",
        }
        for key, label in section_labels.items():
            items = results.get(key) or []
            if not items:
                continue
            lines = [f"\n[{label}]"]
            snippet_limit = 400 if key == "notes" else 200
            for item in items:
                title = item.get("title") or "Без названия"
                subtitle = item.get("subtitle") or ""
                snippet = (item.get("snippet") or "").strip()
                if subtitle:
                    lines.append(f"- {title} ({subtitle})")
                else:
                    lines.append(f"- {title}")
                if snippet and snippet != title:
                    lines.append(f"  Фрагмент: {snippet[:snippet_limit]}{'…' if len(snippet) > snippet_limit else ''}")
            parts.append("\n".join(lines))
        if len(parts) <= 1:
            return None
        return f"{header}\n" + "\n".join(parts)
    
    async def _build_rag_block(
        self,
        db: AsyncSession,
        universe_id: int,
        user_query: str,
        character: Optional[Character],
        config: Dict[str, Any],
        chat_time: Optional[ChatTime] = None,
        enable_rag: bool = True
    ) -> Optional[str]:
        """Построить блок RAG контекста"""
        if not user_query or not enable_rag:
            return None
        
        rag_context = await rag_service.search_with_context_async(
            universe_id=universe_id,
            query=user_query,
            n_results=5,
            character_id=character.id if character else None,
            db=db,
            before_universe_year=chat_time.universe_year if chat_time else None,
            before_universe_day=chat_time.universe_day if chat_time else None,
        )
        
        if not rag_context:
            return None
        
        header = config.get("header", "=== НАЙДЕННЫЕ ФАКТЫ ===")
        return f"{header}\n{rag_context}"
    
    async def _build_speaker_info_block(
        self,
        db: AsyncSession,
        user_role: Optional[str],
        config: Dict[str, Any],
        character: Optional[Character] = None,
    ) -> Optional[str]:
        """Построить блок информации о собеседнике"""
        if not user_role:
            return None
        
        speaker_info = ""
        if user_role == "author":
            if character is None:
                speaker_info = (
                    "Твой единственный собеседник — автор (создатель вселенной). "
                    "Ты общаешься только с ним; не отыгрывай персонажей и не веди диалог от лица мира."
                )
            else:
                speaker_info = "Твой собеседник: СОЗДАТЕЛЬ (автор вселенной). Ты это знаешь и относишься соответственно."
        elif user_role.startswith("character:"):
            try:
                tid = int(user_role.split(":")[1])
                tchar = await knowledge.get_character(db, tid)
                if tchar:
                    speaker_info = f"Твой собеседник: {tchar.name}. "
                    if tchar.role:
                        speaker_info += f"Роль в сюжете: {tchar.role}. "
                    # Учёт пола собеседника для русской грамматики (глаголы, прилагательные)
                    addressee_gender = (getattr(tchar, "gender", None) or "").strip().lower()
                    if addressee_gender in ("женский", "female", "ж", "f", "женского пола"):
                        speaker_info += (
                            "Собеседник — женского пола. ОБЯЗАТЕЛЬНО учитывай это в своей речи: "
                            "при обращении к ней используй формы женского рода (например: «подключилась», «пришла», «сказала», «увидела» — не «подключился», «пришёл», «сказал», «увидел»)."
                        )
            except Exception:
                pass
        
        if not speaker_info:
            return None
        
        header = config.get("header", "=== ТЕКУЩИЙ ДИАЛОГ ===")
        return f"{header}\n{speaker_info}"

    def _build_other_chats_block(self, other_chats_history: List[Dict[str, Any]]) -> Optional[str]:
        """Формирует блок с диалогами (автор↔персонаж, персонаж↔персонаж) для контекста помощника."""
        if not other_chats_history:
            return None
        lines = ["=== ДИАЛОГИ ПЕРСОНАЖЕЙ (ДЛЯ ОБСУЖДЕНИЯ) ===", ""]
        for item in other_chats_history:
            name = item.get("character_name") or "Диалог"
            messages = item.get("messages") or []
            if not messages:
                continue
            lines.append(f"--- {name} ---")
            for msg in messages:
                role = msg.get("role") if isinstance(msg, dict) else getattr(msg, "role", "user")
                content = msg.get("content") if isinstance(msg, dict) else getattr(msg, "content", "")
                if not content.strip():
                    continue
                label = "Автор" if role == "user" else "Персонаж"
                lines.append(f"{label}: {content.strip()}")
            lines.append("")
        if len(lines) <= 2:
            return None
        return self.settings["formatting"]["line_separator"].join(lines).rstrip()


def get_prompt_builder(settings_json: Optional[str] = None) -> PromptBuilder:
    """Получить PromptBuilder с настройками из JSON"""
    if settings_json:
        try:
            settings = json.loads(settings_json)
            return PromptBuilder(settings)
        except:
            pass
    return PromptBuilder()
