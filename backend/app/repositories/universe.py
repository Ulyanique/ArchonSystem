from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from typing import List, Optional
from datetime import datetime, timezone
from app.models import Universe
from app.schemas import UniverseCreate, UniverseUpdate
from app.services.rag import rag_service
from app.database import MasterSessionLocal

async def _touch_universe(universe_id: int):
    """Обновить время изменения вселенной в мастер-базе."""
    async with MasterSessionLocal() as db:
        await db.execute(update(Universe).where(Universe.id == universe_id).values(updated_at=datetime.now(timezone.utc)))
        await db.commit()

def _to_universe_id(data: dict, key: str = "universe_id", compat_key: str = "universe_id") -> dict:
    """Маппинг universe_id из API в universe_id для БД."""
    out = {k: v for k, v in data.items() if k not in (key, compat_key)}
    out["universe_id"] = data.get(key) or data.get(compat_key)
    return out

async def get_universes(db: AsyncSession, skip: int = 0, limit: int = 100) -> List[Universe]:
    """Получить список всех вселенных из мастер-базы."""
    result = await db.execute(select(Universe).offset(skip).limit(limit))
    return result.scalars().all()

async def get_universe(universe_id: int, db: AsyncSession) -> Optional[Universe]:
    """Получить вселенную из мастер-базы."""
    result = await db.execute(select(Universe).filter(Universe.id == universe_id))
    return result.scalars().first()

async def create_universe(db: AsyncSession, universe: UniverseCreate) -> Universe:
    """Создать новую вселенную в мастер-базе."""
    db_universe = Universe(**universe.model_dump())
    db.add(db_universe)
    await db.commit()
    await db.refresh(db_universe)

    # Инициализируем базу данных и директории для вселенной
    from app.database import init_universe_db
    await init_universe_db(db_universe.id)

    from app.config import get_universe_uploads_dir
    get_universe_uploads_dir(db_universe.id)

    if universe.description:
        rag_service.add_document(
            universe_id=db_universe.id,
            doc_id=f"universe_{db_universe.id}",
            content=universe.description,
            metadata={"type": "universe", "title": universe.title, "entity_type": "universe", "entity_id": db_universe.id}
        )
    return db_universe

async def update_universe(db: AsyncSession, universe_id: int, universe: UniverseUpdate) -> Optional[Universe]:
    """Обновить вселенную в мастер-базе."""
    db_universe = await get_universe(universe_id, db)
    if db_universe:
        update_data = universe.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(db_universe, key, value)
        await db.commit()
        await db.refresh(db_universe)

        content = db_universe.description or ""
        if content or db_universe.title:
            rag_service.add_document(
                universe_id=db_universe.id,
                doc_id=f"universe_{db_universe.id}",
                content=content or db_universe.title,
                metadata={"type": "universe", "title": db_universe.title, "entity_type": "universe", "entity_id": db_universe.id}
            )
    return db_universe

async def delete_universe(db: AsyncSession, universe_id: int) -> bool:
    """Удалить вселенную из мастер-базы и очистить ее данные."""
    db_universe = await get_universe(universe_id, db)
    if db_universe:
        rag_service.clear_universe(universe_id)
        await db.delete(db_universe)
        await db.commit()

        # В идеале здесь также нужно удалить директорию вселенной
        # import shutil
        # from app.config import DATA_DIR
        # universe_dir = DATA_DIR / "universes" / str(universe_id)
        # if universe_dir.exists():
        #     shutil.rmtree(universe_dir)

        return True
    return False
