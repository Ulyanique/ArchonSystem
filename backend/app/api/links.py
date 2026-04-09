from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List
from pydantic import BaseModel
from app.database import get_db, get_master_db
from app.schemas import Link, LinkCreate, LinkUpdate, GraphData
from app.services import links as link_service

router = APIRouter(prefix="/universes/{universe_id}/links", tags=["links"])


class LayoutNode(BaseModel):
    id: str
    position: dict  # { x: float, y: float }


class LayoutBody(BaseModel):
    nodes: List[LayoutNode]

@router.get("", response_model=List[Link])
async def list_links(universe_id: int, db: AsyncSession = Depends(get_db)):
    """Получить все связи вселенной"""
    return await link_service.get_links(db, universe_id)

@router.post("", response_model=Link)
async def create_link(universe_id: int, link: LinkCreate, db: AsyncSession = Depends(get_db)):
    """Создать связь"""
    data = link.model_dump()
    data["universe_id"] = universe_id
    return await link_service.create_link(db, LinkCreate(**data))

@router.get("/graph/space", response_model=GraphData)
async def get_graph_space(universe_id: int, db: AsyncSession = Depends(get_db), master_db: AsyncSession = Depends(get_master_db)):
    """Граф пространства: Вселенная → Галактики → Звёздные системы → Небесные тела → Локации."""
    return await link_service.get_graph_data_space(db, universe_id, master_db)


@router.get("/graph", response_model=GraphData)
async def get_graph(universe_id: int, db: AsyncSession = Depends(get_db), master_db: AsyncSession = Depends(get_master_db)):
    """Получить данные для графа знаний (узлы с позициями, если сохранены)."""
    return await link_service.get_graph_data(db, universe_id, master_db)


@router.put("/layout")
async def save_layout(universe_id: int, body: LayoutBody, db: AsyncSession = Depends(get_db)):
    """Сохранить позиции узлов графа. Тело: { nodes: [ { id, position: { x, y } }, ... ] }."""
    await link_service.save_layout(db, universe_id, [{"id": n.id, "position": n.position} for n in body.nodes])
    return {"ok": True}


@router.get("/suggestions/{element_type}/{element_id}")
async def get_suggestions(universe_id: int, element_type: str, element_id: int, db: AsyncSession = Depends(get_db)):
    """Получить предложения по связям"""
    return await link_service.get_suggested_links(db, universe_id, element_type, element_id)

# Специфичные маршруты должны быть ПЕРЕД параметризованными маршрутами
@router.get("/connectivity")
async def get_connectivity_analysis(universe_id: int, db: AsyncSession = Depends(get_db)):
    """Анализ связанности сущностей вселенной"""
    try:
        return await link_service.analyze_connectivity(db, universe_id)
    except Exception as e:
        import traceback
        raise HTTPException(status_code=500, detail=f"Ошибка анализа связанности: {str(e)}")

@router.get("/temporal-consistency")
async def check_temporal_consistency(universe_id: int, db: AsyncSession = Depends(get_db)):
    """Проверка временной консистентности вселенной"""
    try:
        return await link_service.check_temporal_consistency(db, universe_id)
    except Exception as e:
        import traceback
        raise HTTPException(status_code=500, detail=f"Ошибка проверки временной консистентности: {str(e)}")

@router.get("/link-suggestions")
async def get_link_suggestions(universe_id: int, db: AsyncSession = Depends(get_db)):
    """Получить автоматические предложения связей"""
    try:
        return await link_service.suggest_links(db, universe_id)
    except Exception as e:
        import traceback
        raise HTTPException(status_code=500, detail=f"Ошибка генерации предложений связей: {str(e)}")

@router.post("/development-suggestions")
async def get_development_suggestions(
    universe_id: int, 
    connectivity_data: dict, 
    db: AsyncSession = Depends(get_db),
    master_db: AsyncSession = Depends(get_master_db)
):
    """Получить AI-предложения по развитию вселенной"""
    try:
        return await link_service.get_universe_development_suggestions(db, universe_id, connectivity_data, master_db)
    except Exception as e:
        import traceback
        raise HTTPException(status_code=500, detail=f"Ошибка генерации предложений по развитию: {str(e)}")

# Параметризованные маршруты должны быть ПОСЛЕ специфичных
@router.get("/{link_id}", response_model=Link)
async def get_link(universe_id: int, link_id: int, db: AsyncSession = Depends(get_db)):
    """Получить связь по ID"""
    db_link = await link_service.get_link(db, link_id)
    if not db_link or db_link.universe_id != universe_id:
        raise HTTPException(status_code=404, detail="Связь не найдена")
    return db_link

@router.put("/{link_id}", response_model=Link)
async def update_link(universe_id: int, link_id: int, link: LinkUpdate, db: AsyncSession = Depends(get_db)):
    """Обновить связь"""
    db_link = await link_service.update_link(db, link_id, link)
    if not db_link or db_link.universe_id != universe_id:
        raise HTTPException(status_code=404, detail="Связь не найдена")
    return db_link

@router.delete("/{link_id}")
async def delete_link(universe_id: int, link_id: int, db: AsyncSession = Depends(get_db)):
    """Удалить связь"""
    db_link = await link_service.get_link(db, link_id)
    if not db_link or db_link.universe_id != universe_id:
        raise HTTPException(status_code=404, detail="Связь не найдена")
    success = await link_service.delete_link(db, link_id)
    if not success:
        raise HTTPException(status_code=404, detail="Связь не найдена")
    return {"message": "Связь удалена"}
