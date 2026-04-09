import logging
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional

from app.config import DATA_DIR
from app.database import get_db, get_master_db
from app.schemas import Location, LocationCreate, LocationUpdate
from app.utils.upload_limits import read_and_validate_upload
from app.services import knowledge
from app.services.ai_generator import ai_generator_service
from app.services.context_manager import context_manager
from app.services.llm import llm_service
from app.services.llm_config import load_llm_settings_from_system
from app.repositories.settings import get_system_settings

router = APIRouter(prefix="/universes/{universe_id}/locations", tags=["locations"])
logger = logging.getLogger(__name__)

ALLOWED_IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".webp"}

_location_schema_ensured: set = set()


async def _ensure_location_image_columns_if_needed(universe_id: int):
    """Один раз за сессию для вселенной: добавить колонки изображений в locations, если их нет."""
    if universe_id in _location_schema_ensured:
        return
    from app.database import get_universe_engine
    from app.database import _ensure_location_image_columns
    engine = get_universe_engine(universe_id)
    async with engine.connect() as conn:
        await conn.run_sync(_ensure_location_image_columns)
    _location_schema_ensured.add(universe_id)


def _build_location_image_prompt_from_location(db_location, universe=None) -> str:
    """Собрать промпт для изображения локации из полей модели."""
    name = (getattr(db_location, "name", None) or "").strip()
    loc_type = (getattr(db_location, "location_type", None) or "").strip()
    description = (getattr(db_location, "description", None) or "").strip()[:300]
    details = (getattr(db_location, "details", None) or "").strip()[:200]
    parts = []
    if loc_type:
        parts.append(loc_type)
    if name and name.lower() != loc_type.lower():
        parts.append(name)
    if description:
        parts.append(description)
    if details:
        parts.append(details)
    prompt = "atmospheric landscape or environment, " + ", ".join(p for p in parts if p)
    prompt += ", highly detailed, dramatic lighting, 8k resolution"
    if universe:
        genre = (getattr(universe, "genre", None) or "").strip()
        if genre:
            prompt += f", {genre} style"
    prompt += ", no text no letters no words in the image"
    return prompt

@router.get("", response_model=List[Location])
async def list_locations(universe_id: int, db: AsyncSession = Depends(get_db), master_db: AsyncSession = Depends(get_master_db)):
    """Получить все локации вселенной"""
    if not await knowledge.get_universe(universe_id, master_db):
        raise HTTPException(status_code=404, detail="Вселенная не найдена")
    await _ensure_location_image_columns_if_needed(universe_id)
    return await knowledge.get_locations(db, universe_id)

@router.post("", response_model=Location)
async def create_location(universe_id: int, location: LocationCreate, db: AsyncSession = Depends(get_db), master_db: AsyncSession = Depends(get_master_db)):
    """Создать новую локацию"""
    if not await knowledge.get_universe(universe_id, master_db):
        raise HTTPException(status_code=404, detail="Вселенная не найдена")
    data = location.model_dump()
    data["universe_id"] = universe_id
    return await knowledge.create_location(db, LocationCreate(**data))

@router.get("/{location_id}", response_model=Location)
async def get_location(universe_id: int, location_id: int, db: AsyncSession = Depends(get_db)):
    """Получить локацию по ID"""
    db_location = await knowledge.get_location(db, location_id)
    if not db_location or db_location.universe_id != universe_id:
        raise HTTPException(status_code=404, detail="Локация не найдена")
    return db_location


@router.post("/{location_id}/autofill")
async def autofill_location(universe_id: int, location_id: int, db: AsyncSession = Depends(get_db), master_db: AsyncSession = Depends(get_master_db)):
    """Заполнить пустые поля локации по контексту вселенной (ИИ)."""
    db_location = await knowledge.get_location(db, location_id)
    if not db_location or db_location.universe_id != universe_id:
        raise HTTPException(status_code=404, detail="Локация не найдена")
    context = await context_manager.build_context(db, universe_id, master_db=master_db)
    current = {
        "name": db_location.name or "",
        "description": db_location.description or "",
        "location_type": db_location.location_type or "",
        "details": db_location.details or "",
    }
    return await ai_generator_service.autofill_location(context, current)


