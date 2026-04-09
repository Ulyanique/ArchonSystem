from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db, get_master_db
from app.services import knowledge
from app.services.search import SearchService

router = APIRouter(prefix="/universes/{universe_id}/search", tags=["search"])

@router.get("")
async def search(
    universe_id: int,
    q: str = Query(..., min_length=1, description="Поисковый запрос"),
    limit: int = Query(20, ge=1, le=100, description="Максимальное количество результатов"),
    db: AsyncSession = Depends(get_db),
    master_db: AsyncSession = Depends(get_master_db)
):
    """Умный поиск по всем элементам вселенной"""
    if not await knowledge.get_universe(universe_id, master_db):
        raise HTTPException(status_code=404, detail="Вселенная не найдена")
    
    search_service = SearchService(db, universe_id)
    results = await search_service.search(q, limit)
    
    return results

@router.get("/quick")
async def quick_search(
    universe_id: int,
    q: str = Query(..., min_length=1),
    db: AsyncSession = Depends(get_db),
    master_db: AsyncSession = Depends(get_master_db)
):
    """Быстрый поиск: та же структура, что и полный поиск (limit=5 по категориям), для Command Palette и превью."""
    if not await knowledge.get_universe(universe_id, master_db):
        raise HTTPException(status_code=404, detail="Вселенная не найдена")
    search_service = SearchService(db, universe_id)
    return await search_service.search(q, limit=5)
