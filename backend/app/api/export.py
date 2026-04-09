from fastapi import APIRouter, Depends, HTTPException, Response
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from io import BytesIO
from app.database import get_db, get_master_db
from app.services import knowledge
from app.services.export import MarkdownExportService, DocxExportService

router = APIRouter(prefix="/universes/{universe_id}/export", tags=["export"])

@router.get("/markdown")
async def export_markdown(
    universe_id: int,
    include_characters: bool = True,
    include_locations: bool = True,
    include_chapters: bool = True,
    include_notes: bool = True,
    include_timeline: bool = True,
    db: AsyncSession = Depends(get_db),
    master_db: AsyncSession = Depends(get_master_db)
):
    """Экспорт вселенной в Markdown"""
    if not await knowledge.get_universe(universe_id, master_db):
        raise HTTPException(status_code=404, detail="Вселенная не найдена")
    
    exporter = MarkdownExportService(db, universe_id, master_db)
    content = await exporter.export_full(
        include_characters=include_characters,
        include_locations=include_locations,
        include_chapters=include_chapters,
        include_notes=include_notes,
        include_timeline=include_timeline
    )
    
    book = await knowledge.get_universe(universe_id, master_db)
    filename = f"{book.title}.md".replace(' ', '_').replace('/', '_')
    
    return Response(
        content=content,
        media_type="text/markdown",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

@router.get("/markdown/chapter/{chapter_id}")
async def export_chapter(
    universe_id: int,
    chapter_id: int,
    db: AsyncSession = Depends(get_db),
    master_db: AsyncSession = Depends(get_master_db)
):
    """Экспорт главы в Markdown"""
    chapter = await knowledge.get_chapter(db, chapter_id)
    if not chapter or chapter.universe_id != universe_id:
        raise HTTPException(status_code=404, detail="Глава не найдена")
    
    exporter = MarkdownExportService(db, universe_id, master_db)
    content = await exporter.export_chapter_only(chapter_id)
    
    filename = f"Chapter_{chapter.chapter_number}_{chapter.title}.md".replace(' ', '_').replace('/', '_')
    
    return Response(
        content=content,
        media_type="text/markdown",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

@router.get("/markdown/characters")
async def export_characters(universe_id: int, db: AsyncSession = Depends(get_db), master_db: AsyncSession = Depends(get_master_db)):
    """Экспорт персонажей в Markdown"""
    if not await knowledge.get_universe(universe_id, master_db):
        raise HTTPException(status_code=404, detail="Вселенная не найдена")
    
    exporter = MarkdownExportService(db, universe_id, master_db)
    content = await exporter.export_characters_only()
    
    return Response(
        content=content,
        media_type="text/markdown",
        headers={"Content-Disposition": "attachment; filename=Characters.md"}
    )


@router.get("/docx")
async def export_docx(
    universe_id: int,
    include_characters: bool = True,
    include_locations: bool = True,
    include_chapters: bool = True,
    include_notes: bool = True,
    include_timeline: bool = True,
    db: AsyncSession = Depends(get_db),
    master_db: AsyncSession = Depends(get_master_db)
):
    """Экспорт вселенной в DOCX"""
    book = await knowledge.get_universe(universe_id, master_db)
    if not book:
        raise HTTPException(status_code=404, detail="Вселенная не найдена")
    
    exporter = DocxExportService(db, universe_id, master_db)
    buffer = await exporter.build_bytes_io(
        include_characters=include_characters,
        include_locations=include_locations,
        include_chapters=include_chapters,
        include_notes=include_notes,
        include_timeline=include_timeline
    )
    filename = f"{book.title}.docx".replace(' ', '_').replace('/', '_')
    return Response(
        content=buffer.getvalue(),
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )
