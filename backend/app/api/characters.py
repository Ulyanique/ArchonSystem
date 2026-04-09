import logging
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query, Body, Form
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional
from pathlib import Path
from pydantic import BaseModel
from app.database import get_db, get_master_db

logger = logging.getLogger(__name__)
from app.config import DATA_DIR
from app.schemas import Character, CharacterCreate, CharacterUpdate, ChatTime
from app.utils.upload_limits import read_and_validate_upload, validate_upload_size
from app.services import knowledge
from app.services.ai_generator import ai_generator_service
from app.services.context_manager import context_manager
from app.services.character_context import _events_character_knows, get_character_knowledge
from app.services.llm import llm_service
from app.services.llm_config import load_llm_settings_from_system
from app.repositories.settings import get_system_settings

router = APIRouter(prefix="/universes/{universe_id}/characters", tags=["characters"])

ALLOWED_IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".webp"}


def _strip_name_from_text(name: str, text: str) -> str:
    """Убрать имя персонажа из строки, чтобы модель не рисовала его текстом."""
    if not name or not text:
        return text
    import re
    s = text
    # Сначала убираем полную фразу имени
    s = re.sub(re.escape(name), "", s, flags=re.IGNORECASE)
    for part in name.split():
        if len(part) > 1:
            s = re.sub(re.escape(part), "", s, flags=re.IGNORECASE)
    s = re.sub(r"\s+", " ", s).strip().strip(",-—:")
    return s


def _build_portrait_prompt_from_character(db_character, universe=None) -> str:
    """Промпт в том же принципе, что и «промпт для других нейросетей» в форме:
    полный контекст персонажа + сеттинг вселенной, формат [тип], [внешность], [стиль], [качество].
    Имя из полей вырезается."""
    name = (getattr(db_character, "name", None) or "").strip()
    parts = []
    # Тип и базовая внешность (без имени)
    gender = (getattr(db_character, "gender", None) or "").strip().lower()
    if gender in ("м", "муж", "male", "мужской", "мужчина"):
        parts.append("man")
    elif gender in ("ж", "жен", "female", "женский", "женщина"):
        parts.append("woman")
    else:
        parts.append("person")
    age = getattr(db_character, "age", None)
    if age is not None:
        if age < 18:
            parts.append("young")
        elif age > 50:
            parts.append("older")
    appearance = (getattr(db_character, "appearance", None) or "").strip()
    if appearance:
        appearance = _strip_name_from_text(name, appearance[:300])
        if appearance:
            parts.append(appearance)
    role = (getattr(db_character, "role", None) or "").strip()
    profession = (getattr(db_character, "profession", None) or "").strip()
    if role or profession:
        visual_role = (role or profession).split(",")[0].strip()[:80]
        visual_role = _strip_name_from_text(name, visual_role)
        if visual_role and visual_role.lower() not in ("man", "woman", "person"):
            parts.append(f"as {visual_role}")
    description = (getattr(db_character, "description", None) or "").strip()
    if description and len(parts) < 4:
        description = _strip_name_from_text(name, description[:150])
        if description:
            parts.append(description)
    # Сеттинг вселенной — жанр, стилистика, тон (как в настройках для других нейросетей)
    style_parts = []
    if universe:
        genre = (getattr(universe, "genre", None) or "").strip()
        if genre:
            style_parts.append(genre)
        style_notes = (getattr(universe, "style_notes", None) or "").strip()
        if style_notes:
            style_parts.append(style_notes[:200])
        desc = (getattr(universe, "description", None) or "").strip()
        if desc and len(style_parts) < 2:
            style_parts.append(desc[:150])
    character_part = ", ".join(p for p in parts if p)
    prompt = f"portrait of {character_part}, highly detailed, professional lighting, 8k resolution"
    if style_parts:
        setting = ", ".join(style_parts)
        prompt = f"{prompt}, {setting} style and setting"
    prompt = f"{prompt}, photorealistic, no text no letters no words in the image"
    return prompt


class GeneratePortraitBody(BaseModel):
    prompt: Optional[str] = None


