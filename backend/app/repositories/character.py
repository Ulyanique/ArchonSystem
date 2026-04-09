from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List, Optional
from app.models import Character
from app.schemas import CharacterCreate, CharacterUpdate
from app.services.rag import rag_service
from app.repositories.universe import _touch_universe, _to_universe_id

async def get_characters(db: AsyncSession, universe_id: int) -> List[Character]:
    from sqlalchemy import text
    # Проверяем, существует ли таблица characters
    try:
        table_check = await db.execute(text("SELECT name FROM sqlite_master WHERE type='table' AND name='characters'"))
        table_exists = table_check.scalar() is not None
        
        if not table_exists:
            # Инициализируем базу данных вселенной
            from app.database import init_universe_db
            await init_universe_db(universe_id)
    except Exception:
        pass  # Игнорируем ошибки проверки таблицы
    
    result = await db.execute(select(Character).filter(Character.universe_id == universe_id))
    return result.scalars().all()

async def get_character(db: AsyncSession, character_id: int) -> Optional[Character]:
    result = await db.execute(select(Character).filter(Character.id == character_id))
    return result.scalars().first()

def character_alive_at_universe_time(character: Character, universe_year: int, universe_day: int) -> bool:
    """Проверить, жив ли персонаж в момент (год, день) во вселенной. Если даты не заданы — считаем живым."""
    by = getattr(character, "birth_universe_year", None)
    bd = getattr(character, "birth_universe_day", None)
    dy = getattr(character, "death_universe_year", None)
    dd = getattr(character, "death_universe_day", None)
    if by is not None and bd is not None:
        if universe_year < by or (universe_year == by and universe_day < bd):
            return False  # ещё не родился
    if dy is not None and dd is not None:
        if universe_year > dy or (universe_year == dy and universe_day > dd):
            return False  # уже умер
    return True

def character_age_at_universe_time(
    character: Character, universe_year: int, universe_day: int
) -> Optional[int]:
    """
    Возраст персонажа в полных годах на момент (год, день) во вселенной.
    Возвращает None, если дата рождения не задана в календаре вселенной.
    """
    by = getattr(character, "birth_universe_year", None)
    bd = getattr(character, "birth_universe_day", None)
    if by is None or bd is None:
        return None
    if universe_year < by or (universe_year == by and universe_day < bd):
        return None  # ещё не родился
    dy = getattr(character, "death_universe_year", None)
    dd = getattr(character, "death_universe_day", None)
    # Если уже умер — считаем возраст на момент смерти
    y, d = universe_year, universe_day
    if dy is not None and dd is not None:
        if y > dy or (y == dy and d > dd):
            y, d = dy, dd
    # Полных лет: год минус год рождения; если день в году ещё не наступил — минус 1
    age = y - by
    if (y == by and d < bd) or (y > by and d < bd):
        age -= 1
    return max(0, age)

async def create_character(db: AsyncSession, character: CharacterCreate) -> Character:
    data = _to_universe_id(character.model_dump())
    db_character = Character(**data)
    db.add(db_character)
    await db.commit()
    await db.refresh(db_character)
    await _touch_universe(db_character.universe_id)
    content = f"{character.description}\n{character.traits}\n{character.appearance}\n{character.backstory}"
    rag_service.add_document(
        universe_id=db_character.universe_id,
        doc_id=f"character_{db_character.id}",
        content=content.strip(),
        metadata={"type": "character", "title": character.name, "entity_type": "character", "entity_id": db_character.id}
    )
    return db_character

async def update_character(db: AsyncSession, character_id: int, character: CharacterUpdate) -> Optional[Character]:
    db_character = await get_character(db, character_id)
    if db_character:
        update_data = character.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(db_character, key, value)
        await db.commit()
        await db.refresh(db_character)
        await _touch_universe(db_character.universe_id)
        content = f"{db_character.description or ''}\n{db_character.traits or ''}\n{db_character.appearance or ''}\n{db_character.backstory or ''}"
        try:
            rag_service.add_document(
                universe_id=db_character.universe_id,
                doc_id=f"character_{db_character.id}",
                content=content.strip(),
                metadata={"type": "character", "title": (db_character.name or ""), "entity_type": "character", "entity_id": db_character.id}
            )
        except Exception:
            pass  # не ломаем сохранение персонажа при ошибке RAG
    return db_character

async def delete_character(db: AsyncSession, character_id: int) -> bool:
    db_character = await get_character(db, character_id)
    if db_character:
        universe_id = db_character.universe_id
        rag_service.remove_document(universe_id, f"character_{character_id}")
        await db.delete(db_character)
        await db.commit()
        await _touch_universe(universe_id)
        return True
    return False
