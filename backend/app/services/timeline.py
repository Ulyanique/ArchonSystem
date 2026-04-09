from sqlalchemy import delete, select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from typing import List, Optional
from app.models import TimelineEvent, Character, timeline_characters, event_witnesses, event_heard_by, event_read_by, CharacterKnowledge
from app.schemas import TimelineEventCreate, TimelineEventUpdate
from datetime import datetime, timezone


async def _sync_character_knowledge_for_event(
    db: AsyncSession, 
    event_id: int, 
    character_ids: List[int], 
    source_type: str,
    knowledge_level: str
):
    """Синхронизировать CharacterKnowledge для персонажей, связанных с событием"""
    from app.repositories.character_knowledge import get_character_knowledge_list, create_character_knowledge
    from app.schemas import CharacterKnowledgeCreate
    
    for char_id in character_ids:
        # Проверяем, есть ли уже запись знаний об этом событии
        existing_knowledge = await get_character_knowledge_list(db, char_id)
        has_knowledge = any(
            k.target_type == 'event' and k.target_id == event_id 
            for k in existing_knowledge
        )
        
        if not has_knowledge:
            # Создаём запись знаний
            knowledge_data = CharacterKnowledgeCreate(
                target_type='event',
                target_id=event_id,
                knowledge_level=knowledge_level,
                source_type=source_type,
                source_id=event_id,
                notes=f'Автоматически создано при добавлении связи {source_type}'
            )
            await create_character_knowledge(db, char_id, knowledge_data)

async def get_timeline_events(
    db: AsyncSession,
    universe_id: int,
    filter_type: Optional[str] = None,
    filter_id: Optional[int] = None,
    filter_ids: Optional[List[int]] = None,
    before_universe_year: Optional[int] = None,
    before_universe_day: Optional[int] = None,
) -> List[TimelineEvent]:
    """Получить события таймлайна. Если заданы before_universe_year/day — только события до этого момента (для чата)."""
    stmt = (
        select(TimelineEvent)
        .options(
            selectinload(TimelineEvent.characters),
            selectinload(TimelineEvent.witness_characters),
            selectinload(TimelineEvent.heard_by_characters),
            selectinload(TimelineEvent.read_by_characters),
        )
        .filter(TimelineEvent.universe_id == universe_id)
    )

    if filter_type and filter_id:
        if filter_type == "character":
            stmt = stmt.join(timeline_characters).filter(timeline_characters.c.character_id == filter_id).distinct()
        elif filter_type == "location":
            stmt = stmt.filter(TimelineEvent.location_id == filter_id)
        elif filter_type == "chapter":
            stmt = stmt.filter(TimelineEvent.chapter_id == filter_id)
        elif filter_type == "ids" and filter_ids:
            stmt = stmt.filter(TimelineEvent.id.in_(filter_ids))
    elif filter_type == "ids" and filter_ids:
        stmt = stmt.filter(TimelineEvent.id.in_(filter_ids))

    if before_universe_year is not None and before_universe_day is not None:
        # События с датой до момента чата или без даты (universe_year is null)
        stmt = stmt.filter(
            or_(
                TimelineEvent.universe_year.is_(None),
                (TimelineEvent.universe_year < before_universe_year),
                (
                    (TimelineEvent.universe_year == before_universe_year)
                    & (TimelineEvent.universe_day <= before_universe_day)
                ),
            )
        )

    stmt = stmt.order_by(TimelineEvent.sort_order, TimelineEvent.date_value)
    result = await db.execute(stmt)
    events = list(result.unique().scalars().all())
    
    # Получаем события рождения и смерти персонажей
    character_events = await _get_character_life_events(
        db, universe_id, filter_type, filter_id, before_universe_year, before_universe_day
    )
    
    # Объединяем события
    all_events = list(events) + character_events
    
    # Сортируем по дате
    def get_sort_key(event):
        # Используем universe_year/universe_day для сортировки, если есть
        if hasattr(event, 'universe_year') and event.universe_year is not None:
            year = event.universe_year
            day = event.universe_day if hasattr(event, 'universe_day') and event.universe_day is not None else 0
            return (0, year, day, getattr(event, 'sort_order', 0))
        # Иначе используем date_value как строку
        date_val = getattr(event, 'date_value', '') or ''
        sort_order = getattr(event, 'sort_order', 0)
        return (1, date_val, sort_order)
    
    all_events.sort(key=get_sort_key)
    
    return all_events

