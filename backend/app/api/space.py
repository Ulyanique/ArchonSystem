from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List
from app.database import get_db
from app.schemas.space import GalaxySchema, GalaxyCreate, StarSystemSchema, StarSystemCreate, CelestialBodySchema, CelestialBodyCreate, CelestialBodyUpdate
from app.repositories import space as space_repo

router = APIRouter(prefix="/universes/{universe_id}/space", tags=["space"])

# Galaxies
@router.get("/galaxies", response_model=List[GalaxySchema])
async def list_galaxies(universe_id: int, db: AsyncSession = Depends(get_db)):
    return await space_repo.get_galaxies(db, universe_id)

@router.post("/galaxies", response_model=GalaxySchema)
async def create_galaxy(universe_id: int, galaxy: GalaxyCreate, db: AsyncSession = Depends(get_db)):
    return await space_repo.create_galaxy(db, universe_id, galaxy)

@router.get("/galaxies/{galaxy_id}", response_model=GalaxySchema)
async def get_galaxy(universe_id: int, galaxy_id: int, db: AsyncSession = Depends(get_db)):
    db_galaxy = await space_repo.get_galaxy(db, galaxy_id)
    if not db_galaxy or db_galaxy.universe_id != universe_id:
        raise HTTPException(status_code=404, detail="Галактика не найдена")
    return db_galaxy

# Star Systems
@router.get("/galaxies/{galaxy_id}/systems", response_model=List[StarSystemSchema])
async def list_star_systems(universe_id: int, galaxy_id: int, db: AsyncSession = Depends(get_db)):
    return await space_repo.get_star_systems(db, galaxy_id)

@router.post("/systems", response_model=StarSystemSchema)
async def create_star_system(universe_id: int, system: StarSystemCreate, db: AsyncSession = Depends(get_db)):
    return await space_repo.create_star_system(db, universe_id, system)

@router.get("/systems/{system_id}", response_model=StarSystemSchema)
async def get_star_system(universe_id: int, system_id: int, db: AsyncSession = Depends(get_db)):
    db_system = await space_repo.get_star_system(db, system_id)
    if not db_system or db_system.universe_id != universe_id:
        raise HTTPException(status_code=404, detail="Система не найдена")
    return db_system

# Celestial Bodies
@router.get("/systems/{system_id}/bodies", response_model=List[CelestialBodySchema])
async def list_celestial_bodies(universe_id: int, system_id: int, db: AsyncSession = Depends(get_db)):
    return await space_repo.get_celestial_bodies(db, system_id)

@router.post("/bodies", response_model=CelestialBodySchema)
async def create_celestial_body(universe_id: int, body: CelestialBodyCreate, db: AsyncSession = Depends(get_db)):
    return await space_repo.create_celestial_body(db, universe_id, body)

@router.get("/bodies/{body_id}", response_model=CelestialBodySchema)
async def get_celestial_body(universe_id: int, body_id: int, db: AsyncSession = Depends(get_db)):
    db_body = await space_repo.get_celestial_body(db, body_id)
    if not db_body or db_body.universe_id != universe_id:
        raise HTTPException(status_code=404, detail="Объект не найден")
    return db_body

@router.put("/bodies/{body_id}", response_model=CelestialBodySchema)
async def update_celestial_body(universe_id: int, body_id: int, body: CelestialBodyUpdate, db: AsyncSession = Depends(get_db)):
    db_body = await space_repo.update_celestial_body(db, body_id, body)
    if not db_body or db_body.universe_id != universe_id:
        raise HTTPException(status_code=404, detail="Объект не найден")
    return db_body
