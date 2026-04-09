"""API для переиндексации RAG (заметки, главы) по вселенной."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db, get_master_db
from app.services import knowledge
from app.services.rag import rag_service
from app.models import Note, Chapter

router = APIRouter(prefix="/universes/{universe_id}/rag", tags=["rag"])


@router.post("/reindex")
async def reindex_universe_rag(
    universe_id: int,
    db: AsyncSession = Depends(get_db),
    master_db: AsyncSession = Depends(get_master_db),
):
    """
    Переиндексировать все заметки и главы вселенной в векторной базе (RAG).
    Вызывайте после смены модели эмбеддингов или если нейросеть «не видит» черновики.
    """
    if not await knowledge.get_universe(universe_id, master_db):
        raise HTTPException(status_code=404, detail="Вселенная не найдена")

    notes_count = 0
    chapters_count = 0

    notes = await db.execute(select(Note).filter(Note.universe_id == universe_id, Note.enabled != False))
    for note in notes.scalars().all():
        try:
            rag_service.add_note_content(
                universe_id=universe_id,
                note_id=note.id,
                title=note.title or "",
                content=note.content or "",
                note_type=note.note_type or "note",
            )
            notes_count += 1
        except Exception:
            pass

    chapters = await db.execute(
        select(Chapter).filter(Chapter.universe_id == universe_id, Chapter.enabled != False)
    )
    for chapter in chapters.scalars().all():
        try:
            rag_service.add_chapter_content(
                universe_id=universe_id,
                chapter_id=chapter.id,
                title=chapter.title or "",
                content=chapter.content or "",
            )
            chapters_count += 1
        except Exception:
            pass

    return {
        "notes_indexed": notes_count,
        "chapters_indexed": chapters_count,
        "message": "Переиндексация завершена. Теперь поиск по смыслу (RAG) будет учитывать все заметки и главы.",
    }
