from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional
from pydantic import BaseModel
import json
from app.database import get_db, get_master_db
from app.services.ai_generator import ai_generator_service
from app.services import knowledge
from app.services import timeline as timeline_service

router = APIRouter(prefix="/universes/{universe_id}/ai-generate", tags=["ai-generate"])


class ApplyCharacterBody(BaseModel):
    character: dict  # name, description?, role?, traits?, appearance?, backstory?


class ApplyLocationBody(BaseModel):
    location: dict  # name, description?, location_type?, details?


class ApplyNoteBody(BaseModel):
    note: dict  # title, content?, note_type?


@router.get("/characters")
async def generate_characters(
    universe_id: int,
    genre: Optional[str] = None,
    count: int = Query(5, ge=1, le=10),
    db: AsyncSession = Depends(get_db),
    master_db: AsyncSession = Depends(get_master_db)
):
    """Сгенерировать идеи персонажей"""
    book = await knowledge.get_universe(universe_id, master_db)
    if not book:
        raise HTTPException(status_code=404, detail="Вселенная не найдена")
    
    genre = genre or book.genre or "фэнтези"
    return await ai_generator_service.generate_character_ideas(genre, count)

@router.post("/characters/contextual")
async def generate_contextual_character(
    universe_id: int,
    db: AsyncSession = Depends(get_db),
    master_db: AsyncSession = Depends(get_master_db)
):
    """Сгенерировать одного персонажа, максимально подходящего под контекст вселенной и заполняющего пробелы"""
    book = await knowledge.get_universe(universe_id, master_db)
    if not book:
        raise HTTPException(status_code=404, detail="Вселенная не найдена")
    
    # Получаем полный контекст вселенной
    from app.services.context_manager import context_manager
    context = await context_manager.build_context(db, universe_id, master_db=master_db)
    
    # Получаем существующих персонажей для анализа пробелов
    existing_characters = await knowledge.get_characters(db, universe_id)
    existing_chars_data = []
    for char in existing_characters:
        char_data = {
            "name": char.name,
            "role": char.role or "",
            "profession": getattr(char, "profession", None) or "",
            "description": char.description or "",
            "traits": char.traits or "",
        }
        existing_chars_data.append(char_data)
    
    result = await ai_generator_service.generate_contextual_character(context, existing_chars_data)
    
    if not result or not result.get('name'):
        raise HTTPException(status_code=500, detail="Не удалось сгенерировать персонажа")
    
    return result


@router.post("/characters/apply")
async def apply_character(universe_id: int, body: ApplyCharacterBody, db: AsyncSession = Depends(get_db), master_db: AsyncSession = Depends(get_master_db)):
    """Добавить выбранную идею персонажа в вселенную"""
    if not await knowledge.get_universe(universe_id, master_db):
        raise HTTPException(status_code=404, detail="Вселенная не найдена")
    c = body.character
    from app.schemas import CharacterCreate
    data = CharacterCreate(
        universe_id=universe_id,
        name=c.get("name", "Без имени"),
        description=c.get("description", "") or c.get("backstory", ""),
        role=c.get("role", ""),
        traits=c.get("traits", "") or c.get("trait", ""),
        appearance=c.get("appearance", ""),
        backstory=c.get("backstory", ""),
        # Демографические данные
        age=c.get("age"),
        gender=c.get("gender"),
        nationality=c.get("nationality"),
        birth_place=c.get("birth_place"),
        birth_date=c.get("birth_date"),
        death_date=c.get("death_date"),
        # Отношения
        relationships=c.get("relationships") if isinstance(c.get("relationships"), str) else (json.dumps(c.get("relationships")) if c.get("relationships") else None),
        # Навыки и способности
        profession=c.get("profession"),
        skills=c.get("skills"),
        abilities=c.get("abilities"),
        # Мотивация и цели
        goals=c.get("goals"),
        fears=c.get("fears"),
        conflicts=c.get("conflicts"),
        character_values=c.get("character_values"),
        # Речь и манеры
        speech_pattern=c.get("speech_pattern"),
        mannerisms=c.get("mannerisms"),
        habits=c.get("habits")
    )
    return await knowledge.create_character(db, data)

@router.get("/locations")
async def generate_locations(
    universe_id: int,
    genre: Optional[str] = None,
    count: int = Query(5, ge=1, le=10),
    db: AsyncSession = Depends(get_db),
    master_db: AsyncSession = Depends(get_master_db)
):
    """Сгенерировать идеи локаций"""
    book = await knowledge.get_universe(universe_id, master_db)
    if not book:
        raise HTTPException(status_code=404, detail="Вселенная не найдена")
    
    genre = genre or book.genre or "фэнтези"
    return await ai_generator_service.generate_location_ideas(genre, count)


