from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List, Optional
from app.models import Chapter, Storyline
from app.schemas import ChapterCreate, ChapterUpdate
from app.services.rag import rag_service
from app.repositories.universe import _touch_universe, _to_universe_id


async def get_chapters(
    db: AsyncSession, universe_id: int, storyline_id: Optional[int] = None
) -> List[Chapter]:
    """Все главы вселенной в порядке чтения. Если storyline_id задан — только главы этой линии."""
    stmt = (
        select(Chapter)
        .outerjoin(Storyline, Chapter.storyline_id == Storyline.id)
        .where(Chapter.universe_id == universe_id)
    )
    if storyline_id is not None:
        stmt = stmt.where(Chapter.storyline_id == storyline_id)
    stmt = stmt.order_by(
        Chapter.reading_order.asc().nullslast(),
        Storyline.sort_order.asc().nullsfirst(),
        Chapter.storyline_order.asc(),
        Chapter.chapter_number.asc(),
        Chapter.id.asc(),
    )
    result = await db.execute(stmt)
    return list(result.scalars().unique().all())

async def get_chapter(db: AsyncSession, chapter_id: int) -> Optional[Chapter]:
    result = await db.execute(select(Chapter).filter(Chapter.id == chapter_id))
    return result.scalars().first()

async def create_chapter(db: AsyncSession, chapter: ChapterCreate) -> Chapter:
    data = _to_universe_id(chapter.model_dump())
    db_chapter = Chapter(**data)
    db.add(db_chapter)
    await db.commit()
    await db.refresh(db_chapter)
    await _touch_universe(db_chapter.universe_id)
    # В RAG попадают только включённые главы (enabled=True)
    if getattr(db_chapter, "enabled", True) is not False:
        content = f"{chapter.summary}\n{chapter.content}\n{chapter.notes}"
        rag_service.add_chapter_content(
            universe_id=db_chapter.universe_id,
            chapter_id=db_chapter.id,
            title=f"Глава {chapter.chapter_number}: {chapter.title}",
            content=content
        )
    return db_chapter

async def update_chapter(db: AsyncSession, chapter_id: int, chapter: ChapterUpdate) -> Optional[Chapter]:
    db_chapter = await get_chapter(db, chapter_id)
    if db_chapter:
        update_data = chapter.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(db_chapter, key, value)
        await db.commit()
        await db.refresh(db_chapter)
        await _touch_universe(db_chapter.universe_id)
        # Скрытые главы (enabled=False) убираем из RAG; включённые — добавляем/обновляем
        if getattr(db_chapter, "enabled", True) is False:
            rag_service.remove_chapter_documents(db_chapter.universe_id, db_chapter.id)
        else:
            content = f"{db_chapter.summary}\n{db_chapter.content}\n{db_chapter.notes}"
            rag_service.add_chapter_content(
                universe_id=db_chapter.universe_id,
                chapter_id=db_chapter.id,
                title=f"Глава {db_chapter.chapter_number}: {db_chapter.title}",
                content=content
            )
    return db_chapter

async def delete_chapter(db: AsyncSession, chapter_id: int) -> bool:
    db_chapter = await get_chapter(db, chapter_id)
    if db_chapter:
        universe_id = db_chapter.universe_id
        rag_service.remove_chapter_documents(universe_id, chapter_id)
        await db.delete(db_chapter)
        await db.commit()
        await _touch_universe(universe_id)
        return True
    return False
