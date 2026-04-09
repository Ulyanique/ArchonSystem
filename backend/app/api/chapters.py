from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional
import json
from pydantic import BaseModel
from app.database import get_db, get_master_db
from app.schemas import Chapter, ChapterCreate, ChapterUpdate, SceneBeat, SceneBeatCreate, SceneBeatUpdate, SceneBeatReorderBody, SceneBeatMoveBody
from app.services import knowledge
from app.services.ai_writer import write_chapter_prose, write_chapter_prose_full, write_chapter_prose_from_instruction

router = APIRouter(prefix="/universes/{universe_id}/chapters", tags=["chapters"])


class WriteChapterRequest(BaseModel):
    mode: str = "from_summary"  # from_summary | continue
    prompt_extra: Optional[str] = None


class WriteBeatRequest(BaseModel):
    """Режим Write / scene beat: генерация прозы по инструкции или «продолжи с этого места»."""
    instruction: str = ""
    text_before_cursor: Optional[str] = None

@router.get("", response_model=List[Chapter])
async def list_chapters(
    universe_id: int,
    storyline_id: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
    master_db: AsyncSession = Depends(get_master_db),
):
    """Получить все главы вселенной (в порядке чтения). Опционально: ?storyline_id= — только главы этой сюжетной линии."""
    if not await knowledge.get_universe(universe_id, master_db):
        raise HTTPException(status_code=404, detail="Вселенная не найдена")
    return await knowledge.get_chapters(db, universe_id, storyline_id=storyline_id)

@router.post("", response_model=Chapter)
async def create_chapter(universe_id: int, chapter: ChapterCreate, db: AsyncSession = Depends(get_db), master_db: AsyncSession = Depends(get_master_db)):
    """Создать новую главу"""
    if not await knowledge.get_universe(universe_id, master_db):
        raise HTTPException(status_code=404, detail="Вселенная не найдена")
    data = chapter.model_dump()
    data["universe_id"] = universe_id
    return await knowledge.create_chapter(db, ChapterCreate(**data))

@router.get("/{chapter_id}", response_model=Chapter)
async def get_chapter(universe_id: int, chapter_id: int, db: AsyncSession = Depends(get_db)):
    """Получить главу по ID"""
    db_chapter = await knowledge.get_chapter(db, chapter_id)
    if not db_chapter or db_chapter.universe_id != universe_id:
        raise HTTPException(status_code=404, detail="Глава не найдена")
    return db_chapter

@router.put("/{chapter_id}", response_model=Chapter)
async def update_chapter(universe_id: int, chapter_id: int, chapter: ChapterUpdate, db: AsyncSession = Depends(get_db)):
    """Обновить главу"""
    db_chapter = await knowledge.update_chapter(db, chapter_id, chapter)
    if not db_chapter or db_chapter.universe_id != universe_id:
        raise HTTPException(status_code=404, detail="Глава не найдена")
    return db_chapter

@router.delete("/{chapter_id}")
async def delete_chapter(universe_id: int, chapter_id: int, db: AsyncSession = Depends(get_db)):
    """Удалить главу"""
    db_chapter = await knowledge.get_chapter(db, chapter_id)
    if not db_chapter or db_chapter.universe_id != universe_id:
        raise HTTPException(status_code=404, detail="Глава не найдена")
    success = await knowledge.delete_chapter(db, chapter_id)
    if not success:
        raise HTTPException(status_code=404, detail="Глава не найдена")
    return {"message": "Глава удалена"}


@router.post("/{chapter_id}/ai/write")
async def ai_write_chapter(
    universe_id: int,
    chapter_id: int,
    body: WriteChapterRequest,
    db: AsyncSession = Depends(get_db),
    master_db: AsyncSession = Depends(get_master_db)
):
    """Сгенерировать текст главы ИИ (стриминг). mode: from_summary | continue."""
    chapter = await knowledge.get_chapter(db, chapter_id)
    if not chapter or chapter.universe_id != universe_id:
        raise HTTPException(status_code=404, detail="Глава не найдена")

    async def stream():
        try:
            async for chunk in write_chapter_prose(
                db, universe_id, chapter_id,
                mode=body.mode or "from_summary",
                prompt_extra=body.prompt_extra,
                master_db=master_db
            ):
                yield f"data: {json.dumps({'content': chunk}, ensure_ascii=False)}\n\n"
        except Exception as stream_err:
            try:
                content = await write_chapter_prose_full(
                    db, universe_id, chapter_id,
                    mode=body.mode or "from_summary",
                    prompt_extra=body.prompt_extra,
                    master_db=master_db
                )
                if content:
                    yield f"data: {json.dumps({'content': content}, ensure_ascii=False)}\n\n"
            except Exception:
                yield f"data: {json.dumps({'error': str(stream_err)}, ensure_ascii=False)}\n\n"

    return StreamingResponse(
        stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"}
    )


@router.post("/{chapter_id}/ai/write-beat")
async def ai_write_beat(
    universe_id: int,
    chapter_id: int,
    body: WriteBeatRequest,
    db: AsyncSession = Depends(get_db),
    master_db: AsyncSession = Depends(get_master_db)
):
    """Режим Write / scene beat: сгенерировать прозу по инструкции или «продолжи с этого места» (стриминг)."""
    chapter = await knowledge.get_chapter(db, chapter_id)
    if not chapter or chapter.universe_id != universe_id:
        raise HTTPException(status_code=404, detail="Глава не найдена")
    instruction = (body.instruction or "").strip()
    text_before = (body.text_before_cursor or "").strip() or None
    if not instruction and not text_before:
        raise HTTPException(status_code=400, detail="Укажите instruction или text_before_cursor")

    async def stream():
        try:
            async for chunk in write_chapter_prose_from_instruction(
                db, universe_id, chapter_id,
                instruction=instruction or "",
                text_before_cursor=text_before,
                master_db=master_db
            ):
                yield f"data: {json.dumps({'content': chunk}, ensure_ascii=False)}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)}, ensure_ascii=False)}\n\n"

    return StreamingResponse(
        stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"}
    )