@router.get("", response_model=List[Character])
async def list_characters(universe_id: int, db: AsyncSession = Depends(get_db), master_db: AsyncSession = Depends(get_master_db)):
    """Получить всех персонажей вселенной"""
    universe = await knowledge.get_universe(universe_id, master_db)
    if not universe:
        raise HTTPException(status_code=404, detail="Вселенная не найдена")
    return await knowledge.get_characters(db, universe_id)

@router.post("", response_model=Character)
async def create_character(universe_id: int, character: CharacterCreate, db: AsyncSession = Depends(get_db), master_db: AsyncSession = Depends(get_master_db)):
    if not await knowledge.get_universe(universe_id, master_db):
        raise HTTPException(status_code=404, detail="Вселенная не найдена")
    data = character.model_dump()
    data["universe_id"] = universe_id
    return await knowledge.create_character(db, CharacterCreate(**data))

@router.get("/{character_id}", response_model=Character)
async def get_character(universe_id: int, character_id: int, db: AsyncSession = Depends(get_db)):
    db_character = await knowledge.get_character(db, character_id)
    if not db_character or db_character.universe_id != universe_id:
        raise HTTPException(status_code=404, detail="Персонаж не найден")
    return db_character

@router.post("/{character_id}/autofill")
async def autofill_character(universe_id: int, character_id: int, db: AsyncSession = Depends(get_db), master_db: AsyncSession = Depends(get_master_db)):
    """Заполнить пустые поля персонажа по контексту вселенной (ИИ)."""
    db_character = await knowledge.get_character(db, character_id)
    if not db_character or db_character.universe_id != universe_id:
        raise HTTPException(status_code=404, detail="Персонаж не найден")
    context = await context_manager.build_context(db, universe_id, master_db=master_db)
    current = {
        "name": db_character.name or "",
        "description": db_character.description or "",
        "role": db_character.role or "",
        "traits": db_character.traits or "",
        "appearance": db_character.appearance or "",
        "backstory": db_character.backstory or "",
    }
    return await ai_generator_service.autofill_character(context, current)


class GenerateFieldBody(BaseModel):
    field: str


@router.post("/{character_id}/generate-field")
async def generate_character_field_endpoint(
    universe_id: int,
    character_id: int,
    body: GenerateFieldBody,
    db: AsyncSession = Depends(get_db),
    master_db: AsyncSession = Depends(get_master_db),
):
    """Сгенерировать значение одного поля персонажа (национальность, профессия и т.д.). Минимальный контекст — без сцен и длинного текста."""
    db_character = await knowledge.get_character(db, character_id)
    if not db_character or db_character.universe_id != universe_id:
        raise HTTPException(status_code=404, detail="Персонаж не найден")
    universe = await knowledge.get_universe(universe_id, master_db)
    if not universe:
        raise HTTPException(status_code=404, detail="Вселенная не найдена")
    field_name = (body.field or "").strip()
    if not field_name:
        raise HTTPException(status_code=400, detail="Укажите field")
    character_data = {
        "name": db_character.name or "",
        "role": getattr(db_character, "role", None) or "",
        "profession": getattr(db_character, "profession", None) or "",
        "description": getattr(db_character, "description", None) or "",
        "backstory": getattr(db_character, "backstory", None) or "",
        "traits": getattr(db_character, "traits", None) or "",
        "appearance": getattr(db_character, "appearance", None) or "",
        "goals": getattr(db_character, "goals", None) or "",
        "fears": getattr(db_character, "fears", None) or "",
        "conflicts": getattr(db_character, "conflicts", None) or "",
        "skills": getattr(db_character, "skills", None) or "",
        "abilities": getattr(db_character, "abilities", None) or "",
        "ai_analysis": getattr(db_character, "ai_analysis", None) or "",
    }
    universe_title = getattr(universe, "title", "") or ""
    universe_description = getattr(universe, "description", "") or ""
    system_settings = await get_system_settings(master_db)
    provider, model = load_llm_settings_from_system(system_settings)
    value = await ai_generator_service.generate_character_field(
        universe_title=universe_title,
        universe_description=universe_description,
        character_data=character_data,
        field_name=field_name,
        provider=provider,
        model=model,
    )
    return {"value": value or ""}