@router.put("/{location_id}", response_model=Location)
async def update_location(universe_id: int, location_id: int, location: LocationUpdate, db: AsyncSession = Depends(get_db)):
    """Обновить локацию"""
    db_location = await knowledge.update_location(db, location_id, location)
    if not db_location or db_location.universe_id != universe_id:
        raise HTTPException(status_code=404, detail="Локация не найдена")
    return db_location

@router.delete("/{location_id}")
async def delete_location(universe_id: int, location_id: int, db: AsyncSession = Depends(get_db)):
    """Удалить локацию"""
    db_location = await knowledge.get_location(db, location_id)
    if not db_location or db_location.universe_id != universe_id:
        raise HTTPException(status_code=404, detail="Локация не найдена")
    success = await knowledge.delete_location(db, location_id)
    if not success:
        raise HTTPException(status_code=404, detail="Локация не найдена")
    return {"message": "Локация удалена"}


@router.post("/{location_id}/image/generate", response_model=Location)
async def generate_location_image(
    universe_id: int,
    location_id: int,
    prompt: Optional[str] = Form(None),
    db: AsyncSession = Depends(get_db),
    master_db: AsyncSession = Depends(get_master_db),
):
    """Сгенерировать изображение локации по промпту (или по сохранённому/авто-промпту)."""
    db_location = await knowledge.get_location(db, location_id)
    if not db_location or db_location.universe_id != universe_id:
        raise HTTPException(status_code=404, detail="Локация не найдена")

    system_settings = await get_system_settings(master_db)
    universe = await knowledge.get_universe(universe_id, master_db)

    saved_prompt = (getattr(db_location, "image_ai_prompt", None) or "").strip()
    if not saved_prompt and not prompt:
        provider, model = load_llm_settings_from_system(system_settings)
        location_data = {
            "name": getattr(db_location, "name", None) or "",
            "description": getattr(db_location, "description", None) or "",
            "location_type": getattr(db_location, "location_type", None) or "",
            "details": getattr(db_location, "details", None) or "",
        }
        universe_data = {}
        if universe:
            universe_data = {
                "genre": getattr(universe, "genre", None) or "",
                "style_notes": getattr(universe, "style_notes", None) or "",
                "description": getattr(universe, "description", None) or "",
            }
        generated = await ai_generator_service.generate_location_image_prompt(
            location_data, universe_data, provider, model
        )
        if generated:
            saved_prompt = generated
            await knowledge.update_location(db, location_id, LocationUpdate(image_ai_prompt=saved_prompt))
            db_location = await knowledge.get_location(db, location_id)
        else:
            saved_prompt = _build_location_image_prompt_from_location(db_location, universe)

    prompt_to_use = (prompt or saved_prompt or _build_location_image_prompt_from_location(db_location, universe)).strip()
    if not prompt_to_use:
        raise HTTPException(status_code=400, detail="Не задан промпт для генерации изображения.")

    prompt_to_use = f"{prompt_to_use}, no text no letters no words in the image"
    image_provider = (getattr(system_settings, "image_provider", None) or "openrouter").strip().lower()

    try:
        if image_provider == "whisk":
            whisk_cookie = getattr(system_settings, "whisk_google_cookie", None) or ""
            if not whisk_cookie.strip():
                raise HTTPException(status_code=400, detail="Для Whisk укажите cookie Google в настройках (Генерация изображений).")
            image_bytes = await llm_service.generate_image_whisk(prompt_to_use, whisk_cookie)
        elif image_provider == "pixazo":
            pixazo_key = getattr(system_settings, "pixazo_api_key", None) or ""
            if not pixazo_key.strip():
                raise HTTPException(status_code=400, detail="Для генерации изображения настройте Pixazo API ключ в настройках.")
            pixazo_model = (getattr(system_settings, "pixazo_model", None) or "flux-1-schnell").strip().lower()
            if pixazo_model == "flux-1-schnell":
                image_bytes = await llm_service.generate_image_pixazo_schnell(prompt_to_use, pixazo_key)
            else:
                image_bytes = await llm_service.generate_image_pixazo_text_to_image(prompt_to_use, pixazo_key)
        elif image_provider == "cloudflare":
            cf_url = getattr(system_settings, "cloudflare_image_url", None) or ""
            cf_key = getattr(system_settings, "cloudflare_image_api_key", None) or ""
            image_bytes = await llm_service.generate_image_cloudflare(prompt_to_use, cf_url, cf_key)
        else:
            llm_service.openrouter_api_key = getattr(system_settings, "openrouter_api_key", None) or ""
            llm_service.openrouter_url = getattr(system_settings, "openrouter_base_url", None) or "https://openrouter.ai/api/v1"
            _raw = getattr(system_settings, "openrouter_image_model", None) or ""
            deprecated = ["gemini-2.0-flash-exp", "gemini-2.5-flash-image-preview"]
            image_model = "google/gemini-2.5-flash-image" if not _raw or any(d in _raw.lower() for d in deprecated) else _raw
            if not llm_service.openrouter_api_key:
                raise HTTPException(status_code=400, detail="Для генерации изображения настройте OpenRouter API ключ в настройках.")
            image_bytes = await llm_service.generate_image_openrouter(prompt_to_use, model=image_model)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("location image/generate failed")
        raise HTTPException(status_code=502, detail=f"Ошибка генерации изображения: {e!s}")

    if getattr(db_location, "image_path", None):
        old_path = DATA_DIR / db_location.image_path
        if old_path.exists():
            old_path.unlink()

    from app.config import get_universe_uploads_dir
    u_uploads_dir = get_universe_uploads_dir(universe_id)
    locations_dir = u_uploads_dir / "locations"
    locations_dir.mkdir(parents=True, exist_ok=True)
    suffix = ".png"
    path = locations_dir / f"{location_id}{suffix}"
    path.write_bytes(image_bytes)
    relative_path = f"universes/{universe_id}/uploads/locations/{location_id}{suffix}"
    await knowledge.update_location(db, location_id, LocationUpdate(image_path=relative_path))
    return await knowledge.get_location(db, location_id)