async def _get_character_life_events(
    db: AsyncSession,
    universe_id: int,
    filter_type: Optional[str] = None,
    filter_id: Optional[int] = None,
    before_universe_year: Optional[int] = None,
    before_universe_day: Optional[int] = None,
) -> List[TimelineEvent]:
    """Получить виртуальные события рождения и смерти персонажей"""
    stmt = select(Character).filter(Character.universe_id == universe_id)
    
    # Применяем фильтр по персонажу, если задан
    if filter_type == "character" and filter_id:
        stmt = stmt.filter(Character.id == filter_id)
    
    result = await db.execute(stmt)
    characters = result.scalars().all()
    
    character_events = []
    
    for char in characters:
        # Событие рождения
        if char.birth_date or (char.birth_universe_year is not None and char.birth_universe_day is not None):
            # Проверяем фильтр по дате для чата
            if before_universe_year is not None and before_universe_day is not None:
                if char.birth_universe_year is not None:
                    if char.birth_universe_year > before_universe_year:
                        continue
                    if char.birth_universe_year == before_universe_year and char.birth_universe_day > before_universe_day:
                        continue
            
            # Создаем виртуальное событие рождения
            birth_event = TimelineEvent(
                id=-char.id * 1000 - 1,  # Отрицательный ID для виртуальных событий
                universe_id=universe_id,
                title=f"Рождение: {char.name}",
                description=f"Родился персонаж {char.name}" + (f" в {char.birth_place}" if char.birth_place else ""),
                date_value=char.birth_date or f"Год {char.birth_universe_year}, День {char.birth_universe_day}",
                sort_order=0,
                universe_year=char.birth_universe_year,
                universe_day=char.birth_universe_day,
                event_type="birth",
                chapter_id=None,
                location_id=None,
                created_at=datetime.now(timezone.utc),
                updated_at=datetime.now(timezone.utc),
            )
            # Устанавливаем связь с персонажем (character_ids будет вычислено автоматически из characters)
            birth_event.characters = [char]
            character_events.append(birth_event)
        
        # Событие смерти
        if char.death_date or (char.death_universe_year is not None and char.death_universe_day is not None):
            # Проверяем фильтр по дате для чата
            if before_universe_year is not None and before_universe_day is not None:
                if char.death_universe_year is not None:
                    if char.death_universe_year > before_universe_year:
                        continue
                    if char.death_universe_year == before_universe_year and char.death_universe_day > before_universe_day:
                        continue
            
            # Создаем виртуальное событие смерти
            death_event = TimelineEvent(
                id=-char.id * 1000 - 2,  # Отрицательный ID для виртуальных событий
                universe_id=universe_id,
                title=f"Смерть: {char.name}",
                description=f"Умер персонаж {char.name}",
                date_value=char.death_date or f"Год {char.death_universe_year}, День {char.death_universe_day}",
                sort_order=0,
                universe_year=char.death_universe_year,
                universe_day=char.death_universe_day,
                event_type="death",
                chapter_id=None,
                location_id=None,
                created_at=datetime.now(timezone.utc),
                updated_at=datetime.now(timezone.utc),
            )
            # Устанавливаем связь с персонажем (character_ids будет вычислено автоматически из characters)
            death_event.characters = [char]
            character_events.append(death_event)
    
    return character_events

