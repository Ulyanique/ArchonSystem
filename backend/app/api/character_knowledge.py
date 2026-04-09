from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List
from app.database import get_db, get_master_db
from app.schemas import CharacterKnowledge, CharacterKnowledgeCreate, CharacterKnowledgeUpdate
from app.services import knowledge

router = APIRouter(
    prefix="/universes/{universe_id}/characters/{character_id}/knowledge",
    tags=["character-knowledge"],
)


@router.get("", response_model=List[CharacterKnowledge])
async def list_character_knowledge(
    universe_id: int, character_id: int, db: AsyncSession = Depends(get_db), master_db: AsyncSession = Depends(get_master_db)
):
    if not await knowledge.get_universe(universe_id, master_db):
        raise HTTPException(status_code=404, detail="Вселенная не найдена")
    char = await knowledge.get_character(db, character_id)
    if not char or char.universe_id != universe_id:
        raise HTTPException(status_code=404, detail="Персонаж не найден")
    return await knowledge.get_character_knowledge_list(db, character_id)


@router.post("", response_model=CharacterKnowledge)
async def create_character_knowledge(
    universe_id: int,
    character_id: int,
    data: CharacterKnowledgeCreate,
    db: AsyncSession = Depends(get_db),
    master_db: AsyncSession = Depends(get_master_db),
):
    if not await knowledge.get_universe(universe_id, master_db):
        raise HTTPException(status_code=404, detail="Вселенная не найдена")
    char = await knowledge.get_character(db, character_id)
    if not char or char.universe_id != universe_id:
        raise HTTPException(status_code=404, detail="Персонаж не найден")
    return await knowledge.create_character_knowledge(db, character_id, data)


@router.put("/{knowledge_id}", response_model=CharacterKnowledge)
async def update_character_knowledge(
    universe_id: int,
    character_id: int,
    knowledge_id: int,
    data: CharacterKnowledgeUpdate,
    db: AsyncSession = Depends(get_db),
    master_db: AsyncSession = Depends(get_master_db),
):
    if not await knowledge.get_universe(universe_id, master_db):
        raise HTTPException(status_code=404, detail="Вселенная не найдена")
    char = await knowledge.get_character(db, character_id)
    if not char or char.universe_id != universe_id:
        raise HTTPException(status_code=404, detail="Персонаж не найден")
    rec = await knowledge.get_character_knowledge_by_id(db, knowledge_id)
    if not rec or rec.character_id != character_id:
        raise HTTPException(status_code=404, detail="Запись знаний не найдена")
    updated = await knowledge.update_character_knowledge(db, knowledge_id, data)
    return updated


@router.delete("/{knowledge_id}")
async def delete_character_knowledge(
    universe_id: int, character_id: int, knowledge_id: int, db: AsyncSession = Depends(get_db), master_db: AsyncSession = Depends(get_master_db)
):
    if not await knowledge.get_universe(universe_id, master_db):
        raise HTTPException(status_code=404, detail="Вселенная не найдена")
    char = await knowledge.get_character(db, character_id)
    if not char or char.universe_id != universe_id:
        raise HTTPException(status_code=404, detail="Персонаж не найден")
    rec = await knowledge.get_character_knowledge_by_id(db, knowledge_id)
    if not rec or rec.character_id != character_id:
        raise HTTPException(status_code=404, detail="Запись знаний не найдена")
    await knowledge.delete_character_knowledge(db, knowledge_id)
    return {"message": "Запись удалена"}
