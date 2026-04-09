from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional
from pydantic import BaseModel
from app.database import get_db, get_master_db
from app.schemas import OutlineItem, OutlineItemCreate, OutlineItemCreateRequest, OutlineItemUpdate
from app.services import knowledge
from app.services.ai_generator import ai_generator_service


class OutlineMoveBody(BaseModel):
    after_item_id: Optional[int] = None

router = APIRouter(prefix="/universes/{universe_id}/outline", tags=["outline"])


class GenerateOutlineRequest(BaseModel):
    direction: Optional[str] = None
    genre: Optional[str] = None
    num_chapters: int = 12


class OutlineItemApply(BaseModel):
    title: str
    summary: str = ""
    outline_type: str = "chapter"
    sort_order: int = 0


class ApplyOutlineRequest(BaseModel):
    items: List[OutlineItemApply]
    create_chapters: bool = True

@router.get("", response_model=List[OutlineItem])
async def list_outline(universe_id: int, db: AsyncSession = Depends(get_db), master_db: AsyncSession = Depends(get_master_db)):
    """Получить план вселенной (пункты аутлайна)"""
    if not await knowledge.get_universe(universe_id, master_db):
        raise HTTPException(status_code=404, detail="Вселенная не найдена")
    return await knowledge.get_outline_items(db, universe_id)

@router.post("", response_model=OutlineItem)
async def create_outline_item(universe_id: int, item: OutlineItemCreateRequest, db: AsyncSession = Depends(get_db), master_db: AsyncSession = Depends(get_master_db)):
    """Добавить пункт в план"""
    if not await knowledge.get_universe(universe_id, master_db):
        raise HTTPException(status_code=404, detail="Вселенная не найдена")
    create_schema = OutlineItemCreate(**(item.model_dump() | {"universe_id": universe_id}))
    return await knowledge.create_outline_item(db, create_schema)

@router.put("/{item_id}", response_model=OutlineItem)
async def update_outline_item(universe_id: int, item_id: int, item: OutlineItemUpdate, db: AsyncSession = Depends(get_db)):
    """Обновить пункт плана"""
    db_item = await knowledge.get_outline_item(db, item_id)
    if not db_item or db_item.universe_id != universe_id:
        raise HTTPException(status_code=404, detail="Пункт плана не найден")
    updated = await knowledge.update_outline_item(db, item_id, item)
    if not updated:
        raise HTTPException(status_code=404, detail="Пункт плана не найден")
    return updated

@router.delete("/{item_id}")
async def delete_outline_item(universe_id: int, item_id: int, db: AsyncSession = Depends(get_db)):
    """Удалить пункт плана"""
    db_item = await knowledge.get_outline_item(db, item_id)
    if not db_item or db_item.universe_id != universe_id:
        raise HTTPException(status_code=404, detail="Пункт плана не найден")
    await knowledge.delete_outline_item(db, item_id)
    return {"message": "Пункт плана удалён"}


@router.patch("/{item_id}/move", response_model=OutlineItem)
async def move_outline_item_endpoint(universe_id: int, item_id: int, body: OutlineMoveBody, db: AsyncSession = Depends(get_db)):
    """Переместить пункт плана после другого (after_item_id=null — в начало). Для переноса глав между актами."""
    db_item = await knowledge.get_outline_item(db, item_id)
    if not db_item or db_item.universe_id != universe_id:
        raise HTTPException(status_code=404, detail="Пункт плана не найден")
    updated = await knowledge.move_outline_item(db, universe_id, item_id, body.after_item_id)
    if not updated:
        raise HTTPException(status_code=400, detail="Не удалось переместить")
    return updated


@router.post("/generate")
async def generate_outline(universe_id: int, body: GenerateOutlineRequest, db: AsyncSession = Depends(get_db), master_db: AsyncSession = Depends(get_master_db)):
    """Сгенерировать план вселенной по направлению (ИИ). Не сохраняет в БД."""
    book = await knowledge.get_universe(universe_id, master_db)
    if not book:
        raise HTTPException(status_code=404, detail="Вселенная не найдена")
    direction = body.direction or getattr(book, "direction", "") or ""
    genre = body.genre or book.genre or "фэнтези"
    characters = [c for c in await knowledge.get_characters(db, universe_id) if getattr(c, "enabled", True)]
    locations = [l for l in await knowledge.get_locations(db, universe_id) if getattr(l, "enabled", True)]
    char_dicts = [{"name": c.name, "role": c.role} for c in characters]
    loc_dicts = [{"name": l.name} for l in locations]
    items = await ai_generator_service.generate_outline(
        book_title=book.title,
        book_description=book.description or "",
        direction=direction,
        genre=genre,
        existing_characters=char_dicts,
        existing_locations=loc_dicts,
        num_chapters=body.num_chapters
    )
    return {"items": items}


@router.post("/apply")
async def apply_outline(universe_id: int, body: ApplyOutlineRequest, db: AsyncSession = Depends(get_db), master_db: AsyncSession = Depends(get_master_db)):
    """Применить сгенерированный план: создать OutlineItem и опционально пустые главы."""
    if not await knowledge.get_universe(universe_id, master_db):
        raise HTTPException(status_code=404, detail="Вселенная не найдена")
    created = []
    chapter_num = 1
    for item in body.items:
        oi = await knowledge.create_outline_item(db, OutlineItemCreate(
            universe_id=universe_id,
            title=item.title,
            summary=item.summary,
            outline_type=item.outline_type,
            sort_order=item.sort_order
        ))
        created.append(oi)
        if body.create_chapters and item.outline_type == "chapter":
            from app.schemas import ChapterCreate
            await knowledge.create_chapter(db, ChapterCreate(
                universe_id=universe_id,
                title=item.title,
                chapter_number=chapter_num,
                content="",
                summary=item.summary,
                notes=""
            ))
            chapter_num += 1
    return {"created": len(created), "items": created}
