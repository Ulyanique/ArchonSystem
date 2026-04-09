from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List
from app.database import get_db, get_master_db
from app.schemas import Note, NoteCreate, NoteUpdate
from app.services import knowledge
from app.services.ai_generator import ai_generator_service
from app.services.context_manager import context_manager

router = APIRouter(prefix="/universes/{universe_id}/notes", tags=["notes"])

@router.get("", response_model=List[Note])
async def list_notes(universe_id: int, db: AsyncSession = Depends(get_db), master_db: AsyncSession = Depends(get_master_db)):
    """Получить все заметки вселенной"""
    if not await knowledge.get_universe(universe_id, master_db):
        raise HTTPException(status_code=404, detail="Вселенная не найдена")
    return await knowledge.get_notes(db, universe_id)

@router.post("", response_model=Note)
async def create_note(universe_id: int, note: NoteCreate, db: AsyncSession = Depends(get_db), master_db: AsyncSession = Depends(get_master_db)):
    """Создать новую заметку"""
    if not await knowledge.get_universe(universe_id, master_db):
        raise HTTPException(status_code=404, detail="Вселенная не найдена")
    data = note.model_dump()
    data["universe_id"] = universe_id
    return await knowledge.create_note(db, NoteCreate(**data))

@router.get("/{note_id}", response_model=Note)
async def get_note(universe_id: int, note_id: int, db: AsyncSession = Depends(get_db)):
    """Получить заметку по ID"""
    db_note = await knowledge.get_note(db, note_id)
    if not db_note or db_note.universe_id != universe_id:
        raise HTTPException(status_code=404, detail="Заметка не найдена")
    return db_note


@router.post("/{note_id}/autofill")
async def autofill_note(universe_id: int, note_id: int, db: AsyncSession = Depends(get_db), master_db: AsyncSession = Depends(get_master_db)):
    """Заполнить пустое содержание заметки по контексту вселенной (ИИ)."""
    db_note = await knowledge.get_note(db, note_id)
    if not db_note or db_note.universe_id != universe_id:
        raise HTTPException(status_code=404, detail="Заметка не найдена")
    context = await context_manager.build_context(db, universe_id, master_db=master_db)
    current = {
        "title": db_note.title or "",
        "content": db_note.content or "",
        "note_type": db_note.note_type or "idea",
    }
    return await ai_generator_service.autofill_note(context, current)


@router.put("/{note_id}", response_model=Note)
async def update_note(universe_id: int, note_id: int, note: NoteUpdate, db: AsyncSession = Depends(get_db)):
    """Обновить заметку"""
    db_note = await knowledge.update_note(db, note_id, note)
    if not db_note or db_note.universe_id != universe_id:
        raise HTTPException(status_code=404, detail="Заметка не найдена")
    return db_note

@router.delete("/{note_id}")
async def delete_note(universe_id: int, note_id: int, db: AsyncSession = Depends(get_db)):
    """Удалить заметку"""
    db_note = await knowledge.get_note(db, note_id)
    if not db_note or db_note.universe_id != universe_id:
        raise HTTPException(status_code=404, detail="Заметка не найдена")
    success = await knowledge.delete_note(db, note_id)
    if not success:
        raise HTTPException(status_code=404, detail="Заметка не найдена")
    return {"message": "Заметка удалена"}
