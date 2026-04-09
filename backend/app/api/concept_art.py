import json
import logging
import re
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Body
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional

from app.config import DATA_DIR, get_universe_uploads_dir
from app.database import get_db, get_master_db
from app.repositories import concept_art as art_repo
from app.repositories.settings import get_system_settings
from app.schemas.concept_art import ConceptArtSchema, ConceptArtCreate, ConceptArtUpdate, ConceptArtGenerateRequest, ConceptArtGenerateAutoRequest
from app.schemas import ChatMessage
from app.services import knowledge
from app.services.context_manager import context_manager
from app.services.llm import llm_service
from app.services.llm_config import load_llm_settings_from_system

router = APIRouter(prefix="/universes/{universe_id}/concept-art", tags=["concept-art"])

@router.get("", response_model=List[ConceptArtSchema])
async def list_concept_arts(universe_id: int, db: AsyncSession = Depends(get_db)):
    return await art_repo.get_concept_arts(db, universe_id)

@router.post("", response_model=ConceptArtSchema)
async def create_concept_art(
    universe_id: int,
    title: str = Form(...),
    description: Optional[str] = Form(""),
    category: Optional[str] = Form("other"),
    tags: Optional[str] = Form(""),
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db)
):
    # Сохраняем файл
    u_uploads_dir = get_universe_uploads_dir(universe_id)
    art_dir = u_uploads_dir / "concept-art"
    art_dir.mkdir(parents=True, exist_ok=True)

    suffix = Path(file.filename or "").suffix or ".jpg"
    filename = f"{uuid.uuid4()}{suffix}"
    file_path = art_dir / filename

    content = await file.read()
    file_path.write_bytes(content)

    relative_path = f"universes/{universe_id}/uploads/concept-art/{filename}"

    art_create = ConceptArtCreate(
        title=title,
        description=description,
        category=category,
        tags=tags
    )

    return await art_repo.create_concept_art(db, universe_id, art_create, relative_path)


logger = logging.getLogger(__name__)


def _parse_json_from_llm(response: str) -> dict:
    """Извлечь JSON из ответа LLM (возможно в блоке ```json ... ```). Поддержка и объекта, и массива с одним объектом."""
    text = (response or "").strip()
    match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", text)
    if match:
        text = match.group(1).strip()
    data = json.loads(text)
    if isinstance(data, list) and len(data) > 0 and isinstance(data[0], dict):
        data = data[0]
    if not isinstance(data, dict):
        raise ValueError("Ожидался JSON-объект с полями title и prompt")
    return data


async def _generate_concept_art_idea(
    db: AsyncSession,
    master_db: AsyncSession,
    universe_id: int,
    system_settings,
) -> tuple[str, str]:
    """Сгенерировать одну случайную идею концепт-арта по контексту вселенной. Возвращает (title, prompt для изображения)."""
    context = await context_manager.build_context(db, universe_id, master_db=master_db)
    locations = await knowledge.get_locations(db, universe_id)
    loc_lines = []
    for loc in (locations or [])[:20]:
        if getattr(loc, "enabled", True):
            name = getattr(loc, "name", None) or ""
            if name:
                loc_lines.append(f"- {name}")
    if loc_lines:
        context += "\n\n=== ЛОКАЦИИ ===\n" + "\n".join(loc_lines)

    # Персонажи с полным описанием для визуализации (пол, внешность, характер)
    chars = await knowledge.get_characters(db, universe_id)
    if chars:
        context += "\n\n=== ПЕРСОНАЖИ (полное описание для генерации изображений) ==="
        for c in [x for x in chars if getattr(x, "enabled", True)][:25]:
            parts = [f"- {c.name}"]
            if getattr(c, "gender", None) and str(c.gender).strip():
                parts.append(f"пол: {c.gender}")
            if getattr(c, "role", None) and str(c.role).strip():
                parts.append(f"роль: {c.role}")
            if getattr(c, "appearance", None) and str(c.appearance).strip():
                parts.append(f"внешность: {(c.appearance or '')[:400]}")
            if getattr(c, "description", None) and str(c.description).strip():
                parts.append(f"характер/описание: {(c.description or '')[:400]}")
            if getattr(c, "traits", None) and str(c.traits).strip():
                parts.append(f"черты: {(c.traits or '')[:200]}")
            if getattr(c, "profession", None) and str(c.profession).strip():
                parts.append(f"профессия: {c.profession}")
            context += "\n" + ", ".join(parts)

    provider, model = load_llm_settings_from_system(system_settings)
    system_msg = (
        "Ты помощник для создания идей концепт-арта по миру книги/вселенной. "
        "Отвечай только валидным JSON, без пояснений до или после. "
        "Поле prompt в ответе должно быть строго на английском — промпты на английском дают более релевантные результаты при генерации изображений. "
        "Если в идее участвует персонаж из списка — обязательно включи в prompt его пол (gender), внешность (appearance) и характер из описания, переведённые на английский, чтобы изображение было точным и узнаваемым."
    )
    user_msg = (
        "По контексту вселенной ниже придумай ОДНУ случайную, но уместную идею для концепт-арта. "
        "Выбери что-то из: сцена с персонажем (например главный герой заходит в лабораторию, персонаж в типичной локации), "
        "ключевая технология или артефакт, неосвещённая тема мира, характерный момент или атмосферная сцена. "
        "Идея должна быть конкретной и визуализируемой. Если выбираешь сцену с персонажем — используй полное описание персонажа из раздела ПЕРСОНАЖИ (пол, внешность, характер) в prompt на английском. "
        "Верни строго JSON с двумя полями:\n"
        '"title": "Краткое название на русском (2-6 слов)",\n'
        '"prompt": "Image generation prompt IN ENGLISH ONLY: detailed scene, character appearance and gender if applicable, style, lighting, no text in image. 1-3 sentences."\n\n'
        "Контекст вселенной:\n" + (context or "(пусто)")
    )
    messages = [
        ChatMessage(role="system", content=system_msg),
        ChatMessage(role="user", content=user_msg),
    ]
    response = await llm_service.chat(messages, provider=provider, model=model)
    data = _parse_json_from_llm(response)
    title = (data.get("title") or "Концепт-арт").strip() or "Концепт-арт"
    prompt = (data.get("prompt") or "").strip()
    if not prompt:
        prompt = title
    return title, prompt