@router.post("/locations/apply")
async def apply_location(universe_id: int, body: ApplyLocationBody, db: AsyncSession = Depends(get_db), master_db: AsyncSession = Depends(get_master_db)):
    """Добавить выбранную идею локации в вселенную"""
    if not await knowledge.get_universe(universe_id, master_db):
        raise HTTPException(status_code=404, detail="Вселенная не найдена")
    loc = body.location
    from app.schemas import LocationCreate
    data = LocationCreate(
        universe_id=universe_id,
        name=loc.get("name", "Без названия"),
        description=loc.get("description", ""),
        location_type=loc.get("location_type", "") or loc.get("type", ""),
        details=loc.get("details", "") or loc.get("secret", "")
    )
    return await knowledge.create_location(db, data)


def _build_notes_context(
    book,
    characters: list,
    locations: list,
    chapters: list,
    events: list,
    existing_notes: list,
) -> str:
    """Собрать текстовый контекст книги для генерации заметок."""
    parts = []
    parts.append(f"Название: {book.title or 'Без названия'}")
    if getattr(book, "description", None):
        parts.append(f"Описание: {book.description[:800]}")
    if getattr(book, "direction", None):
        parts.append(f"Направление/премиса: {book.direction[:600]}")
    if getattr(book, "genre", None):
        parts.append(f"Жанр: {book.genre}")
    if characters:
        names_roles = [f"{c.name}" + (f" ({c.role})" if getattr(c, "role", None) else "") for c in characters[:40]]
        parts.append("Персонажи: " + ", ".join(names_roles))
    if locations:
        names = [getattr(l, "name", str(l)) for l in locations[:30]]
        parts.append("Локации: " + ", ".join(names))
    if chapters:
        titles = [getattr(c, "title", str(c)) for c in chapters[:25]]
        parts.append("Главы: " + " | ".join(titles[:15]))
    if events:
        event_lines = []
        for e in events[:25]:
            title = getattr(e, "title", None) or getattr(e, "date_value", "")
            desc = (getattr(e, "description", None) or "")[:80]
            event_lines.append(f"- {title}" + (f": {desc}" if desc else ""))
        parts.append("События таймлайна:\n" + "\n".join(event_lines))
    if existing_notes:
        note_preview = [f"{getattr(n, 'title', '')} ({getattr(n, 'note_type', '')})" for n in existing_notes[:20]]
        parts.append("Уже есть заметки: " + "; ".join(note_preview))
    return "\n\n".join(parts)


@router.get("/notes")
async def generate_notes(
    universe_id: int,
    genre: Optional[str] = None,
    direction: Optional[str] = None,
    count: int = Query(5, ge=1, le=10),
    db: AsyncSession = Depends(get_db),
    master_db: AsyncSession = Depends(get_master_db)
):
    """Сгенерировать идеи заметок на основе контекста всей книги."""
    book = await knowledge.get_universe(universe_id, master_db)
    if not book:
        raise HTTPException(status_code=404, detail="Вселенная не найдена")
    genre = genre or getattr(book, "genre", None) or "фэнтези"
    direction = direction or getattr(book, "direction", None) or ""

    characters = await knowledge.get_characters(db, universe_id)
    locations = await knowledge.get_locations(db, universe_id)
    chapters = await knowledge.get_chapters(db, universe_id)
    events = await timeline_service.get_timeline_events(db, universe_id)
    existing_notes = await knowledge.get_notes(db, universe_id)

    book_context = _build_notes_context(book, characters, locations, chapters, events, existing_notes)

    return await ai_generator_service.generate_note_ideas(
        genre=genre,
        direction=direction,
        count=count,
        book_context=book_context,
    )


@router.post("/notes/apply")
async def apply_note(universe_id: int, body: ApplyNoteBody, db: AsyncSession = Depends(get_db), master_db: AsyncSession = Depends(get_master_db)):
    """Добавить выбранную заметку в вселенную"""
    if not await knowledge.get_universe(universe_id, master_db):
        raise HTTPException(status_code=404, detail="Вселенная не найдена")
    n = body.note
    from app.schemas import NoteCreate
    data = NoteCreate(
        universe_id=universe_id,
        title=n.get("title", "Заметка"),
        content=n.get("content", ""),
        note_type=n.get("note_type", "idea") or "idea"
    )
    return await knowledge.create_note(db, data)


@router.post("/plot-twist")
async def generate_plot_twist(
    universe_id: int,
    context: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    master_db: AsyncSession = Depends(get_master_db)
):
    """Сгенерировать поворот сюжета"""
    book = await knowledge.get_universe(universe_id, master_db)
    if not book:
        raise HTTPException(status_code=404, detail="Вселенная не найдена")
    
    genre = book.genre or "фэнтези"
    return await ai_generator_service.generate_plot_twist(genre, context or book.description)

