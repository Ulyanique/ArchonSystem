import re
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, false
from typing import List, Dict, Optional
from app.models import Universe, Character, Location, Chapter, Note, TimelineEvent, WikiArticle, SceneBeat, Technology, Artifact


# Транслитерация кириллица ↔ латиница для поиска (например "Харпер" ↔ "Harper")
_CYR_TO_LAT: Dict[str, str] = {
    "а": "a", "б": "b", "в": "v", "г": "g", "д": "d", "е": "e", "ё": "e", "ж": "zh", "з": "z",
    "и": "i", "й": "j", "к": "k", "л": "l", "м": "m", "н": "n", "о": "o", "п": "p", "р": "r",
    "с": "s", "т": "t", "у": "u", "ф": "f", "х": "h", "ц": "ts", "ч": "ch", "ш": "sh", "щ": "sch",
    "ъ": "", "ы": "y", "ь": "", "э": "e", "ю": "yu", "я": "ya",
}
_LAT_TO_CYR: Dict[str, str] = {
    "a": "а", "b": "б", "c": "к", "d": "д", "e": "е", "f": "ф", "g": "г", "h": "х", "i": "и",
    "j": "й", "k": "к", "l": "л", "m": "м", "n": "н", "o": "о", "p": "п", "r": "р", "s": "с",
    "t": "т", "u": "у", "v": "в", "y": "ы", "z": "з",
    "zh": "ж", "ts": "ц", "ch": "ч", "sh": "ш", "sch": "щ", "yu": "ю", "ya": "я",
}


def _transliterate_cyrillic_to_latin(s: str) -> str:
    """харпер -> harper (только строчные)."""
    s = s.lower()
    out: List[str] = []
    i = 0
    while i < len(s):
        c = s[i]
        if "\u0400" <= c <= "\u04ff":
            out.append(_CYR_TO_LAT.get(c, c))
        else:
            out.append(c)
        i += 1
    return "".join(out)


def _transliterate_latin_to_cyrillic(s: str) -> str:
    """harper -> харпер (только строчные). Сначала пробуем двух/трёхбуквенные сочетания."""
    s = s.lower()
    out: List[str] = []
    i = 0
    while i < len(s):
        for ln in (3, 2, 1):
            if i + ln <= len(s):
                chunk = s[i : i + ln]
                cyr = _LAT_TO_CYR.get(chunk)
                if cyr is not None:
                    out.append(cyr)
                    i += ln
                    break
        else:
            out.append(s[i])
            i += 1
    return "".join(out)


def _is_mostly_cyrillic(s: str) -> bool:
    return sum(1 for c in s if "\u0400" <= c <= "\u04ff") / max(len(s), 1) > 0.5


def _normalize_query(query: str) -> List[str]:
    """Нормализация запроса: обрезка, ё→е, разбивка на слова. Пустой список если слов нет."""
    if not query or not query.strip():
        return []
    s = query.strip().lower()
    s = s.replace("ё", "е")
    s = re.sub(r"\s+", " ", s)
    words = [w for w in s.split() if w]
    return _expand_words_for_script(words)


def _expand_words_for_script(words: List[str]) -> List[str]:
    """Добавляем варианты в другой раскладке (кириллица↔латиница), чтобы «Харпер» находил Harper и наоборот."""
    seen = set()
    result = []
    for w in words:
        if w not in seen:
            seen.add(w)
            result.append(w)
        if _is_mostly_cyrillic(w):
            lat = _transliterate_cyrillic_to_latin(w)
            if lat != w and lat not in seen:
                seen.add(lat)
                result.append(lat)
        else:
            cyr = _transliterate_latin_to_cyrillic(w)
            if cyr != w and cyr not in seen:
                seen.add(cyr)
                result.append(cyr)
    return result


def _word_patterns(words: List[str]):
    """Для каждого слова возвращает паттерн %word%."""
    return [f"%{w}%" for w in words]


def _text_matches_words(text: Optional[str], words: List[str]) -> bool:
    """Проверка без учёта регистра (Python lower() корректно обрабатывает кириллицу; SQLite — нет)."""
    if not text or not words:
        return False
    lower_text = text.lower()
    return any(w in lower_text for w in words)