@router.post("/generate", response_model=ConceptArtSchema)
async def generate_concept_art(
    universe_id: int,
    body: ConceptArtGenerateRequest,
    db: AsyncSession = Depends(get_db),
    master_db: AsyncSession = Depends(get_master_db),
):
    """Сгенерировать концепт-арт по описанию (промпту) с помощью ИИ."""
    prompt_to_use = (body.description or "").strip()
    if not prompt_to_use:
        raise HTTPException(status_code=400, detail="Укажите описание (промпт) для генерации изображения.")
    prompt_to_use = f"{prompt_to_use}, concept art, high quality, no text no letters no words in the image"

    system_settings = await get_system_settings(master_db)
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
        logger.exception("concept-art/generate failed")
        raise HTTPException(status_code=502, detail=f"Ошибка генерации изображения: {e!s}")

    u_uploads_dir = get_universe_uploads_dir(universe_id)
    art_dir = u_uploads_dir / "concept-art"
    art_dir.mkdir(parents=True, exist_ok=True)
    filename = f"{uuid.uuid4()}.png"
    file_path = art_dir / filename
    file_path.write_bytes(image_bytes)
    relative_path = f"universes/{universe_id}/uploads/concept-art/{filename}"

    art_create = ConceptArtCreate(
        title=body.title or "Концепт-арт",
        description=body.description,
        category=body.category or "other",
        tags=body.tags or "",
    )
    return await art_repo.create_concept_art(db, universe_id, art_create, relative_path)


