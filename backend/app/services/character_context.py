"""
Сервис контекста персонажа: фильтрация информации по уровням доступа.
Персонаж видит только те события и данные, к которым у него есть доступ.
"""
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List, Optional, Dict, Set, Tuple
from app.models import Character, CharacterKnowledge, TimelineEvent, Location
from app.services import knowledge
from app.services import timeline as timeline_service

KNOWLEDGE_LEVELS = ("none", "rumors", "superficial", "good", "complete")


async def get_character_knowledge(db: AsyncSession, character_id: int) -> List[CharacterKnowledge]:
    """Все записи знаний персонажа."""
    result = await db.execute(
        select(CharacterKnowledge).filter(CharacterKnowledge.character_id == character_id)
    )
    return result.scalars().all()


async def get_knowledge_for_target(
    db: AsyncSession, character_id: int, target_type: str, target_id: int
) -> Optional[CharacterKnowledge]:
    """Уровень знания персонажа о целевой сущности."""
    result = await db.execute(
        select(CharacterKnowledge).filter(
            CharacterKnowledge.character_id == character_id,
            CharacterKnowledge.target_type == target_type,
            CharacterKnowledge.target_id == target_id,
            CharacterKnowledge.knowledge_level != "none"
        )
    )
    return result.scalars().first()


async def get_character_accessible_entity_set(
    db: AsyncSession,
    character_id: int,
    universe_id: Optional[int] = None,
    before_universe_year: Optional[int] = None,
    before_universe_day: Optional[int] = None,
) -> Set[Tuple[str, int]]:
    """
    Множество (entity_type, entity_id), к которым у персонажа есть доступ (для фильтрации RAG).
    Включает события из witness/heard/read, если заданы universe_id и время.
    """
    recs = await get_character_knowledge(db, character_id)
    allowed = {(r.target_type, r.target_id) for r in recs if r.knowledge_level != "none"}
    allowed.add(("character", character_id))
    
    # Добавляем события из witness/heard/read, если заданы параметры
    if universe_id is not None:
        kwargs = {}
        if before_universe_year is not None and before_universe_day is not None:
            kwargs["before_universe_year"] = before_universe_year
            kwargs["before_universe_day"] = before_universe_day
        
        # События, в которых участвовал
        participated = await timeline_service.get_timeline_events(
            db, universe_id, filter_type="character", filter_id=character_id, **kwargs
        )
        for event in participated:
            allowed.add(("event", event.id))
        
        # События, которые видел
        witnessed = await timeline_service.get_timeline_events_by_witness(
            db, universe_id, character_id, **kwargs
        )
        for event in witnessed:
            allowed.add(("event", event.id))
        
        # События, о которых услышал
        heard = await timeline_service.get_timeline_events_by_heard(
            db, universe_id, character_id, **kwargs
        )
        for event in heard:
            allowed.add(("event", event.id))
        
        # События, о которых прочитал
        read = await timeline_service.get_timeline_events_by_read(
            db, universe_id, character_id, **kwargs
        )
        for event in read:
            allowed.add(("event", event.id))
    
    return allowed


async def _events_character_knows(
    db: AsyncSession,
    universe_id: int,
    character_id: int,
    before_universe_year: Optional[int] = None,
    before_universe_day: Optional[int] = None,
) -> List[TimelineEvent]:
    """
    События, о которых персонаж знает (до момента chat_time, если задан).
    Включает:
    - События, в которых персонаж участвовал (participated)
    - События, которые персонаж видел (witnessed) - уровень знания: good
    - События, о которых персонаж услышал (heard) - уровень знания: superficial
    - События, о которых персонаж прочитал (read) - уровень знания: rumors
    - События из CharacterKnowledge (явно заданные знания)
    """
    kwargs = {}
    if before_universe_year is not None and before_universe_day is not None:
        kwargs["before_universe_year"] = before_universe_year
        kwargs["before_universe_day"] = before_universe_day

    # События, в которых персонаж участвовал
    participated = await timeline_service.get_timeline_events(
        db, universe_id, filter_type="character", filter_id=character_id, **kwargs
    )

    # События, которые персонаж видел (witnessed)
    witnessed = await timeline_service.get_timeline_events_by_witness(
        db, universe_id, character_id, **kwargs
    )

    # События, о которых персонаж услышал (heard)
    heard = await timeline_service.get_timeline_events_by_heard(
        db, universe_id, character_id, **kwargs
    )

    # События, о которых персонаж прочитал (read)
    read = await timeline_service.get_timeline_events_by_read(
        db, universe_id, character_id, **kwargs
    )

    # События из CharacterKnowledge (явно заданные знания)
    knowledge_recs = await get_character_knowledge(db, character_id)
    event_ids_from_knowledge = {
        rec.target_id for rec in knowledge_recs
        if rec.target_type == "event" and rec.knowledge_level != "none"
    }

    # Оптимизация: собираем все ID событий и загружаем их одним запросом
    all_event_ids = set()
    for event in participated:
        all_event_ids.add(event.id)
    for event in witnessed:
        all_event_ids.add(event.id)
    for event in heard:
        all_event_ids.add(event.id)
    for event in read:
        all_event_ids.add(event.id)
    all_event_ids.update(event_ids_from_knowledge)
    
    # Загружаем события из CharacterKnowledge только если есть такие ID
    knowledge_events = []
    if event_ids_from_knowledge:
        knowledge_events = await timeline_service.get_timeline_events(
            db, universe_id, filter_type="ids", filter_ids=list(event_ids_from_knowledge), **kwargs
        )
    
    seen = {e.id for e in participated}
    result = list(participated)
    
    # Добавляем witnessed события
    for event in witnessed:
        if event.id not in seen:
            result.append(event)
            seen.add(event.id)
    
    # Добавляем heard события
    for event in heard:
        if event.id not in seen:
            result.append(event)
            seen.add(event.id)
    
    # Добавляем read события
    for event in read:
        if event.id not in seen:
            result.append(event)
            seen.add(event.id)
    
    # Добавляем события из CharacterKnowledge
    for event in knowledge_events:
        if event.id not in seen:
            result.append(event)
            seen.add(event.id)
    
    return result


