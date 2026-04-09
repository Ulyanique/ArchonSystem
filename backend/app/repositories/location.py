from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List, Optional
from app.models import Location
from app.schemas import LocationCreate, LocationUpdate
from app.services.rag import rag_service
from app.repositories.universe import _touch_universe, _to_universe_id

async def get_locations(db: AsyncSession, universe_id: int) -> List[Location]:
    result = await db.execute(select(Location).filter(Location.universe_id == universe_id))
    return result.scalars().all()

async def get_location(db: AsyncSession, location_id: int) -> Optional[Location]:
    result = await db.execute(select(Location).filter(Location.id == location_id))
    return result.scalars().first()

async def create_location(db: AsyncSession, location: LocationCreate) -> Location:
    data = _to_universe_id(location.model_dump())
    db_location = Location(**data)
    db.add(db_location)
    await db.commit()
    await db.refresh(db_location)
    await _touch_universe(db_location.universe_id)
    content = f"{location.description}\n{location.details}"
    rag_service.add_document(
        universe_id=db_location.universe_id,
        doc_id=f"location_{db_location.id}",
        content=content.strip(),
        metadata={"type": "location", "title": location.name, "entity_type": "location", "entity_id": db_location.id}
    )
    return db_location

async def update_location(db: AsyncSession, location_id: int, location: LocationUpdate) -> Optional[Location]:
    db_location = await get_location(db, location_id)
    if db_location:
        update_data = location.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(db_location, key, value)
        await db.commit()
        await db.refresh(db_location)
        await _touch_universe(db_location.universe_id)
        content = f"{db_location.description}\n{db_location.details}"
        rag_service.add_document(
            universe_id=db_location.universe_id,
            doc_id=f"location_{db_location.id}",
            content=content.strip(),
            metadata={"type": "location", "title": db_location.name, "entity_type": "location", "entity_id": db_location.id}
        )
    return db_location

async def delete_location(db: AsyncSession, location_id: int) -> bool:
    db_location = await get_location(db, location_id)
    if db_location:
        universe_id = db_location.universe_id
        rag_service.remove_document(universe_id, f"location_{location_id}")
        await db.delete(db_location)
        await db.commit()
        await _touch_universe(universe_id)
        return True
    return False
