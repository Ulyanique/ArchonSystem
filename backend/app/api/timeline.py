from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional
from pydantic import BaseModel
from app.database import get_db, get_master_db
from app.schemas import TimelineEvent, TimelineEventUpdate
from app.services import timeline as timeline_service
from app.services import knowledge

# Временная схема для создания без universe_id
class TimelineEventCreateTemp(BaseModel):
    title: str
    description: str = ""
    date_value: Optional[str] = None
    sort_order: int = 0
    universe_year: Optional[int] = None
    universe_day: Optional[int] = None
    event_type: str = "general"
    chapter_id: Optional[int] = None
    location_id: Optional[int] = None
    character_ids: list = []

router = APIRouter(prefix="/universes/{universe_id}/timeline", tags=["timeline"])

@router.get("", response_model=List[TimelineEvent])
async def get_timeline(
    universe_id: int,
    filter_type: Optional[str] = Query(None),
    filter_id: Optional[int] = Query(None),
    db: AsyncSession = Depends(get_db),
    master_db: AsyncSession = Depends(get_master_db)
):
    """Получить все события таймлайна с фильтрацией"""
    if not await knowledge.get_universe(universe_id, master_db):
        raise HTTPException(status_code=404, detail="Вселенная не найдена")
    return await timeline_service.get_timeline_events(db, universe_id, filter_type, filter_id)

@router.get("/stats")
async def get_timeline_stats(universe_id: int, db: AsyncSession = Depends(get_db), master_db: AsyncSession = Depends(get_master_db)):
    """Получить статистику таймлайна"""
    if not await knowledge.get_universe(universe_id, master_db):
        raise HTTPException(status_code=404, detail="Вселенная не найдена")
    return await timeline_service.get_timeline_stats(db, universe_id)

@router.post("", response_model=TimelineEvent)
async def create_timeline_event(universe_id: int, event: TimelineEventCreateTemp, db: AsyncSession = Depends(get_db), master_db: AsyncSession = Depends(get_master_db)):
    """Создать событие таймлайна"""
    if not await knowledge.get_universe(universe_id, master_db):
        raise HTTPException(status_code=404, detail="Вселенная не найдена")
    
    event_dict = event.model_dump()
    event_dict['universe_id'] = universe_id
    
    return await timeline_service.create_timeline_event_raw(db, event_dict)

@router.get("/{event_id}", response_model=TimelineEvent)
async def get_timeline_event(universe_id: int, event_id: int, db: AsyncSession = Depends(get_db)):
    """Получить событие по ID"""
    # Виртуальные события (с отрицательными ID) не могут быть получены напрямую
    if event_id < 0:
        raise HTTPException(status_code=404, detail="Событие не найдено")
    db_event = await timeline_service.get_timeline_event(db, event_id)
    if not db_event or db_event.universe_id != universe_id:
        raise HTTPException(status_code=404, detail="Событие не найдено")
    return db_event

@router.put("/{event_id}", response_model=TimelineEvent)
async def update_timeline_event(universe_id: int, event_id: int, event: TimelineEventUpdate, db: AsyncSession = Depends(get_db)):
    """Обновить событие таймлайна"""
    # Виртуальные события (с отрицательными ID) нельзя редактировать
    if event_id < 0:
        raise HTTPException(status_code=400, detail="Нельзя редактировать автоматически сгенерированные события")
    db_event = await timeline_service.update_timeline_event(db, event_id, event)
    if not db_event or db_event.universe_id != universe_id:
        raise HTTPException(status_code=404, detail="Событие не найдено")
    return db_event

@router.delete("/{event_id}")
async def delete_timeline_event(universe_id: int, event_id: int, db: AsyncSession = Depends(get_db)):
    """Удалить событие таймлайна"""
    # Виртуальные события (с отрицательными ID) нельзя удалять
    if event_id < 0:
        raise HTTPException(status_code=400, detail="Нельзя удалять автоматически сгенерированные события")
    db_event = await timeline_service.get_timeline_event(db, event_id)
    if not db_event or db_event.universe_id != universe_id:
        raise HTTPException(status_code=404, detail="Событие не найдено")
    success = await timeline_service.delete_timeline_event(db, event_id)
    if not success:
        raise HTTPException(status_code=404, detail="Событие не найдено")
    return {"message": "Событие удалено"}