def _filter_character_info_by_level(char: Character, level: str) -> str:
    """Форматировать информацию о персонаже в зависимости от уровня знания."""
    parts = [f"- {char.name}"]
    if level == "rumors":
        if char.role:
            parts.append(f"  (роль: {char.role})")
        return "\n".join(parts)
    if level == "superficial":
        if char.role:
            parts.append(f"  Роль: {char.role}")
        if char.description:
            parts.append(f"  Описание: {char.description[:150]}...")
        return "\n".join(parts)
    if level in ("good", "complete"):
        if char.role:
            parts.append(f"  Роль: {char.role}")
        if char.description:
            parts.append(f"  Описание: {char.description}")
        if char.traits:
            parts.append(f"  Черты: {char.traits}")
        if char.appearance and level == "complete":
            parts.append(f"  Внешность: {char.appearance}")
        if char.backstory and level == "complete":
            parts.append(f"  Предыстория: {char.backstory}")

        # Дополнительные нюансы
        nuances = {
            "goals": "Цели",
            "fears": "Страхи",
            "conflicts": "Конфликты",
            "character_values": "Ценности",
            "speech_pattern": "Манера речи",
            "mannerisms": "Манеры",
            "habits": "Привычки"
        }
        for attr, label in nuances.items():
            v = getattr(char, attr, None)
            if v:
                parts.append(f"  {label}: {v}")

        # age не выводим: возраст считается по дате рождения в календаре вселенной и времени диалога (в системном промпте для текущего персонажа)
        for attr in ("gender", "profession"):
            v = getattr(char, attr, None)
            if v:
                parts.append(f"  {attr}: {v}")
    return "\n".join(parts)


async def get_character_accessible_context(
    db: AsyncSession,
    universe_id: int,
    character_id: int,
    user_query: str = "",
    before_universe_year: Optional[int] = None,
    before_universe_day: Optional[int] = None,
    master_db: Optional[AsyncSession] = None,
) -> str:
    """
    Собрать контекст вселенной, доступный персонажу по его знаниям на момент времени (если задан).
    """
    # Universe находится в master database, а не в universe database
    if not master_db:
        raise ValueError("master_db is required for get_character_accessible_context")
    book = await knowledge.get_universe(universe_id, master_db)
    if not book:
        return ""
    current = await knowledge.get_character(db, character_id)
    if not current or current.universe_id != universe_id:
        return ""

    recs = await get_character_knowledge(db, character_id)
    knowledge_records = { (r.target_type, r.target_id): r for r in recs }

    all_characters = await knowledge.get_characters(db, universe_id)
    all_characters = [c for c in all_characters if getattr(c, "enabled", True) is not False]

    accessible_events = await _events_character_knows(
        db, universe_id, character_id,
        before_universe_year=before_universe_year,
        before_universe_day=before_universe_day,
    )

    parts = [f"=== КНИГА: {book.title} ==="]
    if book.description:
        parts.append(f"Описание: {book.description}")

    parts.append("\n=== ПЕРСОНАЖИ (по твоим знаниям) ===")
    for char in all_characters:
        if char.id == character_id:
            parts.append(_filter_character_info_by_level(char, "complete"))
            continue
        key = ("character", char.id)
        rec = knowledge_records.get(key)
        if rec and rec.knowledge_level != "none":
            parts.append(_filter_character_info_by_level(char, rec.knowledge_level))
        else:
            parts.append(f"- {char.name} (ты знаешь о нём мало или ничего)")

    parts.append("\n=== СОБЫТИЯ (о которых ты знаешь) ===")
    for ev in accessible_events[:15]:
        parts.append(f"- {ev.title}")
        if ev.description:
            parts.append(f"  {ev.description[:200]}")

    return "\n".join(parts)
