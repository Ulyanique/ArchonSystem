from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from typing import List, Optional
from app.models.space import Galaxy, StarSystem, CelestialBody
from app.schemas.space import GalaxyCreate, GalaxyUpdate, StarSystemCreate, StarSystemUpdate, CelestialBodyCreate, CelestialBodyUpdate
from app.repositories.universe import _touch_universe

# Galaxy
async def get_galaxies(db: AsyncSession, universe_id: int) -> List[Galaxy]:
    result = await db.execute(select(Galaxy).filter(Galaxy.universe_id == universe_id))
    return result.scalars().all()

async def get_galaxy(db: AsyncSession, galaxy_id: int) -> Optional[Galaxy]:
    result = await db.execute(select(Galaxy).filter(Galaxy.id == galaxy_id).options(selectinload(Galaxy.star_systems)))
    return result.scalars().first()

async def create_galaxy(db: AsyncSession, universe_id: int, galaxy: GalaxyCreate) -> Galaxy:
    db_galaxy = Galaxy(**galaxy.model_dump(), universe_id=universe_id)
    db.add(db_galaxy)
    await db.commit()
    await db.refresh(db_galaxy)
    await _touch_universe(universe_id)
    return db_galaxy

# StarSystem
async def get_star_systems(db: AsyncSession, galaxy_id: int) -> List[StarSystem]:
    result = await db.execute(select(StarSystem).filter(StarSystem.galaxy_id == galaxy_id))
    return result.scalars().all()

async def get_star_system(db: AsyncSession, system_id: int) -> Optional[StarSystem]:
    result = await db.execute(select(StarSystem).filter(StarSystem.id == system_id).options(selectinload(StarSystem.celestial_bodies)))
    return result.scalars().first()

async def create_star_system(db: AsyncSession, universe_id: int, system: StarSystemCreate) -> StarSystem:
    db_system = StarSystem(**system.model_dump(), universe_id=universe_id)
    db.add(db_system)
    await db.commit()
    await db.refresh(db_system)
    await _touch_universe(universe_id)
    return db_system

# CelestialBody
async def get_celestial_bodies(db: AsyncSession, system_id: int) -> List[CelestialBody]:
    result = await db.execute(select(CelestialBody).filter(CelestialBody.star_system_id == system_id))
    return result.scalars().all()

async def get_celestial_body(db: AsyncSession, body_id: int) -> Optional[CelestialBody]:
    result = await db.execute(select(CelestialBody).filter(CelestialBody.id == body_id))
    return result.scalars().first()

async def create_celestial_body(db: AsyncSession, universe_id: int, body: CelestialBodyCreate) -> CelestialBody:
    db_body = CelestialBody(**body.model_dump(), universe_id=universe_id)
    db.add(db_body)
    await db.commit()
    await db.refresh(db_body)
    await _touch_universe(universe_id)
    return db_body

async def update_celestial_body(db: AsyncSession, body_id: int, body: CelestialBodyUpdate) -> Optional[CelestialBody]:
    db_body = await get_celestial_body(db, body_id)
    if db_body:
        for key, value in body.model_dump(exclude_unset=True).items():
            setattr(db_body, key, value)
        await db.commit()
        await db.refresh(db_body)
        await _touch_universe(db_body.universe_id)
    return db_body