def _character_matches_words(character, words: List[str], search_columns: list) -> bool:
    """True, если хотя бы одно из полей персонажа содержит хотя бы одно из слов (case-insensitive)."""
    for col_name in search_columns:
        val = getattr(character, col_name, None)
        if val and _text_matches_words(str(val), words):
            return True
    return False


class SearchService:
    """Сервис для умного поиска по вселенной. Поиск по словам (OR): строка совпадает, если содержит любое из слов."""

    def __init__(self, db: AsyncSession, universe_id: int):
        self.db = db
        self.universe_id = universe_id

    def _query_condition_for_columns(self, columns: list, words: List[str]):
        """Условие: хотя бы одно из полей содержит хотя бы одно из слов."""
        if not words:
            return false()
        patterns = _word_patterns(words)
        or_conditions = []
        for col in columns:
            if col is None:
                continue
            for p in patterns:
                or_conditions.append(col.ilike(p))
        return or_(*or_conditions) if or_conditions else false()

    async def search(self, query: str, limit: int = 20) -> Dict:
        """
        Поиск по всем элементам вселенной.
        Возвращает результаты сгруппированные по типам.
        """
        results = {
            "characters": await self._search_characters(query, limit),
            "locations": await self._search_locations(query, limit),
            "chapters": await self._search_chapters(query, limit),
            "notes": await self._search_notes(query, limit),
            "timeline": await self._search_timeline(query, limit),
            "wiki": await self._search_wiki(query, limit),
            "technologies": await self._search_technologies(query, limit),
            "artifacts": await self._search_artifacts(query, limit),
        }
        
        # Общее количество результатов
        results["total"] = sum(len(r) for r in results.values() if isinstance(r, list))
        
        return results
    
    async def _search_characters(self, query: str, limit: int) -> List[Dict]:
        """Поиск по персонажам: любое из слов запроса в любом из полей.
        После SQL делаем пост-фильтр по Python (case-insensitive), т.к. SQLite LIKE
        не учитывает регистр кириллицы. Если SQL вернул 0 кандидатов (напр. «Харпер» не матчит
        «харпер» из-за регистра), подгружаем всех персонажей и фильтруем в Python.
        """
        words = _normalize_query(query)
        if not words:
            return []
        search_columns = ["name", "description", "traits", "appearance", "backstory", "role"]
        cond = self._query_condition_for_columns([
            Character.name, Character.description, Character.traits,
            Character.appearance, Character.backstory, Character.role,
        ], words)
        stmt = select(Character).filter(
            Character.universe_id == self.universe_id,
            cond,
        ).limit(limit * 4)
        res = await self.db.execute(stmt)
        candidates = res.scalars().all()
        results = [c for c in candidates if _character_matches_words(c, words, search_columns)][:limit]
        # Fallback: SQLite не матчит кириллицу без учёта регистра — при 0 результатах
        # ищем по всем персонажам вселенной и фильтруем в Python
        if not results and words:
            stmt_all = select(Character).filter(
                Character.universe_id == self.universe_id,
            ).limit(limit * 5)
            res_all = await self.db.execute(stmt_all)
            all_chars = res_all.scalars().all()
            results = [c for c in all_chars if _character_matches_words(c, words, search_columns)][:limit]
        return [
            {
                "id": c.id, "type": "character", "title": c.name, "subtitle": c.role,
                "snippet": self._highlight_match(c.description, query),
                "url": f"/universes/{self.universe_id}/characters",
            }
            for c in results
        ]
    
    async def _search_locations(self, query: str, limit: int) -> List[Dict]:
        """Поиск по локациям: любое из слов запроса в любом из полей."""
        words = _normalize_query(query)
        cond = self._query_condition_for_columns([
            Location.name, Location.description, Location.details, Location.location_type,
        ], words)
        stmt = select(Location).filter(
            Location.universe_id == self.universe_id,
            Location.enabled != False,
            cond,
        ).limit(limit)
        res = await self.db.execute(stmt)
        results = res.scalars().all()
        return [
            {
                "id": l.id, "type": "location", "title": l.name, "subtitle": l.location_type,
                "snippet": self._highlight_match(l.description, query),
                "url": f"/universes/{self.universe_id}/locations",
            }
            for l in results
        ]
    
    async def _search_chapters(self, query: str, limit: int) -> List[Dict]:
        """Поиск по главам: поля главы и текст сцен (SceneBeat). Объединяем оба источника."""
        words = _normalize_query(query)
        chapter_cond = self._query_condition_for_columns([
            Chapter.title, Chapter.summary, Chapter.content, Chapter.notes,
        ], words)
        # 1) Главы по полям самой главы
        stmt1 = select(Chapter.id).filter(
            Chapter.universe_id == self.universe_id,
            Chapter.enabled != False,
            chapter_cond,
        ).limit(limit * 2)
        res1 = await self.db.execute(stmt1)
        ids_from_chapter = {row[0] for row in res1.fetchall()}

        # 2) Главы, в которых хотя бы одна сцена (SceneBeat) содержит запрос
        beat_cond = self._query_condition_for_columns(
            [SceneBeat.content, SceneBeat.description, SceneBeat.title], words
        )
        stmt2 = (
            select(SceneBeat.chapter_id)
            .distinct()
            .select_from(SceneBeat)
            .join(Chapter, SceneBeat.chapter_id == Chapter.id)
            .filter(
                Chapter.universe_id == self.universe_id,
                Chapter.enabled != False,
                SceneBeat.enabled != False,  # отключённые сцены не участвуют в поиске
                beat_cond,
            )
            .limit(limit * 2)
        )
        res2 = await self.db.execute(stmt2)
        ids_from_beats = {row[0] for row in res2.fetchall()}

        all_chapter_ids = sorted(ids_from_chapter | ids_from_beats)[:limit]
        if not all_chapter_ids:
            return []

        stmt = select(Chapter).filter(
            Chapter.id.in_(all_chapter_ids),
            Chapter.universe_id == self.universe_id,
        ).order_by(Chapter.chapter_number, Chapter.id)
        res = await self.db.execute(stmt)
        chapters = res.scalars().all()
        # Сохраняем порядок по all_chapter_ids (сначала из главы, потом из сцен)
        by_id = {c.id: c for c in chapters}
        ordered = [by_id[i] for i in all_chapter_ids if i in by_id]

        return [
            {
                "id": c.id,
                "type": "chapter",
                "title": f"Глава {c.chapter_number}: {c.title}",
                "subtitle": f"{len(c.content or '')} символов",
                "snippet": self._highlight_match(
                    c.summary or (c.content[:200] if c.content else ""), query
                ),
                "url": f"/universes/{self.universe_id}/chapters",
            }
            for c in ordered
        ]
    
    def _note_matches_words(self, note, words: List[str]) -> bool:
        """True, если заголовок или содержимое заметки содержит хотя бы одно из слов (без учёта регистра)."""
        return (
            _text_matches_words(note.title, words) or
            _text_matches_words(note.content, words)
        )

    async def _search_notes(self, query: str, limit: int) -> List[Dict]:
        """Поиск по заметкам: любое из слов запроса в заголовке или содержимом.
        Из-за SQLite (LIKE по кириллице может быть чувствителен к регистру) при 0 результатах
        делаем fallback: подгружаем заметки и фильтруем в Python.
        """
        words = _normalize_query(query)
        if not words:
            return []
        cond = self._query_condition_for_columns([Note.title, Note.content], words)
        stmt = select(Note).filter(
            Note.universe_id == self.universe_id,
            Note.enabled != False,
            cond,
        ).limit(limit * 3)
        res = await self.db.execute(stmt)
        results = res.scalars().all()
        # Пост-фильтр по Python (корректный поиск по кириллице без учёта регистра)
        results = [n for n in results if self._note_matches_words(n, words)][:limit]
        # Fallback: SQLite мог не найти из-за регистра кириллицы — ищем по всем заметкам
        if not results and words:
            stmt_all = select(Note).filter(
                Note.universe_id == self.universe_id,
                Note.enabled != False,
            ).limit(limit * 10)
            res_all = await self.db.execute(stmt_all)
            all_notes = res_all.scalars().all()
            results = [n for n in all_notes if self._note_matches_words(n, words)][:limit]
        type_labels = {
            "idea": "💡 Идея", "research": "📚 Исследование", "draft": "✏️ Черновик",
            "avoid": "🚫 Чего избегать", "other": "📝 Другое",
        }
        base = f"/universes/{self.universe_id}"
        return [
            {
                "id": n.id, "type": "note", "title": n.title,
                "subtitle": type_labels.get(n.note_type, n.note_type),
                "snippet": self._highlight_match(n.content, query),
                "url": f"{base}/drafts/{n.id}" if (n.note_type or "").strip().lower() == "draft" else f"{base}/notes/{n.id}",
            }
            for n in results
        ]
    
    async def _search_timeline(self, query: str, limit: int) -> List[Dict]:
        """Поиск по таймлайну: любое из слов запроса в полях события."""
        words = _normalize_query(query)
        cond = self._query_condition_for_columns([
            TimelineEvent.title, TimelineEvent.description, TimelineEvent.date_value,
        ], words)
        stmt = select(TimelineEvent).filter(
            TimelineEvent.universe_id == self.universe_id,
            cond,
        ).limit(limit)
        res = await self.db.execute(stmt)
        results = res.scalars().all()
        return [
            {
                "id": e.id, "type": "timeline", "title": e.title,
                "subtitle": e.date_value or "Без даты",
                "snippet": self._highlight_match(e.description, query),
                "url": f"/universes/{self.universe_id}/timeline",
            }
            for e in results
        ]
    
    async def _search_wiki(self, query: str, limit: int) -> List[Dict]:
        """Поиск по вики: любое из слов запроса в заголовке или содержимом."""
        words = _normalize_query(query)
        cond = self._query_condition_for_columns([
            WikiArticle.title, WikiArticle.content,
        ], words)
        stmt = select(WikiArticle).filter(
            WikiArticle.universe_id == self.universe_id,
            cond,
        ).limit(limit)
        res = await self.db.execute(stmt)
        results = res.scalars().all()
        return [
            {
                "id": a.id, "type": "wiki", "title": a.title,
                "subtitle": a.article_type or "Вики",
                "snippet": self._highlight_match(a.content, query),
                "url": f"/universes/{self.universe_id}/wiki",
            }
            for a in results
        ]

    async def _search_technologies(self, query: str, limit: int) -> List[Dict]:
        """Поиск по технологиям: имя, описание, принципы, применение, уровень."""
        words = _normalize_query(query)
        if not words:
            return []
        cond = self._query_condition_for_columns([
            Technology.name, Technology.description, Technology.principles, Technology.application, Technology.tech_level,
        ], words)
        stmt = select(Technology).filter(
            Technology.universe_id == self.universe_id,
            cond,
        ).limit(limit * 2)
        res = await self.db.execute(stmt)
        results = res.scalars().all()
        results = [t for t in results if any(
            _text_matches_words(getattr(t, c, None) or "", words)
            for c in ("name", "description", "principles", "application", "tech_level")
        )][:limit]
        return [
            {
                "id": t.id, "type": "technology", "title": t.name,
                "subtitle": t.tech_level or "Технология",
                "snippet": self._highlight_match(t.description or t.principles, query),
                "url": f"/universes/{self.universe_id}/technologies",
            }
            for t in results
        ]

    async def _search_artifacts(self, query: str, limit: int) -> List[Dict]:
        """Поиск по артефактам: имя, описание, происхождение, способности."""
        words = _normalize_query(query)
        if not words:
            return []
        cond = self._query_condition_for_columns([
            Artifact.name, Artifact.description, Artifact.origin, Artifact.abilities, Artifact.artifact_type,
        ], words)
        stmt = select(Artifact).filter(
            Artifact.universe_id == self.universe_id,
            cond,
        ).limit(limit * 2)
        res = await self.db.execute(stmt)
        results = res.scalars().all()
        results = [a for a in results if any(
            _text_matches_words(getattr(a, c, None) or "", words)
            for c in ("name", "description", "origin", "abilities", "artifact_type")
        )][:limit]
        return [
            {
                "id": a.id, "type": "artifact", "title": a.name,
                "subtitle": a.artifact_type or "Артефакт",
                "snippet": self._highlight_match(a.description or a.abilities, query),
                "url": f"/universes/{self.universe_id}/artifacts",
            }
            for a in results
        ]

    def _highlight_match(self, text: str, query: str, max_length: int = 150) -> str:
        if not text: return ""
        text_lower = text.lower()
        query_lower = query.lower()
        pos = text_lower.find(query_lower)
        if pos == -1:
            return text[:max_length] + "..." if len(text) > max_length else text
        start = max(0, pos - 30)
        end = min(len(text), pos + len(query) + 30)
        snippet = text[start:end]
        if start > 0: snippet = "..." + snippet
        if end < len(text): snippet = snippet + "..."
        return snippet