@router.post("/{character_id}/portrait/generate", response_model=Character)
async def generate_portrait(
    universe_id: int,
    character_id: int,
    prompt: Optional[str] = Form(None),
    source_image: Optional[UploadFile] = File(None),
    db: AsyncSession = Depends(get_db),
    master_db: AsyncSession = Depends(get_master_db),
):
    """Сначала генерируем промпт портрета (через LLM), затем по нему генерируем аватарку."""
    db_character = await knowledge.get_character(db, character_id)
    if not db_character or db_character.universe_id != universe_id:
        raise HTTPException(status_code=404, detail="Персонаж не найден")

    system_settings = await get_system_settings(master_db)
    universe = await knowledge.get_universe(universe_id, master_db)

    # Шаг 1: промпт портрета. Если нет сохранённого — генерируем через LLM и сохраняем.
    saved_prompt = (getattr(db_character, "portrait_ai_prompt", None) or "").strip()
    if not saved_prompt:
        provider, model = load_llm_settings_from_system(system_settings)
        character_data = {
            "appearance": getattr(db_character, "appearance", None) or "",
            "role": getattr(db_character, "role", None) or "",
            "gender": getattr(db_character, "gender", None) or "",
            "age": getattr(db_character, "age", None) or "",
            "description": getattr(db_character, "description", None) or "",
        }
        universe_data = {}
        if universe:
            universe_data = {
                "genre": getattr(universe, "genre", None) or "",
                "style_notes": getattr(universe, "style_notes", None) or "",
                "description": getattr(universe, "description", None) or "",
            }
        generated = await ai_generator_service.generate_portrait_prompt(
            character_data, universe_data, provider, model
        )
        if generated:
            saved_prompt = generated
            await knowledge.update_character(db, character_id, CharacterUpdate(portrait_ai_prompt=saved_prompt))
            db_character = await knowledge.get_character(db, character_id)
        else:
            saved_prompt = _build_portrait_prompt_from_character(db_character, universe)

    name = (getattr(db_character, "name", None) or "").strip()
    prompt = _strip_name_from_text(name, saved_prompt)
    if not prompt:
        prompt = _build_portrait_prompt_from_character(db_character, universe)
    prompt = f"{prompt}, no text no letters no words in the image"
    image_provider = (getattr(system_settings, "image_provider", None) or "openrouter").strip().lower()

    try:
        if image_provider == "whisk":
            whisk_cookie = getattr(system_settings, "whisk_google_cookie", None) or ""
            if not whisk_cookie.strip():
                raise HTTPException(status_code=400, detail="Для Whisk укажите cookie Google в настройках (Генерация изображений).")
            image_bytes = await llm_service.generate_image_whisk(prompt, whisk_cookie)
        elif image_provider == "pixazo":
            pixazo_key = getattr(system_settings, "pixazo_api_key", None) or ""
            if not pixazo_key.strip():
                raise HTTPException(
                    status_code=400,
                    detail="Для генерации портрета настройте Pixazo API ключ в настройках.",
                )
            pixazo_model = (getattr(system_settings, "pixazo_model", None) or "flux-1-schnell").strip().lower()
            if source_image and source_image.filename and (
                Path(source_image.filename or "").suffix.lower() in ALLOWED_IMAGE_EXTENSIONS
                or (source_image.content_type or "").startswith("image/")
            ):
                ref_bytes = await source_image.read()
                validate_upload_size(ref_bytes)
                image_bytes = await llm_service.generate_image_pixazo_image_to_image(
                    prompt, ref_bytes, pixazo_key
                )
            elif pixazo_model == "flux-1-schnell":
                image_bytes = await llm_service.generate_image_pixazo_schnell(prompt, pixazo_key)
            else:
                image_bytes = await llm_service.generate_image_pixazo_text_to_image(prompt, pixazo_key)
        elif image_provider == "cloudflare":
            cf_url = getattr(system_settings, "cloudflare_image_url", None) or ""
            cf_key = getattr(system_settings, "cloudflare_image_api_key", None) or ""
            image_bytes = await llm_service.generate_image_cloudflare(prompt, cf_url, cf_key)
        else:
            llm_service.openrouter_api_key = getattr(system_settings, "openrouter_api_key", None) or ""
            llm_service.openrouter_url = getattr(system_settings, "openrouter_base_url", None) or "https://openrouter.ai/api/v1"
            _raw = getattr(system_settings, "openrouter_image_model", None) or ""
            deprecated_models = ["gemini-2.0-flash-exp", "gemini-2.5-flash-image-preview"]
            if not _raw or any(dep in _raw.lower() for dep in deprecated_models):
                image_model = "google/gemini-2.5-flash-image"
            else:
                image_model = _raw
            if not llm_service.openrouter_api_key:
                raise HTTPException(
                    status_code=400,
                    detail="Для генерации портрета настройте OpenRouter API ключ в настройках.",
                )
            image_bytes = await llm_service.generate_image_openrouter(prompt, model=image_model)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("portrait/generate: image generation failed")
        raise HTTPException(status_code=502, detail=f"Ошибка генерации изображения: {e!s}")

    if getattr(db_character, "portrait_image_path", None):
        old_path = DATA_DIR / db_character.portrait_image_path
        if old_path.exists():
            old_path.unlink()

    from app.config import get_universe_uploads_dir
    u_uploads_dir = get_universe_uploads_dir(universe_id)
    portraits_dir = u_uploads_dir / "portraits"
    portraits_dir.mkdir(parents=True, exist_ok=True)
    suffix = ".png"
    path = portraits_dir / f"{character_id}{suffix}"
    path.write_bytes(image_bytes)
    relative_path = f"universes/{universe_id}/uploads/portraits/{character_id}{suffix}"
    await knowledge.update_character(db, character_id, CharacterUpdate(portrait_image_path=relative_path))
    return await knowledge.get_character(db, character_id)


