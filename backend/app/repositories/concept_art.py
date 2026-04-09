from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from typing import List, Optional
from app.models.concept_art import ConceptArt
from app.schemas.concept_art import ConceptArtCreate, ConceptArtUpdate

async def get_concept_arts(db: AsyncSession, universe_id: int) -> List[ConceptArt]:
    result = await db.execute(
        select(ConceptArt)
        .filter(ConceptArt.universe_id == universe_id)
        .order_by(ConceptArt.sort_order.asc(), ConceptArt.created_at.desc())
    )
    return result.scalars().all()

async def get_concept_art(db: AsyncSession, art_id: int) -> Optional[ConceptArt]:
    result = await db.execute(select(ConceptArt).filter(ConceptArt.id == art_id))
    return result.scalars().first()

async def create_concept_art(db: AsyncSession, universe_id: int, art: ConceptArtCreate, image_path: str) -> ConceptArt:
    db_art = ConceptArt(
        **art.model_dump(),
        universe_id=universe_id,
        image_path=image_path
    )
    db.add(db_art)
    await db.commit()
    await db.refresh(db_art)
    return db_art

async def update_concept_art(db: AsyncSession, art_id: int, art: ConceptArtUpdate) -> Optional[ConceptArt]:
    db_art = await get_concept_art(db, art_id)
    if db_art:
        update_data = art.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(db_art, key, value)
        await db.commit()
        await db.refresh(db_art)
    return db_art

async def update_art_order(db: AsyncSession, universe_id: int, art_ids: List[int]):
    """Массовое обновление порядка сортировки."""
    for index, art_id in enumerate(art_ids):
        await db.execute(
            update(ConceptArt)
            .where(ConceptArt.id == art_id, ConceptArt.universe_id == universe_id)
            .values(sort_order=index)
        )
    await db.commit()

async def delete_concept_art(db: AsyncSession, art_id: int) -> bool:
    db_art = await get_concept_art(db, art_id)
    if db_art:
        await db.delete(db_art)
        await db.commit()
        return True
    return False
