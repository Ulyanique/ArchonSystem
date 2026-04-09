"""Подстановка имён вместо маркеров [[character:id]], [[location:id]], [[note:id]] в тексте."""
import re
from sqlalchemy.ext.asyncio import AsyncSession

from app.services import knowledge

MARKER_PATTERN = re.compile(r"\[\[(character|location|note):(\d+)\]\]")


async def resolve_markers(db: AsyncSession, universe_id: int, text: str) -> str:
    """Заменить в тексте [[type:id]] на текущие имена сущностей (персонаж/локация/заметка)."""
    if not text:
        return text

    matches = list(MARKER_PATTERN.finditer(text))
    if not matches:
        return text

    replacements = []
    for match in matches:
        entity_type, entity_id_str = match.group(1), match.group(2)
        eid = int(entity_id_str)
        replacement = match.group(0)

        if entity_type == "character":
            obj = await knowledge.get_character(db, eid)
            if obj and obj.universe_id == universe_id:
                replacement = obj.name
        elif entity_type == "location":
            obj = await knowledge.get_location(db, eid)
            if obj and obj.universe_id == universe_id:
                replacement = obj.name
        elif entity_type == "note":
            obj = await knowledge.get_note(db, eid)
            if obj and obj.universe_id == universe_id:
                replacement = obj.title

        start, end = match.span()
        replacements.append((start, end, replacement))

    result = text
    for start, end, replacement in reversed(replacements):
        result = result[:start] + replacement + result[end:]

    return result