@router.post("/{character_id}/portrait", response_model=Character)
async def upload_portrait(universe_id: int, character_id: int, file: UploadFile = File(...), db: AsyncSession = Depends(get_db)):
    """Загрузить портрет персонажа"""
    db_character = await knowledge.get_character(db, character_id)
    if not db_character or db_character.universe_id != universe_id:
        raise HTTPException(status_code=404, detail="Персонаж не найден")

    if getattr(db_character, "portrait_image_path", None):
        old_path = DATA_DIR / db_character.portrait_image_path
        if old_path.exists():
            old_path.unlink()

    from app.config import get_universe_uploads_dir
    u_uploads_dir = get_universe_uploads_dir(universe_id)
    portraits_dir = u_uploads_dir / "portraits"
    portraits_dir.mkdir(parents=True, exist_ok=True)

    suffix = Path(file.filename or "").suffix.lower()
    if suffix not in ALLOWED_IMAGE_EXTENSIONS:
        suffix = ".jpg"

    path = portraits_dir / f"{character_id}{suffix}"
    content = await read_and_validate_upload(file)
    path.write_bytes(content)

    relative_path = f"universes/{universe_id}/uploads/portraits/{character_id}{suffix}"
    await knowledge.update_character(db, character_id, CharacterUpdate(portrait_image_path=relative_path))
    return await knowledge.get_character(db, character_id)

@router.delete("/{character_id}/portrait", response_model=Character)
async def delete_portrait(universe_id: int, character_id: int, db: AsyncSession = Depends(get_db)):
    """Удалить портрет персонажа"""
    db_character = await knowledge.get_character(db, character_id)
    if not db_character or db_character.universe_id != universe_id:
        raise HTTPException(status_code=404, detail="Персонаж не найден")
    if getattr(db_character, "portrait_image_path", None):
        full_path = DATA_DIR / db_character.portrait_image_path
        if full_path.exists():
            full_path.unlink()
    await knowledge.update_character(db, character_id, CharacterUpdate(portrait_image_path=None))
    return await knowledge.get_character(db, character_id)

