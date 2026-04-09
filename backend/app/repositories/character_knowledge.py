from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List, Optional
from app.models import CharacterKnowledge
from app.schemas import CharacterKnowledgeCreate, CharacterKnowledgeUpdate

# === CharacterKnowledge Repository ===
async def get_character_knowledge_list(db: AsyncSession, character_id: int) -> List[CharacterKnowledge]:
    result = await db.execute(select(CharacterKnowledge).filter(CharacterKnowledge.character_id == character_id))
    return result.scalars().all()


async def get_character_knowledge_by_id(db: AsyncSession, knowledge_id: int) -> Optional[CharacterKnowledge]:
    result = await db.execute(select(CharacterKnowledge).filter(CharacterKnowledge.id == knowledge_id))
    return result.scalars().first()


async def create_character_knowledge(db: AsyncSession, character_id: int, data: CharacterKnowledgeCreate) -> CharacterKnowledge:
    rec = CharacterKnowledge(
        character_id=character_id,
        target_type=data.target_type,
        target_id=data.target_id,
        knowledge_level=data.knowledge_level,
        source_type=data.source_type,
        source_id=data.source_id,
        notes=data.notes,
    )
    db.add(rec)
    await db.commit()
    await db.refresh(rec)
    return rec


async def update_character_knowledge(
    db: AsyncSession, knowledge_id: int, data: CharacterKnowledgeUpdate
) -> Optional[CharacterKnowledge]:
    rec = await get_character_knowledge_by_id(db, knowledge_id)
    if rec:
        for key, value in data.model_dump(exclude_unset=True).items():
            setattr(rec, key, value)
        await db.commit()
        await db.refresh(rec)
    return rec


async def delete_character_knowledge(db: AsyncSession, knowledge_id: int) -> bool:
    rec = await get_character_knowledge_by_id(db, knowledge_id)
    if rec:
        await db.delete(rec)
        await db.commit()
        return True
    return False
