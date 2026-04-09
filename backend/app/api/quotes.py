from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List, Optional
from app.database import get_db, get_master_db
from app.schemas import Quote, QuoteCreate, QuoteUpdate
from app.services import knowledge

router = APIRouter(prefix="/universes/{universe_id}/quotes", tags=["quotes"])

@router.get("", response_model=List[Quote])
async def get_quotes(universe_id: int, character_id: Optional[int] = None, db: AsyncSession = Depends(get_db), master_db: AsyncSession = Depends(get_master_db)):
    """Получить все цитаты вселенной, опционально отфильтрованные по персонажу"""
    book = await knowledge.get_universe(universe_id, master_db)
    if not book:
        raise HTTPException(status_code=404, detail="Вселенная не найдена")
    
    from app.models import Quote as QuoteModel
    stmt = select(QuoteModel).filter(QuoteModel.universe_id == universe_id)
    
    if character_id:
        stmt = stmt.filter(QuoteModel.character_id == character_id)
    
    stmt = stmt.order_by(QuoteModel.created_at.desc())
    result = await db.execute(stmt)
    return result.scalars().all()

@router.get("/{quote_id}", response_model=Quote)
async def get_quote(universe_id: int, quote_id: int, db: AsyncSession = Depends(get_db)):
    """Получить одну цитату"""
    from app.models import Quote as QuoteModel
    stmt = select(QuoteModel).filter(
        QuoteModel.id == quote_id,
        QuoteModel.universe_id == universe_id
    )
    result = await db.execute(stmt)
    quote = result.scalars().first()
    
    if not quote:
        raise HTTPException(status_code=404, detail="Цитата не найдена")
    
    return quote

@router.post("", response_model=Quote)
async def create_quote(universe_id: int, quote: QuoteCreate, db: AsyncSession = Depends(get_db), master_db: AsyncSession = Depends(get_master_db)):
    """Создать новую цитату"""
    book = await knowledge.get_universe(universe_id, master_db)
    if not book:
        raise HTTPException(status_code=404, detail="Вселенная не найдена")
    
    character = await knowledge.get_character(db, quote.character_id)
    if not character or character.universe_id != universe_id:
        raise HTTPException(status_code=400, detail="Персонаж не найден или не принадлежит этой вселенной")
    
    from app.models import Quote as QuoteModel
    db_quote = QuoteModel(
        universe_id=universe_id,
        character_id=quote.character_id,
        interlocutor_type=quote.interlocutor_type,
        interlocutor_id=quote.interlocutor_id,
        quote_text=quote.quote_text,
        context=quote.context
    )
    db.add(db_quote)
    await db.commit()
    await db.refresh(db_quote)
    return db_quote

@router.delete("/{quote_id}")
async def delete_quote(universe_id: int, quote_id: int, db: AsyncSession = Depends(get_db)):
    """Удалить цитату"""
    from app.models import Quote as QuoteModel
    stmt = select(QuoteModel).filter(
        QuoteModel.id == quote_id,
        QuoteModel.universe_id == universe_id
    )
    result = await db.execute(stmt)
    db_quote = result.scalars().first()
    
    if not db_quote:
        raise HTTPException(status_code=404, detail="Цитата не найдена")
    
    await db.delete(db_quote)
    await db.commit()
    return {"message": "Цитата удалена"}
