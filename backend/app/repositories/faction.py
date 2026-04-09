from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List, Optional
from app.models.faction import Faction
from app.schemas.faction import FactionCreate, FactionUpdate
from app.repositories.universe import _touch_universe

async def get_factions(db: AsyncSession, universe_id: int) -> List[Faction]:
    result = await db.execute(select(Faction).filter(Faction.universe_id == universe_id))
    return result.scalars().all()

async def get_faction(db: AsyncSession, faction_id: int) -> Optional[Faction]:
    result = await db.execute(select(Faction).filter(Faction.id == faction_id))
    return result.scalars().first()

async def create_faction(db: AsyncSession, universe_id: int, faction: FactionCreate) -> Faction:
    db_faction = Faction(**faction.model_dump(), universe_id=universe_id)
    db.add(db_faction)
    await db.commit()
    await db.refresh(db_faction)
    await _touch_universe(universe_id)
    return db_faction

async def update_faction(db: AsyncSession, faction_id: int, faction: FactionUpdate) -> Optional[Faction]:
    db_faction = await get_faction(db, faction_id)
    if db_faction:
        update_data = faction.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(db_faction, key, value)
        await db.commit()
        await db.refresh(db_faction)
        await _touch_universe(db_faction.universe_id)
    return db_faction

async def delete_faction(db: AsyncSession, faction_id: int) -> bool:
    db_faction = await get_faction(db, faction_id)
    if db_faction:
        universe_id = db_faction.universe_id
        await db.delete(db_faction)
        await db.commit()
        await _touch_universe(universe_id)
        return True
    return False