@router.get("/{chapter_id}/ai/suggestions")
async def get_chapter_suggestions_endpoint(
    universe_id: int,
    chapter_id: int,
    db: AsyncSession = Depends(get_db),
    master_db: AsyncSession = Depends(get_master_db)
):
    """Получить подсказки ИИ для написания главы на основе контекста вселенной."""
    chapter = await knowledge.get_chapter(db, chapter_id)
    if not chapter or chapter.universe_id != universe_id:
        raise HTTPException(status_code=404, detail="Глава не найдена")
    
    from app.services.ai_writer import get_chapter_suggestions
    suggestions = await get_chapter_suggestions(db, universe_id, chapter_id, master_db)
    return suggestions


# === Scene beats (блоки сцен) ===

@router.get("/{chapter_id}/beats", response_model=List[SceneBeat])
async def list_beats(universe_id: int, chapter_id: int, db: AsyncSession = Depends(get_db)):
    chapter = await knowledge.get_chapter(db, chapter_id)
    if not chapter or chapter.universe_id != universe_id:
        raise HTTPException(status_code=404, detail="Глава не найдена")
    return await knowledge.get_beats(db, chapter_id)


@router.post("/{chapter_id}/beats", response_model=SceneBeat)
async def create_beat(universe_id: int, chapter_id: int, body: SceneBeatCreate, db: AsyncSession = Depends(get_db)):
    chapter = await knowledge.get_chapter(db, chapter_id)
    if not chapter or chapter.universe_id != universe_id:
        raise HTTPException(status_code=404, detail="Глава не найдена")
    return await knowledge.create_beat(db, chapter_id, body)


@router.get("/{chapter_id}/beats/{beat_id}", response_model=SceneBeat)
async def get_beat(universe_id: int, chapter_id: int, beat_id: int, db: AsyncSession = Depends(get_db)):
    chapter = await knowledge.get_chapter(db, chapter_id)
    if not chapter or chapter.universe_id != universe_id:
        raise HTTPException(status_code=404, detail="Глава не найдена")
    beat = await knowledge.get_beat(db, beat_id)
    if not beat or beat.chapter_id != chapter_id:
        raise HTTPException(status_code=404, detail="Бит не найден")
    return beat


@router.put("/{chapter_id}/beats/{beat_id}", response_model=SceneBeat)
async def update_beat(universe_id: int, chapter_id: int, beat_id: int, body: SceneBeatUpdate, db: AsyncSession = Depends(get_db)):
    chapter = await knowledge.get_chapter(db, chapter_id)
    if not chapter or chapter.universe_id != universe_id:
        raise HTTPException(status_code=404, detail="Глава не найдена")
    beat = await knowledge.get_beat(db, beat_id)
    if not beat or beat.chapter_id != chapter_id:
        raise HTTPException(status_code=404, detail="Бит не найден")
    updated = await knowledge.update_beat(db, beat_id, body)
    return updated


@router.delete("/{chapter_id}/beats/{beat_id}")
async def delete_beat(universe_id: int, chapter_id: int, beat_id: int, db: AsyncSession = Depends(get_db)):
    chapter = await knowledge.get_chapter(db, chapter_id)
    if not chapter or chapter.universe_id != universe_id:
        raise HTTPException(status_code=404, detail="Глава не найдена")
    beat = await knowledge.get_beat(db, beat_id)
    if not beat or beat.chapter_id != chapter_id:
        raise HTTPException(status_code=404, detail="Бит не найден")
    await knowledge.delete_beat(db, beat_id)
    return {"message": "Бит удалён"}


@router.patch("/{chapter_id}/beats/reorder")
async def reorder_beats(universe_id: int, chapter_id: int, body: SceneBeatReorderBody, db: AsyncSession = Depends(get_db)):
    chapter = await knowledge.get_chapter(db, chapter_id)
    if not chapter or chapter.universe_id != universe_id:
        raise HTTPException(status_code=404, detail="Глава не найдена")
    await knowledge.reorder_beats(db, chapter_id, body.beat_ids)
    return {"message": "Порядок обновлён"}


@router.patch("/{chapter_id}/beats/{beat_id}/move", response_model=SceneBeat)
async def move_beat(
    universe_id: int,
    chapter_id: int,
    beat_id: int,
    body: SceneBeatMoveBody,
    db: AsyncSession = Depends(get_db),
):
    """Перенести сцену в другую главу."""
    chapter = await knowledge.get_chapter(db, chapter_id)
    if not chapter or chapter.universe_id != universe_id:
        raise HTTPException(status_code=404, detail="Глава не найдена")
    target_chapter = await knowledge.get_chapter(db, body.target_chapter_id)
    if not target_chapter or target_chapter.universe_id != universe_id:
        raise HTTPException(status_code=404, detail="Целевая глава не найдена")
    beat = await knowledge.get_beat(db, beat_id)
    if not beat or beat.chapter_id != chapter_id:
        raise HTTPException(status_code=404, detail="Сцена не найдена")
    updated = await knowledge.move_beat_to_chapter(db, beat_id, body.target_chapter_id, body.insert_index)
    return updated
