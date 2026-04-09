from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List

from app.database import get_db, get_master_db
from app.schemas import Storyline, StorylineCreate, StorylineUpdate
from app.services import knowledge

router = APIRouter(prefix="/universes/{universe_id}/storylines", tags=["storylines"])


@router.get("", response_model=List[Storyline])
async def list_storylines(
    universe_id: int,
    db: AsyncSession = Depends(get_db),
    master_db: AsyncSession = Depends(get_master_db),
):
    """Получить все сюжетные линии вселенной."""
    if not await knowledge.get_universe(universe_id, master_db):
        raise HTTPException(status_code=404, detail="Вселенная не найдена")
    from app.repositories import storyline as repo
    return await repo.get_storylines(db, universe_id)


@router.post("", response_model=Storyline)
async def create_storyline(
    universe_id: int,
    body: StorylineCreate,
    db: AsyncSession = Depends(get_db),
    master_db: AsyncSession = Depends(get_master_db),
):
    """Создать сюжетную линию."""
    if not await knowledge.get_universe(universe_id, master_db):
        raise HTTPException(status_code=404, detail="Вселенная не найдена")
    from app.repositories import storyline as repo
    return await repo.create_storyline(db, body, universe_id)


@router.get("/{storyline_id}", response_model=Storyline)
async def get_storyline(
    universe_id: int,
    storyline_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Получить сюжетную линию по ID."""
    from app.repositories import storyline as repo
    sl = await repo.get_storyline(db, storyline_id)
    if not sl or sl.universe_id != universe_id:
        raise HTTPException(status_code=404, detail="Сюжетная линия не найдена")
    return sl


@router.put("/{storyline_id}", response_model=Storyline)
async def update_storyline(
    universe_id: int,
    storyline_id: int,
    body: StorylineUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Обновить сюжетную линию."""
    from app.repositories import storyline as repo
    sl = await repo.get_storyline(db, storyline_id)
    if not sl or sl.universe_id != universe_id:
        raise HTTPException(status_code=404, detail="Сюжетная линия не найдена")
    updated = await repo.update_storyline(db, storyline_id, body)
    return updated


@router.delete("/{storyline_id}")
async def delete_storyline(
    universe_id: int,
    storyline_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Удалить сюжетную линию. Главы с этой линией останутся, storyline_id станет null (при обновлении схемы)."""
    from app.repositories import storyline as repo
    sl = await repo.get_storyline(db, storyline_id)
    if not sl or sl.universe_id != universe_id:
        raise HTTPException(status_code=404, detail="Сюжетная линия не найдена")
    await repo.delete_storyline(db, storyline_id)
    return {"message": "Сюжетная линия удалена"}
