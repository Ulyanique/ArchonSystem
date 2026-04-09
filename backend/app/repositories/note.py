from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from typing import List, Optional
from app.models import Note, OutlineItem
from app.schemas import NoteCreate, NoteUpdate, OutlineItemCreate, OutlineItemUpdate
from app.services.rag import rag_service
from app.repositories.universe import _touch_universe, _to_universe_id

# === Note Repository ===
async def get_notes(db: AsyncSession, universe_id: int) -> List[Note]:
    result = await db.execute(select(Note).filter(Note.universe_id == universe_id))
    return result.scalars().all()

async def get_note(db: AsyncSession, note_id: int) -> Optional[Note]:
    result = await db.execute(select(Note).filter(Note.id == note_id))
    return result.scalars().first()

async def create_note(db: AsyncSession, note: NoteCreate) -> Note:
    data = _to_universe_id(note.model_dump())
    db_note = Note(**data)
    db.add(db_note)
    await db.commit()
    await db.refresh(db_note)
    await _touch_universe(db_note.universe_id)
    rag_service.add_note_content(
        universe_id=db_note.universe_id,
        note_id=db_note.id,
        title=note.title,
        content=note.content or "",
        note_type=db_note.note_type or "note",
    )
    return db_note

async def update_note(db: AsyncSession, note_id: int, note: NoteUpdate) -> Optional[Note]:
    db_note = await get_note(db, note_id)
    if db_note:
        update_data = note.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(db_note, key, value)
        await db.commit()
        await db.refresh(db_note)
        await _touch_universe(db_note.universe_id)
        rag_service.add_note_content(
            universe_id=db_note.universe_id,
            note_id=db_note.id,
            title=db_note.title,
            content=db_note.content or "",
            note_type=db_note.note_type or "note",
        )
    return db_note

async def delete_note(db: AsyncSession, note_id: int) -> bool:
    db_note = await get_note(db, note_id)
    if db_note:
        universe_id = db_note.universe_id
        rag_service.remove_note_documents(universe_id, note_id)
        await db.delete(db_note)
        await db.commit()
        await _touch_universe(universe_id)
        return True
    return False

# === OutlineItem Repository ===
async def get_outline_items(db: AsyncSession, universe_id: int) -> List[OutlineItem]:
    result = await db.execute(select(OutlineItem).filter(OutlineItem.universe_id == universe_id).order_by(OutlineItem.sort_order))
    return result.scalars().all()

async def get_outline_item(db: AsyncSession, outline_item_id: int) -> Optional[OutlineItem]:
    result = await db.execute(select(OutlineItem).filter(OutlineItem.id == outline_item_id))
    return result.scalars().first()

async def create_outline_item(db: AsyncSession, item: OutlineItemCreate) -> OutlineItem:
    db_item = OutlineItem(**item.model_dump())
    db.add(db_item)
    await db.commit()
    await db.refresh(db_item)
    return db_item

async def update_outline_item(db: AsyncSession, outline_item_id: int, item: OutlineItemUpdate) -> Optional[OutlineItem]:
    db_item = await get_outline_item(db, outline_item_id)
    if db_item:
        update_data = item.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(db_item, key, value)
        await db.commit()
        await db.refresh(db_item)
    return db_item

async def delete_outline_item(db: AsyncSession, outline_item_id: int) -> bool:
    db_item = await get_outline_item(db, outline_item_id)
    if db_item:
        await db.delete(db_item)
        await db.commit()
        return True
    return False


async def move_outline_item(db: AsyncSession, universe_id: int, item_id: int, after_item_id: Optional[int]) -> Optional[OutlineItem]:
    """Переместить пункт плана после другого пункта (after_item_id=None — в начало). Возвращает обновлённый item."""
    items = await get_outline_items(db, universe_id)
    by_id = {it.id: it for it in items}
    if item_id not in by_id:
        return None
    moved = by_id[item_id]
    rest = [it for it in items if it.id != item_id]
    if after_item_id is None:
        new_order = [moved] + rest
    else:
        if after_item_id not in by_id:
            return None
        new_order = []
        for it in rest:
            new_order.append(it)
            if it.id == after_item_id:
                new_order.append(moved)
        if moved not in new_order:
            new_order.append(moved)
    # Записываем sort_order в обратном порядке, чтобы не было временных дубликатов (иначе ORDER BY даёт неверный порядок)
    n = len(new_order)
    for i in range(n - 1, -1, -1):
        await db.execute(update(OutlineItem).where(OutlineItem.id == new_order[i].id).values(sort_order=i))
    await db.commit()
    await db.refresh(moved)
    return moved