@router.post("/generate-auto", response_model=ConceptArtSchema)
async def generate_concept_art_auto(
    universe_id: int,
    body: Optional[ConceptArtGenerateAutoRequest] = Body(None),
    db: AsyncSession = Depends(get_db),
    master_db: AsyncSession = Depends(get_master_db),
):
    """Полностью автоматическая генерация: идея по контексту вселенной → генерация изображения → создание концепт-арта."""
    req_body = body or ConceptArtGenerateAutoRequest()
    aspect_ratio = (getattr(req_body, "aspect_ratio", None) or "landscape").strip().lower()

    system_settings = await get_system_settings(master_db)

    # 1. Генерируем идею (название + промпт) по контексту вселенной
    try:
        title, prompt = await _generate_concept_art_idea(db, master_db, universe_id, system_settings)
    except Exception as e:
        logger.exception("concept-art/generate-auto: idea generation failed")
        err_text = str(e).lower()
        if "connection" in err_text or "refused" in err_text or "attempts failed" in err_text:
            provider = (getattr(system_settings, "default_provider", None) or "ollama").strip().lower()
            hint = "Проверьте: если выбран Ollama — запущен ли он (http://localhost:11434)? Если облачный провайдер (OpenRouter, DeepSeek, RouterAI) — указан ли API ключ в настройках и есть ли интернет?"
            raise HTTPException(status_code=502, detail=f"Нет связи с LLM ({provider}). {hint}")
        raise HTTPException(status_code=502, detail=f"Ошибка генерации идеи: {e!s}")

    prompt_to_use = f"{prompt}, concept art, high quality, no text no letters no words in the image"
    image_provider = (getattr(system_settings, "image_provider", None) or "openrouter").strip().lower()

    try:
        if image_provider == "whisk":
            whisk_cookie = getattr(system_settings, "whisk_google_cookie", None) or ""
            if not whisk_cookie.strip():
                raise HTTPException(status_code=400, detail="Для Whisk укажите cookie Google в настройках (Генерация изображений).")
            image_bytes = await llm_service.generate_image_whisk(prompt_to_use, whisk_cookie, aspect_ratio=aspect_ratio)
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
        logger.exception("concept-art/generate-auto: image generation failed")
        msg = str(e).strip() or f"{type(e).__name__}"
        if image_provider == "whisk" and not msg.startswith("Ошибка"):
            msg = f"Whisk: {msg}. Проверьте cookie (Network → Cookie), Node.js (node --version), backend/whisk: npm install."
        raise HTTPException(status_code=502, detail=f"Ошибка генерации изображения: {msg}")

    u_uploads_dir = get_universe_uploads_dir(universe_id)
    art_dir = u_uploads_dir / "concept-art"
    art_dir.mkdir(parents=True, exist_ok=True)
    filename = f"{uuid.uuid4()}.png"
    file_path = art_dir / filename
    file_path.write_bytes(image_bytes)
    relative_path = f"universes/{universe_id}/uploads/concept-art/{filename}"

    art_create = ConceptArtCreate(
        title=title,
        description=prompt,
        category="other",
        tags="",
    )
    return await art_repo.create_concept_art(db, universe_id, art_create, relative_path)


@router.post("/{art_id}/image", response_model=ConceptArtSchema)
async def replace_concept_art_image(
    universe_id: int,
    art_id: int,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
):
    """Заменить изображение концепт-арта. Старый файл удаляется."""
    db_art = await art_repo.get_concept_art(db, art_id)
    if not db_art or db_art.universe_id != universe_id:
        raise HTTPException(status_code=404, detail="Арт не найден")
    ct = (file.content_type or "").lower()
    if not ct.startswith("image/") and not (file.filename or "").lower().endswith((".jpg", ".jpeg", ".png", ".gif", ".webp")):
        raise HTTPException(status_code=400, detail="Загрузите файл изображения (jpg, png, gif, webp)")
    u_uploads_dir = get_universe_uploads_dir(universe_id)
    art_dir = u_uploads_dir / "concept-art"
    art_dir.mkdir(parents=True, exist_ok=True)
    suffix = Path(file.filename or "").suffix or ".jpg"
    filename = f"{uuid.uuid4()}{suffix}"
    file_path = art_dir / filename
    content = await file.read()
    file_path.write_bytes(content)
    relative_path = f"universes/{universe_id}/uploads/concept-art/{filename}"
    old_path = DATA_DIR / db_art.image_path
    if old_path.exists():
        old_path.unlink()
    await art_repo.update_concept_art(db, art_id, ConceptArtUpdate(image_path=relative_path))
    return await art_repo.get_concept_art(db, art_id)


@router.put("/{art_id}", response_model=ConceptArtSchema)
async def update_concept_art(universe_id: int, art_id: int, art: ConceptArtUpdate, db: AsyncSession = Depends(get_db)):
    db_art = await art_repo.update_concept_art(db, art_id, art)
    if not db_art or db_art.universe_id != universe_id:
        raise HTTPException(status_code=404, detail="Арт не найден")
    return db_art

@router.patch("/reorder")
async def reorder_concept_arts(universe_id: int, art_ids: List[int], db: AsyncSession = Depends(get_db)):
    await art_repo.update_art_order(db, universe_id, art_ids)
    return {"status": "ok"}

@router.delete("/{art_id}")
async def delete_concept_art(universe_id: int, art_id: int, db: AsyncSession = Depends(get_db)):
    db_art = await art_repo.get_concept_art(db, art_id)
    if not db_art or db_art.universe_id != universe_id:
        raise HTTPException(status_code=404, detail="Арт не найден")

    # Удаляем файл
    from app.config import DATA_DIR
    full_path = DATA_DIR / db_art.image_path
    if full_path.exists():
        full_path.unlink()

    await art_repo.delete_concept_art(db, art_id)
    return {"message": "Арт удален"}