@router.post("/chapter-summary/{chapter_number}")
async def generate_chapter_summary(
    universe_id: int,
    chapter_number: int,
    previous_summary: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    master_db: AsyncSession = Depends(get_master_db)
):
    """Сгенерировать краткое содержание главы"""
    book = await knowledge.get_universe(universe_id, master_db)
    if not book:
        raise HTTPException(status_code=404, detail="Вселенная не найдена")
    
    genre = book.genre or "фэнтези"
    return await ai_generator_service.generate_chapter_summary(
        chapter_number,
        previous_summary or "",
        genre
    )

@router.get("/name")
async def generate_name(
    universe_id: int,
    character_type: str = Query("герой", description="Тип персонажа"),
    db: AsyncSession = Depends(get_db),
    master_db: AsyncSession = Depends(get_master_db)
):
    """Сгенерировать имя персонажа"""
    book = await knowledge.get_universe(universe_id, master_db)
    if not book:
        raise HTTPException(status_code=404, detail="Вселенная не найдена")
    
    genre = book.genre or "фэнтези"
    name = await ai_generator_service.generate_name(genre, character_type)
    return {"name": name}

@router.post("/description")
async def generate_description(
    universe_id: int,
    subject: str = Query(..., description="Что описать"),
    context: Optional[str] = None,
    length: str = Query("medium", description="Длина: short, medium, long"),
    db: AsyncSession = Depends(get_db)
):
    """Сгенерировать описание"""
    return {
        "description": await ai_generator_service.generate_description(subject, context, length)
    }

@router.get("/factions")
async def generate_factions(
    universe_id: int,
    genre: Optional[str] = None,
    count: int = Query(5, ge=1, le=10),
    db: AsyncSession = Depends(get_db),
    master_db: AsyncSession = Depends(get_master_db)
):
    """Сгенерировать идеи фракций"""
    book = await knowledge.get_universe(universe_id, master_db)
    if not book:
        raise HTTPException(status_code=404, detail="Вселенная не найдена")
    
    genre = genre or book.genre or "фэнтези"
    
    # Получаем контекст вселенной
    from app.services.context_manager import context_manager
    context = await context_manager.build_context(db, universe_id, master_db=master_db)
    
    # Получаем существующие фракции
    from app.repositories import faction as faction_repo
    existing_factions_list = await faction_repo.get_factions(db, universe_id)
    existing_factions = [
        {
            "name": f.name,
            "faction_type": f.faction_type or "",
        }
        for f in existing_factions_list[:15]
    ]
    
    return await ai_generator_service.generate_faction_ideas(
        genre, context, existing_factions, count
    )

@router.post("/factions/single")
async def generate_single_faction(
    universe_id: int,
    db: AsyncSession = Depends(get_db),
    master_db: AsyncSession = Depends(get_master_db)
):
    """Сгенерировать одну фракцию, максимально подходящую под контекст вселенной и заполняющую пробелы"""
    book = await knowledge.get_universe(universe_id, master_db)
    if not book:
        raise HTTPException(status_code=404, detail="Вселенная не найдена")
    
    genre = book.genre or "фэнтези"
    
    # Получаем полный контекст вселенной
    from app.services.context_manager import context_manager
    context = await context_manager.build_context(db, universe_id, master_db=master_db)
    
    # Получаем существующие фракции для анализа пробелов
    from app.repositories import faction as faction_repo
    existing_factions_list = await faction_repo.get_factions(db, universe_id)
    existing_factions = [
        {
            "name": f.name,
            "faction_type": f.faction_type or "",
        }
        for f in existing_factions_list[:15]
    ]
    
    result = await ai_generator_service.generate_single_faction(
        genre, context, existing_factions
    )
    
    if not result or not result.get('name'):
        raise HTTPException(status_code=500, detail="Не удалось сгенерировать фракцию")
    
    return result

