from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List
from pathlib import Path
from app.database import get_master_db as get_db
from fastapi.responses import FileResponse
from app.config import UPLOADS_DIR, DATA_DIR
from app.schemas import Universe, UniverseCreate, UniverseUpdate
from app.utils.upload_limits import read_and_validate_upload
from app.services import knowledge
from app.services.time_service import time_service

router = APIRouter(prefix="/universes", tags=["universes"])

def _background_audio_dir(universe_id: int) -> Path:
    """Папка фоновой музыки: data/{id}/uploads/audio/background или data/uploads/audio/background."""
    per_universe = DATA_DIR / str(universe_id) / "uploads" / "audio" / "background"
    if per_universe.exists():
        return per_universe
    return UPLOADS_DIR / "audio" / "background"

ALLOWED_IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".webp"}

@router.get("/debug")
async def debug_universes(db: AsyncSession = Depends(get_db)):
    """Диагностический эндпоинт для проверки состояния базы данных"""
    from app.config import DATA_DIR
    from app.database import MASTER_DB_PATH
    from sqlalchemy import text
    
    result = {
        "db_path": str(MASTER_DB_PATH),
        "db_exists": MASTER_DB_PATH.exists(),
        "data_dir": str(DATA_DIR),
        "data_dir_exists": DATA_DIR.exists(),
    }
    
    try:
        # Проверяем таблицу
        table_check = await db.execute(text("SELECT name FROM sqlite_master WHERE type='table' AND name='universes'"))
        table_exists = table_check.scalar() is not None
        result["table_exists"] = table_exists
        
        if table_exists:
            # Подсчитываем записи
            count_result = await db.execute(text("SELECT COUNT(*) FROM universes"))
            total_count = count_result.scalar()
            result["total_count"] = total_count
            
            # Пробуем получить все вселенные через ORM
            universes = await knowledge.get_universes(db, skip=0, limit=100)
            result["orm_count"] = len(universes)
            result["universes"] = [{"id": u.id, "title": u.title} for u in universes]
    except Exception as e:
        result["error"] = str(e)
        import traceback
        result["traceback"] = traceback.format_exc()
    
    return result

@router.get("", response_model=List[Universe])
async def list_universes(skip: int = 0, limit: int = 100, db: AsyncSession = Depends(get_db)):
    """Получить список всех вселенных"""
    return await knowledge.get_universes(db, skip=skip, limit=limit)

@router.post("", response_model=Universe)
async def create_universe(universe: UniverseCreate, db: AsyncSession = Depends(get_db)):
    """Создать новую вселенную"""
    return await knowledge.create_universe(db, universe)

@router.get("/{universe_id}", response_model=Universe)
async def get_universe(universe_id: int, db: AsyncSession = Depends(get_db)):
    """Получить вселенную по ID"""
    db_universe = await knowledge.get_universe(universe_id, db)
    if not db_universe:
        raise HTTPException(status_code=404, detail="Вселенная не найдена")
    return db_universe

@router.put("/{universe_id}", response_model=Universe)
async def update_universe(universe_id: int, universe: UniverseUpdate, db: AsyncSession = Depends(get_db)):
    """Обновить вселенную"""
    db_universe = await knowledge.update_universe(db, universe_id, universe)
    if not db_universe:
        raise HTTPException(status_code=404, detail="Вселенная не найдена")
    return db_universe

@router.delete("/{universe_id}")
async def delete_universe(universe_id: int, db: AsyncSession = Depends(get_db)):
    """Удалить вселенную"""
    success = await knowledge.delete_universe(db, universe_id)
    if not success:
        raise HTTPException(status_code=404, detail="Вселенная не найдена")
    return {"message": "Вселенная удалена"}


@router.post("/{universe_id}/cover", response_model=Universe)
async def upload_cover(universe_id: int, file: UploadFile = File(...), db: AsyncSession = Depends(get_db)):
    """Загрузить обложку вселенной"""
    db_universe = await knowledge.get_universe(universe_id, db)
    if not db_universe:
        raise HTTPException(status_code=404, detail="Вселенная не найдена")
    suffix = Path(file.filename or "").suffix.lower()
    if suffix not in ALLOWED_IMAGE_EXTENSIONS:
        suffix = ".jpg"
    from app.config import get_universe_uploads_dir
    u_uploads_dir = get_universe_uploads_dir(universe_id)
    covers_dir = u_uploads_dir / "covers"
    covers_dir.mkdir(parents=True, exist_ok=True)
    path = covers_dir / f"cover{suffix}"
    content = await read_and_validate_upload(file)
    path.write_bytes(content)
    # Сохраняем путь относительно корня DATA_DIR для универсальности раздачи
    relative_path = f"universes/{universe_id}/uploads/covers/cover{suffix}"
    await knowledge.update_universe(db, universe_id, UniverseUpdate(cover_image_path=relative_path))
    return await knowledge.get_universe(universe_id, db)


@router.delete("/{universe_id}/cover", response_model=Universe)
async def delete_cover(universe_id: int, db: AsyncSession = Depends(get_db)):
    """Удалить обложку вселенной"""
    db_universe = await knowledge.get_universe(universe_id, db)
    if not db_universe:
        raise HTTPException(status_code=404, detail="Вселенная не найдена")
    if getattr(db_universe, "cover_image_path", None):
        full_path = DATA_DIR / db_universe.cover_image_path
        if full_path.exists():
            full_path.unlink()
    await knowledge.update_universe(db, universe_id, UniverseUpdate(cover_image_path=None))
    return await knowledge.get_universe(universe_id, db)


@router.get("/{universe_id}/background-audio")
async def list_background_audio(universe_id: int, db: AsyncSession = Depends(get_db)):
    """Список MP3 для фоновой музыки вселенной (папка вселенной или общая). Порядок по имени файла."""
    db_universe = await knowledge.get_universe(universe_id, db)
    if not db_universe:
        raise HTTPException(status_code=404, detail="Вселенная не найдена")
    directory = _background_audio_dir(universe_id)
    if not directory.exists():
        return []
    mp3_files = sorted(f.name for f in directory.iterdir() if f.suffix.lower() == ".mp3")
    base = f"/api/universes/{universe_id}/audio/background"
    return [{"url": f"{base}/{name}", "name": name} for name in mp3_files]


@router.get("/{universe_id}/audio/background/{filename}")
async def serve_background_audio_file(universe_id: int, filename: str, db: AsyncSession = Depends(get_db)):
    """Раздача одного MP3 файла фоновой музыки."""
    db_universe = await knowledge.get_universe(universe_id, db)
    if not db_universe:
        raise HTTPException(status_code=404, detail="Вселенная не найдена")
    if ".." in filename or "/" in filename or "\\" in filename:
        raise HTTPException(status_code=400, detail="Недопустимое имя файла")
    directory = _background_audio_dir(universe_id)
    path = (directory / filename).resolve()
    try:
        path.relative_to(directory.resolve())
    except ValueError:
        raise HTTPException(status_code=404, detail="Файл не найден")
    if not path.is_file() or path.suffix.lower() != ".mp3":
        raise HTTPException(status_code=404, detail="Файл не найден")
    return FileResponse(path, media_type="audio/mpeg")


@router.get("/{universe_id}/clock")
async def get_universe_clock(universe_id: int, db: AsyncSession = Depends(get_db)):
    """Получить текущее время во вселенной"""
    db_universe = await knowledge.get_universe(universe_id, db)
    if not db_universe:
        raise HTTPException(status_code=404, detail="Вселенная не найдена")
    return time_service.get_current_universe_time(db_universe)
