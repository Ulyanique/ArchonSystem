from fastapi import APIRouter, Depends, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List
from app.database import get_master_db as get_db
from app.schemas import Universe, UniverseCreate, UniverseUpdate
from app.api import universes

router = APIRouter(prefix="/books", tags=["universes"])  # обратная совместимость

@router.get("", response_model=List[Universe])
async def list_books(skip: int = 0, limit: int = 100, db: AsyncSession = Depends(get_db)):
    """Получить список всех вселенных (обратная совместимость: /books)"""
    return await universes.list_universes(skip=skip, limit=limit, db=db)

@router.post("", response_model=Universe)
async def create_universe(book: UniverseCreate, db: AsyncSession = Depends(get_db)):
    """Создать вселенную (обратная совместимость)"""
    return await universes.create_universe(universe=book, db=db)

@router.get("/{universe_id}", response_model=Universe)
async def get_universe(universe_id: int, db: AsyncSession = Depends(get_db)):
    """Получить вселенную по ID (обратная совместимость)"""
    return await universes.get_universe(universe_id=universe_id, db=db)

@router.put("/{universe_id}", response_model=Universe)
async def update_universe(universe_id: int, book: UniverseUpdate, db: AsyncSession = Depends(get_db)):
    """Обновить вселенную (обратная совместимость)"""
    return await universes.update_universe(universe_id=universe_id, universe=book, db=db)

@router.delete("/{universe_id}")
async def delete_universe(universe_id: int, db: AsyncSession = Depends(get_db)):
    """Удалить вселенную (обратная совместимость)"""
    return await universes.delete_universe(universe_id=universe_id, db=db)

@router.post("/{universe_id}/cover", response_model=Universe)
async def upload_cover(universe_id: int, file: UploadFile = File(...), db: AsyncSession = Depends(get_db)):
    """Загрузить обложку (обратная совместимость)"""
    return await universes.upload_cover(universe_id=universe_id, file=file, db=db)

@router.delete("/{universe_id}/cover", response_model=Universe)
async def delete_cover(universe_id: int, db: AsyncSession = Depends(get_db)):
    """Удалить обложку (обратная совместимость)"""
    return await universes.delete_cover(universe_id=universe_id, db=db)