@router.post("/{location_id}/image", response_model=Location)
async def upload_location_image(
    universe_id: int,
    location_id: int,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
):
    """Загрузить изображение локации."""
    db_location = await knowledge.get_location(db, location_id)
    if not db_location or db_location.universe_id != universe_id:
        raise HTTPException(status_code=404, detail="Локация не найдена")

    suffix = Path(file.filename or "").suffix.lower() if file.filename else ".png"
    if suffix not in ALLOWED_IMAGE_EXTENSIONS:
        suffix = ".png"
    content = await read_and_validate_upload(file)
    if not content:
        raise HTTPException(status_code=400, detail="Файл пустой.")

    if getattr(db_location, "image_path", None):
        old_path = DATA_DIR / db_location.image_path
        if old_path.exists():
            old_path.unlink()

    from app.config import get_universe_uploads_dir
    u_uploads_dir = get_universe_uploads_dir(universe_id)
    locations_dir = u_uploads_dir / "locations"
    locations_dir.mkdir(parents=True, exist_ok=True)
    path = locations_dir / f"{location_id}{suffix}"
    path.write_bytes(content)
    relative_path = f"universes/{universe_id}/uploads/locations/{location_id}{suffix}"
    await knowledge.update_location(db, location_id, LocationUpdate(image_path=relative_path))
    return await knowledge.get_location(db, location_id)


@router.delete("/{location_id}/image", response_model=Location)
async def delete_location_image(
    universe_id: int,
    location_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Удалить изображение локации."""
    db_location = await knowledge.get_location(db, location_id)
    if not db_location or db_location.universe_id != universe_id:
        raise HTTPException(status_code=404, detail="Локация не найдена")
    if getattr(db_location, "image_path", None):
        full_path = DATA_DIR / db_location.image_path
        if full_path.exists():
            full_path.unlink()
    await knowledge.update_location(db, location_id, LocationUpdate(image_path=None))
    return await knowledge.get_location(db, location_id)
