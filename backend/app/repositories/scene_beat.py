from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List, Optional
from app.models import SceneBeat, Chapter
from app.schemas.scene_beat import SceneBeatCreate, SceneBeatUpdate
from app.services.rag import rag_service


async def _sync_chapter_content_from_beats(db: AsyncSession, chapter_id: int) -> None:
    """Обновить chapter.content = конкатенация содержимого включённых битов (для экспорта и RAG). Отключённые сцены не попадают в контекст."""
    beats = await get_beats(db, chapter_id)
    content = "\n\n".join(
        (b.content or "").strip()
        for b in beats
        if getattr(b, "enabled", True) is not False
    ).strip()
    result = await db.execute(select(Chapter).filter(Chapter.id == chapter_id))
    ch = result.scalars().first()
    if ch:
        ch.content = content
        await db.commit()
        rag_service.add_chapter_content(
            ch.universe_id, ch.id,
            f"Глава {ch.chapter_number}: {ch.title}",
            content
        )


async def get_beats(db: AsyncSession, chapter_id: int) -> List[SceneBeat]:
    result = await db.execute(
        select(SceneBeat).filter(SceneBeat.chapter_id == chapter_id).order_by(SceneBeat.sort_order, SceneBeat.id)
    )
    return list(result.scalars().all())


async def get_beat(db: AsyncSession, beat_id: int) -> Optional[SceneBeat]:
    result = await db.execute(select(SceneBeat).filter(SceneBeat.id == beat_id))
    return result.scalars().first()


async def create_beat(db: AsyncSession, chapter_id: int, beat: SceneBeatCreate) -> SceneBeat:
    max_order = await db.execute(
        select(SceneBeat.sort_order).filter(SceneBeat.chapter_id == chapter_id).order_by(SceneBeat.sort_order.desc()).limit(1)
    )
    next_order = (max_order.scalar_one_or_none() or -1) + 1
    db_beat = SceneBeat(
        chapter_id=chapter_id,
        sort_order=next_order,
        title=beat.title or "",
        description=getattr(beat, "description", None) or "",
        content=beat.content or "",
        enabled=getattr(beat, "enabled", True) is not False,
        collapsed=getattr(beat, "collapsed", False) is True,
    )
    db.add(db_beat)
    await db.commit()
    await db.refresh(db_beat)
    await _sync_chapter_content_from_beats(db, chapter_id)
    return db_beat


async def update_beat(db: AsyncSession, beat_id: int, beat: SceneBeatUpdate) -> Optional[SceneBeat]:
    db_beat = await get_beat(db, beat_id)
    if not db_beat:
        return None
    data = beat.model_dump(exclude_unset=True)
    for k, v in data.items():
        setattr(db_beat, k, v)
    await db.commit()
    await db.refresh(db_beat)
    await _sync_chapter_content_from_beats(db, db_beat.chapter_id)
    return db_beat


async def delete_beat(db: AsyncSession, beat_id: int) -> bool:
    db_beat = await get_beat(db, beat_id)
    if not db_beat:
        return False
    chapter_id = db_beat.chapter_id
    await db.delete(db_beat)
    await db.commit()
    await _sync_chapter_content_from_beats(db, chapter_id)
    return True


async def reorder_beats(db: AsyncSession, chapter_id: int, beat_ids: List[int]) -> bool:
    """Установить sort_order по порядку beat_ids."""
    beats = await get_beats(db, chapter_id)
    by_id = {b.id: b for b in beats}
    for i, bid in enumerate(beat_ids):
        if bid in by_id:
            by_id[bid].sort_order = i
    await db.commit()
    await _sync_chapter_content_from_beats(db, chapter_id)
    return True


async def move_beat_to_chapter(
    db: AsyncSession,
    beat_id: int,
    target_chapter_id: int,
    insert_index: int = 0,
) -> Optional[SceneBeat]:
    """Перенести бит в другую главу на позицию insert_index (0 = в начало)."""
    db_beat = await get_beat(db, beat_id)
    if not db_beat:
        return None
    if db_beat.chapter_id == target_chapter_id:
        return db_beat
    source_chapter_id = db_beat.chapter_id
    target_beats = await get_beats(db, target_chapter_id)
    target_ids = [b.id for b in target_beats]
    target_ids.insert(min(insert_index, len(target_ids)), beat_id)
    db_beat.chapter_id = target_chapter_id
    for i, bid in enumerate(target_ids):
        if bid == beat_id:
            db_beat.sort_order = i
        else:
            b = next((x for x in target_beats if x.id == bid), None)
            if b:
                b.sort_order = i
    await db.commit()
    await db.refresh(db_beat)
    await _sync_chapter_content_from_beats(db, source_chapter_id)
    await _sync_chapter_content_from_beats(db, target_chapter_id)
    return db_beat
