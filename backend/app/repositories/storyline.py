from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List, Optional
from app.models import Storyline
from app.schemas import StorylineCreate, StorylineUpdate
from app.repositories.universe import _touch_universe, _to_universe_id


async def get_storylines(db: AsyncSession, universe_id: int) -> List[Storyline]:
    result = await db.execute(
        select(Storyline)
        .filter(Storyline.universe_id == universe_id)
        .order_by(Storyline.sort_order, Storyline.id)
    )
    return list(result.scalars().all())


async def get_storyline(db: AsyncSession, storyline_id: int) -> Optional[Storyline]:
    result = await db.execute(select(Storyline).filter(Storyline.id == storyline_id))
    return result.scalars().first()


async def create_storyline(db: AsyncSession, storyline: StorylineCreate, universe_id: int) -> Storyline:
    data = storyline.model_dump(exclude={"universe_id"})
    data["universe_id"] = universe_id
    db_storyline = Storyline(**data)
    db.add(db_storyline)
    await db.commit()
    await db.refresh(db_storyline)
    await _touch_universe(universe_id)
    return db_storyline


async def update_storyline(
    db: AsyncSession, storyline_id: int, storyline: StorylineUpdate
) -> Optional[Storyline]:
    db_storyline = await get_storyline(db, storyline_id)
    if not db_storyline:
        return None
    update_data = storyline.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_storyline, key, value)
    await db.commit()
    await db.refresh(db_storyline)
    await _touch_universe(db_storyline.universe_id)
    return db_storyline


async def delete_storyline(db: AsyncSession, storyline_id: int) -> bool:
    from sqlalchemy import update
    from app.models import Chapter

    db_storyline = await get_storyline(db, storyline_id)
    if not db_storyline:
        return False
    universe_id = db_storyline.universe_id
    await db.execute(update(Chapter).where(Chapter.storyline_id == storyline_id).values(storyline_id=None))
    await db.delete(db_storyline)
    await db.commit()
    await _touch_universe(universe_id)
    return True