@router.put("/{character_id}", response_model=Character)
async def update_character(universe_id: int, character_id: int, character: CharacterUpdate, db: AsyncSession = Depends(get_db)):
    """Обновить персонажа"""
    db_character = await knowledge.update_character(db, character_id, character)
    if not db_character or db_character.universe_id != universe_id:
        raise HTTPException(status_code=404, detail="Персонаж не найден")
    return db_character

@router.delete("/{character_id}")
async def delete_character(universe_id: int, character_id: int, db: AsyncSession = Depends(get_db), master_db: AsyncSession = Depends(get_master_db)):
    """Удалить персонажа"""
    db_character = await knowledge.get_character(db, character_id)
    if not db_character or db_character.universe_id != universe_id:
        raise HTTPException(status_code=404, detail="Персонаж не найден")
    success = await knowledge.delete_character(db, character_id)
    if not success:
        raise HTTPException(status_code=404, detail="Персонаж не найден")
    return {"message": "Персонаж удалён"}

def _empty_knowledge_stats(before_universe_year=None, before_universe_day=None):
    """Минимальный ответ при ошибке (например, устаревшая схема БД вселенной)."""
    levels = ["rumors", "superficial", "good", "complete"]
    sources = ["participated", "witnessed", "heard", "read", "learned_from"]
    types = ["character", "event", "location", "concept"]
    return {
        "known_characters_count": 0,
        "known_events_count": 0,
        "before_universe_year": before_universe_year,
        "before_universe_day": before_universe_day,
        "by_level": {k: 0 for k in levels},
        "by_source": {k: 0 for k in sources},
        "by_type": {k: 0 for k in types},
    }


@router.get("/{character_id}/knowledge-stats")
async def get_character_knowledge_stats(
    universe_id: int,
    character_id: int,
    before_universe_year: Optional[int] = Query(None),
    before_universe_day: Optional[int] = Query(None),
    db: AsyncSession = Depends(get_db),
    master_db: AsyncSession = Depends(get_master_db)
):
    """Получить статистику знаний персонажа: количество известных персонажей и событий до указанного момента времени"""
    if not await knowledge.get_universe(universe_id, master_db):
        raise HTTPException(status_code=404, detail="Вселенная не найдена")
    char = await knowledge.get_character(db, character_id)
    if not char or char.universe_id != universe_id:
        raise HTTPException(status_code=404, detail="Персонаж не найден")

    try:
        knowledge_recs = await get_character_knowledge(db, character_id)
    except Exception as e:
        logger.warning("knowledge-stats: get_character_knowledge failed for character_id=%s: %s", character_id, e, exc_info=True)
        return _empty_knowledge_stats(before_universe_year, before_universe_day)

    known_characters = {
        rec.target_id for rec in knowledge_recs
        if rec.target_type == "character" and rec.knowledge_level != "none" and rec.target_id != character_id
    }

    try:
        known_events = await _events_character_knows(
            db, universe_id, character_id,
            before_universe_year=before_universe_year,
            before_universe_day=before_universe_day
        )
    except Exception as e:
        logger.warning("knowledge-stats: _events_character_knows failed for character_id=%s: %s", character_id, e, exc_info=True)
        known_events = []

    knowledge_by_level = {}
    for level in ["rumors", "superficial", "good", "complete"]:
        knowledge_by_level[level] = len([
            rec for rec in knowledge_recs
            if rec.knowledge_level == level and rec.target_id != character_id
        ])

    knowledge_by_source = {}
    for source in ["participated", "witnessed", "heard", "read", "learned_from"]:
        count = 0
        try:
            if source == "participated":
                participated_events = await timeline_service.get_timeline_events(
                    db, universe_id, filter_type="character", filter_id=character_id,
                    before_universe_year=before_universe_year,
                    before_universe_day=before_universe_day
                )
                count = len(participated_events)
            elif source == "witnessed":
                witnessed_events = await timeline_service.get_timeline_events_by_witness(
                    db, universe_id, character_id,
                    before_universe_year=before_universe_year,
                    before_universe_day=before_universe_day
                )
                count = len(witnessed_events)
            elif source == "heard":
                heard_events = await timeline_service.get_timeline_events_by_heard(
                    db, universe_id, character_id,
                    before_universe_year=before_universe_year,
                    before_universe_day=before_universe_day
                )
                count = len(heard_events)
            elif source == "read":
                read_events = await timeline_service.get_timeline_events_by_read(
                    db, universe_id, character_id,
                    before_universe_year=before_universe_year,
                    before_universe_day=before_universe_day
                )
                count = len(read_events)
            else:
                count = len([
                    rec for rec in knowledge_recs
                    if getattr(rec, "source_type", None) == source and rec.target_id != character_id
                ])
        except Exception as e:
            logger.debug("knowledge-stats: source %s failed: %s", source, e)
        knowledge_by_source[source] = count

    knowledge_by_type = {}
    for target_type in ["character", "event", "location", "concept"]:
        if target_type == "event":
            knowledge_by_type[target_type] = len(known_events)
        elif target_type == "character":
            knowledge_by_type[target_type] = len(known_characters)
        else:
            knowledge_by_type[target_type] = len([
                rec for rec in knowledge_recs
                if rec.target_type == target_type and rec.knowledge_level != "none"
            ])

    return {
        "known_characters_count": len(known_characters),
        "known_events_count": len(known_events),
        "before_universe_year": before_universe_year,
        "before_universe_day": before_universe_day,
        "by_level": knowledge_by_level,
        "by_source": knowledge_by_source,
        "by_type": knowledge_by_type
    }

