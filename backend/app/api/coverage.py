"""API покрытия мира по главам — какие сущности в каких главах фигурируют (для НФ)."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List
from pydantic import BaseModel

from app.database import get_db, get_master_db
from app.services import knowledge
from app.repositories.chapter_mention import ENTITY_TYPES

router = APIRouter(prefix="/universes/{universe_id}/coverage", tags=["coverage"])


class MentionBody(BaseModel):
    entity_type: str
    entity_id: int


@router.get("")
async def get_coverage(
    universe_id: int,
    db: AsyncSession = Depends(get_db),
    master_db: AsyncSession = Depends(get_master_db),
):
    """Статистика покрытия: главы с упоминаниями, сущности по главам, неиспользованные сущности."""
    if not await knowledge.get_universe(universe_id, master_db):
        raise HTTPException(status_code=404, detail="Вселенная не найдена")
    return await knowledge.get_coverage_stats(db, universe_id)


@router.get("/chapters/{chapter_id}/mentions")
async def list_chapter_mentions(
    universe_id: int,
    chapter_id: int,
    db: AsyncSession = Depends(get_db),
    master_db: AsyncSession = Depends(get_master_db),
):
    """Список упоминаний сущностей в главе."""
    if not await knowledge.get_universe(universe_id, master_db):
        raise HTTPException(status_code=404, detail="Вселенная не найдена")
    chapter = await knowledge.get_chapter(db, chapter_id)
    if not chapter or chapter.universe_id != universe_id:
        raise HTTPException(status_code=404, detail="Глава не найдена")
    mentions = await knowledge.get_mentions_for_chapter(db, chapter_id)
    return [{"entity_type": m.entity_type, "entity_id": m.entity_id} for m in mentions]


@router.post("/chapters/{chapter_id}/mentions", status_code=201)
async def add_chapter_mention(
    universe_id: int,
    chapter_id: int,
    body: MentionBody,
    db: AsyncSession = Depends(get_db),
    master_db: AsyncSession = Depends(get_master_db),
):
    """Добавить упоминание сущности в главе."""
    if not await knowledge.get_universe(universe_id, master_db):
        raise HTTPException(status_code=404, detail="Вселенная не найдена")
    chapter = await knowledge.get_chapter(db, chapter_id)
    if not chapter or chapter.universe_id != universe_id:
        raise HTTPException(status_code=404, detail="Глава не найдена")
    if body.entity_type not in ENTITY_TYPES:
        raise HTTPException(status_code=400, detail=f"entity_type должен быть один из: {ENTITY_TYPES}")
    mention = await knowledge.add_chapter_mention(db, chapter_id, body.entity_type, body.entity_id)
    return {"entity_type": mention.entity_type, "entity_id": mention.entity_id}


@router.delete("/chapters/{chapter_id}/mentions/{entity_type}/{entity_id}")
async def delete_chapter_mention(
    universe_id: int,
    chapter_id: int,
    entity_type: str,
    entity_id: int,
    db: AsyncSession = Depends(get_db),
    master_db: AsyncSession = Depends(get_master_db),
):
    """Удалить упоминание сущности в главе."""
    if not await knowledge.get_universe(universe_id, master_db):
        raise HTTPException(status_code=404, detail="Вселенная не найдена")
    chapter = await knowledge.get_chapter(db, chapter_id)
    if not chapter or chapter.universe_id != universe_id:
        raise HTTPException(status_code=404, detail="Глава не найдена")
    ok = await knowledge.remove_chapter_mention(db, chapter_id, entity_type, entity_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Упоминание не найдено")
    return {"message": "Упоминание удалено"}