@router.get("/timeline-events")
async def generate_timeline_events(
    universe_id: int,
    count: int = Query(5, ge=1, le=10),
    db: AsyncSession = Depends(get_db),
    master_db: AsyncSession = Depends(get_master_db)
):
    """Сгенерировать идеи событий для таймлайна"""
    book = await knowledge.get_universe(universe_id, master_db)
    if not book:
        raise HTTPException(status_code=404, detail="Вселенная не найдена")
    
    # Получаем текущее время вселенной
    from app.services.time_service import time_service
    current_time = time_service.get_current_universe_time(book)
    current_year = current_time.get("year", 2026)
    current_day = current_time.get("day", 1)
    epoch = current_time.get("epoch", "н.э.")
    
    # Получаем контекст вселенной
    from app.services.context_manager import context_manager
    context = await context_manager.build_context(db, universe_id, master_db=master_db)
    
    # Получаем существующие события с более детальной информацией
    from app.services import timeline as timeline_service
    existing_events_list = await timeline_service.get_timeline_events(db, universe_id)
    existing_events = []
    for e in existing_events_list[:15]:  # Ограничиваем для контекста
        event_data = {
            "title": e.title,
            "description": e.description or "",
            "event_type": e.event_type,
            "date_value": e.date_value,
            "universe_year": e.universe_year,
            "universe_day": e.universe_day,
        }
        # Добавляем информацию о персонажах события
        if hasattr(e, 'characters') and e.characters:
            event_data["characters"] = [c.name for c in e.characters[:5]]
        existing_events.append(event_data)
    
    # Получаем персонажей с более детальной информацией
    characters_list = await knowledge.get_characters(db, universe_id)
    characters = []
    for c in characters_list[:20]:
        char_data = {
            "name": c.name,
            "role": c.role or "",
        }
        # Добавляем описание и черты для более конкретных событий
        if c.description:
            char_data["description"] = c.description[:200]  # Ограничиваем длину
        if c.traits:
            char_data["traits"] = c.traits[:150]
        characters.append(char_data)
    
    # Получаем локации с описаниями
    locations_list = await knowledge.get_locations(db, universe_id)
    locations = []
    for l in locations_list[:15]:
        loc_data = {
            "name": l.name,
        }
        # Добавляем описание локации
        if l.description:
            loc_data["description"] = l.description[:200]
        elif hasattr(l, 'details') and l.details:
            loc_data["description"] = l.details[:200]
        locations.append(loc_data)
    
    return await ai_generator_service.generate_timeline_events(
        context, existing_events, characters, locations, count, current_year, current_day, epoch
    )

@router.post("/timeline-events/single")
async def generate_single_timeline_event(
    universe_id: int,
    db: AsyncSession = Depends(get_db),
    master_db: AsyncSession = Depends(get_master_db)
):
    """Сгенерировать одно событие для таймлайна, максимально подходящее под контекст вселенной"""
    book = await knowledge.get_universe(universe_id, master_db)
    if not book:
        raise HTTPException(status_code=404, detail="Вселенная не найдена")
    
    # Получаем текущее время вселенной
    from app.services.time_service import time_service
    current_time = time_service.get_current_universe_time(book)
    current_year = current_time.get("year", 2026)
    current_day = current_time.get("day", 1)
    epoch = current_time.get("epoch", "н.э.")
    
    # Получаем контекст вселенной
    from app.services.context_manager import context_manager
    context = await context_manager.build_context(db, universe_id, master_db=master_db)
    
    # Получаем существующие события с более детальной информацией
    from app.services import timeline as timeline_service
    existing_events_list = await timeline_service.get_timeline_events(db, universe_id)
    existing_events = []
    for e in existing_events_list[:15]:  # Ограничиваем для контекста
        event_data = {
            "title": e.title,
            "description": e.description or "",
            "event_type": e.event_type,
            "date_value": e.date_value,
            "universe_year": e.universe_year,
            "universe_day": e.universe_day,
        }
        # Добавляем информацию о персонажах события
        if hasattr(e, 'characters') and e.characters:
            event_data["characters"] = [c.name for c in e.characters[:5]]
        existing_events.append(event_data)
    
    # Получаем персонажей с более детальной информацией
    characters_list = await knowledge.get_characters(db, universe_id)
    characters = []
    for c in characters_list[:20]:
        char_data = {
            "name": c.name,
            "role": c.role or "",
        }
        # Добавляем описание и черты для более конкретных событий
        if c.description:
            char_data["description"] = c.description[:200]  # Ограничиваем длину
        if c.traits:
            char_data["traits"] = c.traits[:150]
        characters.append(char_data)
    
    # Получаем локации с описаниями
    locations_list = await knowledge.get_locations(db, universe_id)
    locations = []
    for l in locations_list[:15]:
        loc_data = {
            "name": l.name,
        }
        # Добавляем описание локации
        if l.description:
            loc_data["description"] = l.description[:200]
        elif hasattr(l, 'details') and l.details:
            loc_data["description"] = l.details[:200]
        locations.append(loc_data)
    
    result = await ai_generator_service.generate_single_timeline_event(
        context, existing_events, characters, locations, current_year, current_day, epoch
    )
    
    if not result or not result.get('title'):
        raise HTTPException(status_code=500, detail="Не удалось сгенерировать событие")
    
    return result