async def _generate_and_save_portrait(
    universe_id: int, character_id: int, db: AsyncSession, master_db: AsyncSession
) -> Optional[Character]:
    """Сгенерировать промпт портрета (если нет), сгенерировать изображение и сохранить. При ошибке возвращает None."""
    try:
        db_character = await knowledge.get_character(db, character_id)
        if not db_character or db_character.universe_id != universe_id:
            return None
        system_settings = await get_system_settings(master_db)
        universe = await knowledge.get_universe(universe_id, master_db)
        saved_prompt = (getattr(db_character, "portrait_ai_prompt", None) or "").strip()
        if not saved_prompt:
            provider, model = load_llm_settings_from_system(system_settings)
            character_data = {
                "appearance": getattr(db_character, "appearance", None) or "",
                "role": getattr(db_character, "role", None) or "",
                "gender": getattr(db_character, "gender", None) or "",
                "age": getattr(db_character, "age", None) or "",
                "description": getattr(db_character, "description", None) or "",
            }
            universe_data = {}
            if universe:
                universe_data = {"genre": getattr(universe, "genre", None) or "", "style_notes": getattr(universe, "style_notes", None) or "", "description": getattr(universe, "description", None) or ""}
            generated = await ai_generator_service.generate_portrait_prompt(character_data, universe_data, provider, model)
            if generated:
                saved_prompt = generated
                await knowledge.update_character(db, character_id, CharacterUpdate(portrait_ai_prompt=saved_prompt))
                db_character = await knowledge.get_character(db, character_id)
            else:
                saved_prompt = _build_portrait_prompt_from_character(db_character, universe)
        name = (getattr(db_character, "name", None) or "").strip()
        prompt = _strip_name_from_text(name, saved_prompt) or _build_portrait_prompt_from_character(db_character, universe)
        prompt = f"{prompt}, no text no letters no words in the image"
        image_provider = (getattr(system_settings, "image_provider", None) or "openrouter").strip().lower()
        if image_provider == "whisk":
            whisk_cookie = getattr(system_settings, "whisk_google_cookie", None) or ""
            if not whisk_cookie.strip():
                return None
            image_bytes = await llm_service.generate_image_whisk(prompt, whisk_cookie)
        elif image_provider == "pixazo":
            pixazo_key = getattr(system_settings, "pixazo_api_key", None) or ""
            if pixazo_key.strip():
                pixazo_model = (getattr(system_settings, "pixazo_model", None) or "flux-1-schnell").strip().lower()
                image_bytes = await llm_service.generate_image_pixazo_schnell(prompt, pixazo_key) if pixazo_model == "flux-1-schnell" else await llm_service.generate_image_pixazo_text_to_image(prompt, pixazo_key)
            else:
                return None
        elif image_provider == "cloudflare":
            cf_url = getattr(system_settings, "cloudflare_image_url", None) or ""
            cf_key = getattr(system_settings, "cloudflare_image_api_key", None) or ""
            if cf_url.strip() and cf_key.strip():
                image_bytes = await llm_service.generate_image_cloudflare(prompt, cf_url, cf_key)
            else:
                return None
        else:
            llm_service.openrouter_api_key = getattr(system_settings, "openrouter_api_key", None) or ""
            llm_service.openrouter_url = getattr(system_settings, "openrouter_base_url", None) or "https://openrouter.ai/api/v1"
            _raw = getattr(system_settings, "openrouter_image_model", None) or "google/gemini-2.5-flash-image"
            if not llm_service.openrouter_api_key:
                return None
            image_bytes = await llm_service.generate_image_openrouter(prompt, model=_raw)
        if getattr(db_character, "portrait_image_path", None):
            old_path = DATA_DIR / db_character.portrait_image_path
            if old_path.exists():
                old_path.unlink()
        from app.config import get_universe_uploads_dir
        u_uploads_dir = get_universe_uploads_dir(universe_id)
        portraits_dir = u_uploads_dir / "portraits"
        portraits_dir.mkdir(parents=True, exist_ok=True)
        path = portraits_dir / f"{character_id}.png"
        path.write_bytes(image_bytes)
        relative_path = f"universes/{universe_id}/uploads/portraits/{character_id}.png"
        await knowledge.update_character(db, character_id, CharacterUpdate(portrait_image_path=relative_path))
        return await knowledge.get_character(db, character_id)
    except Exception as e:
        logger.exception("create_contextual: генерация аватарки не удалась: %s", e)
        return None