async def get_timeline_event(db: AsyncSession, event_id: int) -> Optional[TimelineEvent]:
    """Получить событие по ID"""
    result = await db.execute(
        select(TimelineEvent)
        .options(
            selectinload(TimelineEvent.characters),
            selectinload(TimelineEvent.witness_characters),
            selectinload(TimelineEvent.heard_by_characters),
            selectinload(TimelineEvent.read_by_characters),
        )
        .filter(TimelineEvent.id == event_id)
    )
    return result.scalars().first()

async def create_timeline_event(db: AsyncSession, event: TimelineEventCreate) -> TimelineEvent:
    """Создать событие таймлайна"""
    character_ids = event.character_ids if hasattr(event, 'character_ids') and event.character_ids else []
    witness_ids = getattr(event, 'witness_character_ids', None) or []
    heard_ids = getattr(event, 'heard_by_character_ids', None) or []
    read_ids = getattr(event, 'read_by_character_ids', None) or []
    
    db_event = TimelineEvent(
        universe_id=event.universe_id,
        title=event.title,
        description=event.description,
        date_value=event.date_value,
        sort_order=event.sort_order,
        universe_year=getattr(event, "universe_year", None),
        universe_day=getattr(event, "universe_day", None),
        event_type=event.event_type,
        chapter_id=event.chapter_id,
        location_id=event.location_id
    )
    
    db.add(db_event)
    await db.commit()
    await db.refresh(db_event)
    
    # Добавляем связь с персонажами
    if character_ids:
        for char_id in character_ids:
            stmt = timeline_characters.insert().values(event_id=db_event.id, character_id=char_id)
            await db.execute(stmt)
        await db.commit()
    
    # Добавляем witness/heard/read связи и создаём CharacterKnowledge
    if witness_ids:
        for cid in witness_ids:
            await db.execute(event_witnesses.insert().values(event_id=db_event.id, character_id=cid))
        await _sync_character_knowledge_for_event(db, db_event.id, witness_ids, 'witnessed', 'good')
        await db.commit()
    
    if heard_ids:
        for cid in heard_ids:
            await db.execute(event_heard_by.insert().values(event_id=db_event.id, character_id=cid))
        await _sync_character_knowledge_for_event(db, db_event.id, heard_ids, 'heard', 'superficial')
        await db.commit()
    
    if read_ids:
        for cid in read_ids:
            await db.execute(event_read_by.insert().values(event_id=db_event.id, character_id=cid))
        await _sync_character_knowledge_for_event(db, db_event.id, read_ids, 'read', 'rumors')
        await db.commit()
    
    return await get_timeline_event(db, db_event.id)

async def create_timeline_event_raw(db: AsyncSession, event_data: dict) -> TimelineEvent:
    """Создать событие таймлайна из dict"""
    character_ids = event_data.pop('character_ids', [])
    
    db_event = TimelineEvent(**event_data)
    db.add(db_event)
    await db.commit()
    await db.refresh(db_event)
    
    # Добавляем связь с персонажами
    if character_ids:
        for char_id in character_ids:
            stmt = timeline_characters.insert().values(event_id=db_event.id, character_id=char_id)
            await db.execute(stmt)
        await db.commit()
    
    return await get_timeline_event(db, db_event.id)

