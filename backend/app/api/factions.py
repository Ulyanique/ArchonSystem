from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List
from app.database import get_db
from app.schemas.faction import FactionSchema, FactionCreate, FactionUpdate
from app.repositories import faction as faction_repo

router = APIRouter(prefix="/universes/{universe_id}/factions", tags=["factions"])

@router.get("", response_model=List[FactionSchema])
async def list_factions(universe_id: int, db: AsyncSession = Depends(get_db)):
    return await faction_repo.get_factions(db, universe_id)

@router.post("", response_model=FactionSchema)
async def create_faction(universe_id: int, faction: FactionCreate, db: AsyncSession = Depends(get_db)):
    return await faction_repo.create_faction(db, universe_id, faction)

@router.get("/{faction_id}", response_model=FactionSchema)
async def get_faction(universe_id: int, faction_id: int, db: AsyncSession = Depends(get_db)):
    db_faction = await faction_repo.get_faction(db, faction_id)
    if not db_faction or db_faction.universe_id != universe_id:
        raise HTTPException(status_code=404, detail="Фракция не найдена")
    return db_faction

@router.put("/{faction_id}", response_model=FactionSchema)
async def update_faction(universe_id: int, faction_id: int, faction: FactionUpdate, db: AsyncSession = Depends(get_db)):
    db_faction = await faction_repo.update_faction(db, faction_id, faction)
    if not db_faction or db_faction.universe_id != universe_id:
        raise HTTPException(status_code=404, detail="Фракция не найдена")
    return db_faction

@router.delete("/{faction_id}")
async def delete_faction(universe_id: int, faction_id: int, db: AsyncSession = Depends(get_db)):
    success = await faction_repo.delete_faction(db, faction_id)
    if not success:
        raise HTTPException(status_code=404, detail="Фракция не найдена")
    return {"message": "Фракция удалена"}