@router.post("/contextual", response_model=Character)
async def create_contextual_character(universe_id: int, db: AsyncSession = Depends(get_db), master_db: AsyncSession = Depends(get_master_db)):
    """Сгенерировать персонажа по контексту вселенной.
    Порядок: 1) Заполняются все поля из глобального контекста (кроме даты смерти).
    2) Персонаж сохраняется. 3) Генерируется промпт для аватарки и генерируется аватарка."""
    if not await knowledge.get_universe(universe_id, master_db):
        raise HTTPException(status_code=404, detail="Вселенная не найдена")

    context = await context_manager.build_context(db, universe_id, master_db=master_db)
    existing_chars = await knowledge.get_characters(db, universe_id)
    existing_data = [Character.model_validate(c).model_dump() for c in existing_chars]

    system_settings = await get_system_settings(master_db)
    provider, model = load_llm_settings_from_system(system_settings)
    char_data = await ai_generator_service.generate_contextual_character(context, existing_data, provider=provider, model=model)
    if not char_data or not char_data.get('name'):
        logger.warning("create_contextual_character: пустой ответ генератора (context len=%s)", len(context) if context else 0)
        raise HTTPException(
            status_code=500,
            detail="Не удалось сгенерировать персонажа. Проверьте настройки ИИ (Настройки → ИИ Провайдеры) и подключение к выбранному провайдеру."
        )

    # Порядок: сначала все поля из контекста (кроме даты смерти), потом отдельно генерируется аватарка
    exclude_from_context = {"universe_id", "death_date", "death_universe_year", "death_universe_day"}
    allowed = {f for f in CharacterCreate.model_fields if f not in exclude_from_context}
    create_kw = {"universe_id": universe_id}
    for k in allowed:
        if k not in char_data:
            continue
        v = char_data[k]
        if k == "age" and v is not None and isinstance(v, str):
            try:
                v = int(v)
            except (ValueError, TypeError):
                v = None
        create_kw[k] = v
    char_create = CharacterCreate(**create_kw)
    created = await knowledge.create_character(db, char_create)
    with_portrait = await _generate_and_save_portrait(universe_id, created.id, db, master_db)
    return with_portrait if with_portrait is not None else created