async def update_timeline_event(db: AsyncSession, event_id: int, event: TimelineEventUpdate) -> Optional[TimelineEvent]:
    """Обновить событие таймлайна"""
    result = await db.execute(select(TimelineEvent).filter(TimelineEvent.id == event_id))
    db_event = result.scalars().first()
    if not db_event:
        return None
    
    update_data = event.model_dump(exclude_unset=True)
    character_ids = update_data.pop('character_ids', None)
    witness_ids = update_data.pop('witness_character_ids', None)
    heard_ids = update_data.pop('heard_by_character_ids', None)
    read_ids = update_data.pop('read_by_character_ids', None)
    
    for key, value in update_data.items():
        setattr(db_event, key, value)
    
    if character_ids is not None:
        await db.execute(delete(timeline_characters).where(timeline_characters.c.event_id == event_id))
        for char_id in character_ids:
            await db.execute(timeline_characters.insert().values(event_id=event_id, character_id=char_id))
    if witness_ids is not None:
        await db.execute(delete(event_witnesses).where(event_witnesses.c.event_id == event_id))
        for cid in witness_ids:
            await db.execute(event_witnesses.insert().values(event_id=event_id, character_id=cid))
        # Автоматически создаём CharacterKnowledge для очевидцев
        await _sync_character_knowledge_for_event(db, event_id, witness_ids, 'witnessed', 'good')
    if heard_ids is not None:
        await db.execute(delete(event_heard_by).where(event_heard_by.c.event_id == event_id))
        for cid in heard_ids:
            await db.execute(event_heard_by.insert().values(event_id=event_id, character_id=cid))
        # Автоматически создаём CharacterKnowledge для услышавших
        await _sync_character_knowledge_for_event(db, event_id, heard_ids, 'heard', 'superficial')
    if read_ids is not None:
        await db.execute(delete(event_read_by).where(event_read_by.c.event_id == event_id))
        for cid in read_ids:
            await db.execute(event_read_by.insert().values(event_id=event_id, character_id=cid))
        # Автоматически создаём CharacterKnowledge для прочитавших
        await _sync_character_knowledge_for_event(db, event_id, read_ids, 'read', 'rumors')
    
    await db.commit()
    return await get_timeline_event(db, event_id)


async def _sync_character_knowledge_for_event(
    db: AsyncSession, 
    event_id: int, 
    character_ids: List[int], 
    source_type: str,
    knowledge_level: str
):
    """Синхронизировать CharacterKnowledge для персонажей, связанных с событием"""
    from app.repositories.character_knowledge import get_character_knowledge_list, create_character_knowledge
    from app.schemas import CharacterKnowledgeCreate
    
    for char_id in character_ids:
        # Проверяем, есть ли уже запись знаний об этом событии
        existing_knowledge = await get_character_knowledge_list(db, char_id)
        has_knowledge = any(
            k.target_type == 'event' and k.target_id == event_id 
            for k in existing_knowledge
        )
        
        if not has_knowledge:
            # Создаём запись знаний
            knowledge_data = CharacterKnowledgeCreate(
                target_type='event',
                target_id=event_id,
                knowledge_level=knowledge_level,
                source_type=source_type,
                source_id=event_id,
                notes=f'Автоматически создано при добавлении связи {source_type}'
            )
            await create_character_knowledge(db, char_id, knowledge_data)

async def delete_timeline_event(db: AsyncSession, event_id: int) -> bool:
    """Удалить событие таймлайна"""
    result = await db.execute(select(TimelineEvent).filter(TimelineEvent.id == event_id))
    db_event = result.scalars().first()
    if not db_event:
        return False
    await db.execute(delete(timeline_characters).where(timeline_characters.c.event_id == event_id))
    await db.execute(delete(event_witnesses).where(event_witnesses.c.event_id == event_id))
    await db.execute(delete(event_heard_by).where(event_heard_by.c.event_id == event_id))
    await db.execute(delete(event_read_by).where(event_read_by.c.event_id == event_id))
    await db.delete(db_event)
    await db.commit()
    return True

