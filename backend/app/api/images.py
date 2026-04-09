"""API для трансформации изображений через Pixazo Flux Image-to-Image."""
import logging
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db, get_master_db
from app.utils.upload_limits import validate_upload_size
from app.services import knowledge
from app.services.llm import llm_service
from app.repositories.settings import get_system_settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/universes/{universe_id}/images", tags=["images"])


@router.post("/transform")
async def transform_image(
    universe_id: int,
    prompt: str = Form(...),
    image: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    master_db: AsyncSession = Depends(get_master_db),
):
    """Преобразовать изображение по промпту через Pixazo Flux 2 Pro Image-to-Image.
    Требуется провайдер изображений «Pixazo» и настроенный API ключ в настройках.
    Возвращает сгенерированное изображение (PNG)."""
    if not await knowledge.get_universe(universe_id, master_db):
        raise HTTPException(status_code=404, detail="Вселенная не найдена")

    ct = (image.content_type or "").lower()
    if not ct.startswith("image/") and not (image.filename or "").lower().endswith(
        (".jpg", ".jpeg", ".png", ".gif", ".webp")
    ):
        raise HTTPException(
            status_code=400,
            detail="Файл должен быть изображением (jpg, png, gif, webp).",
        )

    system_settings = await get_system_settings(master_db)
    image_provider = (getattr(system_settings, "image_provider", None) or "").strip().lower()
    if image_provider != "pixazo":
        raise HTTPException(
            status_code=400,
            detail="Трансформация изображения доступна только при выбранном провайдере Pixazo. Настройте в разделе «Генерация изображений».",
        )

    pixazo_key = getattr(system_settings, "pixazo_api_key", None) or ""
    if not pixazo_key.strip():
        raise HTTPException(
            status_code=400,
            detail="Укажите Pixazo API ключ в настройках.",
        )
    pixazo_model = (getattr(system_settings, "pixazo_model", None) or "flux-1-schnell").strip().lower()
    if pixazo_model == "flux-1-schnell":
        raise HTTPException(
            status_code=400,
            detail="Трансформация изображения (Image-to-Image) доступна только для модели Flux 2 Pro. Выберите «Flux 2 Pro» в настройках Pixazo.",
        )

    try:
        image_bytes = await image.read()
        validate_upload_size(image_bytes)
        out_bytes = await llm_service.generate_image_pixazo_image_to_image(
            prompt, image_bytes, pixazo_key
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.exception("images/transform failed")
        raise HTTPException(status_code=502, detail=f"Ошибка Pixazo: {e!s}")

    return Response(content=out_bytes, media_type="image/png")
