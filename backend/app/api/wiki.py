from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List
from app.database import get_db, get_master_db
from app.schemas import WikiArticle, WikiArticleCreate, WikiArticleUpdate
from app.services import knowledge
from app.services.ai_generator import ai_generator_service

router = APIRouter(prefix="/universes/{universe_id}/wiki", tags=["wiki"])


@router.get("", response_model=List[WikiArticle])
async def list_wiki_articles(universe_id: int, db: AsyncSession = Depends(get_db), master_db: AsyncSession = Depends(get_master_db)):
    """Список статей вики вселенной."""
    if not await knowledge.get_universe(universe_id, master_db):
        raise HTTPException(status_code=404, detail="Вселенная не найдена")
    return await knowledge.get_wiki_articles(db, universe_id)


@router.get("/slug/{slug}", response_model=WikiArticle)
async def get_wiki_article_by_slug(universe_id: int, slug: str, db: AsyncSession = Depends(get_db), master_db: AsyncSession = Depends(get_master_db)):
    """Получить статью по slug."""
    if not await knowledge.get_universe(universe_id, master_db):
        raise HTTPException(status_code=404, detail="Вселенная не найдена")
    article = await knowledge.get_wiki_article_by_slug(db, universe_id, slug)
    if not article:
        raise HTTPException(status_code=404, detail="Статья не найдена")
    return article


@router.get("/{article_id}", response_model=WikiArticle)
async def get_wiki_article(universe_id: int, article_id: int, db: AsyncSession = Depends(get_db), master_db: AsyncSession = Depends(get_master_db)):
    """Получить статью по ID."""
    if not await knowledge.get_universe(universe_id, master_db):
        raise HTTPException(status_code=404, detail="Вселенная не найдена")
    article = await knowledge.get_wiki_article(db, article_id)
    if not article or article.universe_id != universe_id:
        raise HTTPException(status_code=404, detail="Статья не найдена")
    return article


@router.post("", response_model=WikiArticle)
async def create_wiki_article(universe_id: int, article: WikiArticleCreate, db: AsyncSession = Depends(get_db), master_db: AsyncSession = Depends(get_master_db)):
    """Создать статью вики."""
    if not await knowledge.get_universe(universe_id, master_db):
        raise HTTPException(status_code=404, detail="Вселенная не найдена")
    return await knowledge.create_wiki_article(db, universe_id, article)


@router.put("/{article_id}", response_model=WikiArticle)
async def update_wiki_article(
    universe_id: int, article_id: int, article: WikiArticleUpdate, db: AsyncSession = Depends(get_db), master_db: AsyncSession = Depends(get_master_db)
):
    """Обновить статью."""
    if not await knowledge.get_universe(universe_id, master_db):
        raise HTTPException(status_code=404, detail="Вселенная не найдена")
    updated = await knowledge.update_wiki_article(db, article_id, article)
    if not updated or updated.universe_id != universe_id:
        raise HTTPException(status_code=404, detail="Статья не найдена")
    return updated


@router.delete("/{article_id}")
async def delete_wiki_article(universe_id: int, article_id: int, db: AsyncSession = Depends(get_db), master_db: AsyncSession = Depends(get_master_db)):
    """Удалить статью."""
    if not await knowledge.get_universe(universe_id, master_db):
        raise HTTPException(status_code=404, detail="Вселенная не найдена")
    existing = await knowledge.get_wiki_article(db, article_id)
    if not existing or existing.universe_id != universe_id:
        raise HTTPException(status_code=404, detail="Статья не найдена")
    await knowledge.delete_wiki_article(db, article_id)
    return {"message": "Статья удалена"}


@router.post("/generate/{entity_type}/{entity_id}", response_model=WikiArticle)
async def generate_wiki_article(
    universe_id: int,
    entity_type: str,
    entity_id: int,
    db: AsyncSession = Depends(get_db),
    master_db: AsyncSession = Depends(get_master_db),
):
    """Автогенерация статьи вики по сущности (character, location, event)."""
    if entity_type not in ("character", "location", "event"):
        raise HTTPException(status_code=400, detail="entity_type: character, location или event")
    if not await knowledge.get_universe(universe_id, master_db):
        raise HTTPException(status_code=404, detail="Вселенная не найдена")

    book = await knowledge.get_universe(universe_id, master_db)
    entity_data = {}
    title = ""

    if entity_type == "character":
        char = await knowledge.get_character(db, entity_id)
        if not char or char.universe_id != universe_id:
            raise HTTPException(status_code=404, detail="Персонаж не найден")
        entity_data = {
            "name": char.name,
            "description": char.description,
            "role": char.role,
            "traits": char.traits,
            "appearance": char.appearance,
            "backstory": char.backstory,
        }
        title = char.name
    elif entity_type == "location":
        loc = await knowledge.get_location(db, entity_id)
        if not loc or loc.universe_id != universe_id:
            raise HTTPException(status_code=404, detail="Локация не найдена")
        entity_data = {
            "title": loc.name,
            "description": loc.description,
            "location_type": loc.location_type,
        }
        title = loc.name
    elif entity_type == "event":
        from app.services import timeline as timeline_service
        ev = await timeline_service.get_timeline_event(db, entity_id)
        if not ev or ev.universe_id != universe_id:
            raise HTTPException(status_code=404, detail="Событие не найдено")
        entity_data = {
            "title": ev.title,
            "description": ev.description,
            "event_type": ev.event_type or "",
        }
        title = ev.title or "Событие"

    content = await ai_generator_service.generate_wiki_article_content(
        entity_type=entity_type,
        entity_data=entity_data,
        book_title=book.title if book else "",
    )
    create_schema = WikiArticleCreate(
        title=title,
        content=content,
        article_type="auto",
        linked_entity_type=entity_type,
        linked_entity_id=entity_id,
        auto_generated=True,
    )
    return await knowledge.create_wiki_article(db, universe_id, create_schema)