async def get_timeline_events_by_witness(
    db: AsyncSession,
    universe_id: int,
    character_id: int,
    before_universe_year: Optional[int] = None,
    before_universe_day: Optional[int] = None,
) -> List[TimelineEvent]:
    """Получить события, которые персонаж видел (witness)"""
    stmt = (
        select(TimelineEvent)
        .options(
            selectinload(TimelineEvent.characters),
            selectinload(TimelineEvent.witness_characters),
            selectinload(TimelineEvent.heard_by_characters),
            selectinload(TimelineEvent.read_by_characters),
        )
        .join(event_witnesses)
        .filter(
            TimelineEvent.universe_id == universe_id,
            event_witnesses.c.character_id == character_id
        )
    )
    
    if before_universe_year is not None and before_universe_day is not None:
        stmt = stmt.filter(
            or_(
                TimelineEvent.universe_year.is_(None),
                (TimelineEvent.universe_year < before_universe_year),
                (
                    (TimelineEvent.universe_year == before_universe_year)
                    & (TimelineEvent.universe_day <= before_universe_day)
                ),
            )
        )
    
    stmt = stmt.order_by(TimelineEvent.sort_order, TimelineEvent.date_value)
    result = await db.execute(stmt)
    return list(result.unique().scalars().all())


async def get_timeline_events_by_heard(
    db: AsyncSession,
    universe_id: int,
    character_id: int,
    before_universe_year: Optional[int] = None,
    before_universe_day: Optional[int] = None,
) -> List[TimelineEvent]:
    """Получить события, о которых персонаж услышал"""
    stmt = (
        select(TimelineEvent)
        .options(
            selectinload(TimelineEvent.characters),
            selectinload(TimelineEvent.witness_characters),
            selectinload(TimelineEvent.heard_by_characters),
            selectinload(TimelineEvent.read_by_characters),
        )
        .join(event_heard_by)
        .filter(
            TimelineEvent.universe_id == universe_id,
            event_heard_by.c.character_id == character_id
        )
    )
    
    if before_universe_year is not None and before_universe_day is not None:
        stmt = stmt.filter(
            or_(
                TimelineEvent.universe_year.is_(None),
                (TimelineEvent.universe_year < before_universe_year),
                (
                    (TimelineEvent.universe_year == before_universe_year)
                    & (TimelineEvent.universe_day <= before_universe_day)
                ),
            )
        )
    
    stmt = stmt.order_by(TimelineEvent.sort_order, TimelineEvent.date_value)
    result = await db.execute(stmt)
    return list(result.unique().scalars().all())


async def get_timeline_events_by_read(
    db: AsyncSession,
    universe_id: int,
    character_id: int,
    before_universe_year: Optional[int] = None,
    before_universe_day: Optional[int] = None,
) -> List[TimelineEvent]:
    """Получить события, о которых персонаж прочитал"""
    stmt = (
        select(TimelineEvent)
        .options(
            selectinload(TimelineEvent.characters),
            selectinload(TimelineEvent.witness_characters),
            selectinload(TimelineEvent.heard_by_characters),
            selectinload(TimelineEvent.read_by_characters),
        )
        .join(event_read_by)
        .filter(
            TimelineEvent.universe_id == universe_id,
            event_read_by.c.character_id == character_id
        )
    )
    
    if before_universe_year is not None and before_universe_day is not None:
        stmt = stmt.filter(
            or_(
                TimelineEvent.universe_year.is_(None),
                (TimelineEvent.universe_year < before_universe_year),
                (
                    (TimelineEvent.universe_year == before_universe_year)
                    & (TimelineEvent.universe_day <= before_universe_day)
                ),
            )
        )
    
    stmt = stmt.order_by(TimelineEvent.sort_order, TimelineEvent.date_value)
    result = await db.execute(stmt)
    return list(result.unique().scalars().all())


async def get_timeline_stats(db: AsyncSession, universe_id: int) -> dict:
    """Получить статистику таймлайна"""
    total_result = await db.execute(select(func.count(TimelineEvent.id)).filter(TimelineEvent.universe_id == universe_id))
    total_events = total_result.scalar()
    
    events_by_type_result = await db.execute(
        select(
            TimelineEvent.event_type,
            func.count(TimelineEvent.id)
        ).filter(
            TimelineEvent.universe_id == universe_id
        ).group_by(TimelineEvent.event_type)
    )
    events_by_type = events_by_type_result.all()
    
    return {
        "total_events": total_events,
        "events_by_type": dict(events_by_type)
    }
