from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_master_db as get_db
from app.schemas.settings import SystemSettingsSchema, SystemSettingsUpdate
from app.repositories.settings import get_system_settings, update_system_settings
from app.services.prompt_builder import PromptBuilder
import json

router = APIRouter(prefix="/system/settings", tags=["settings"])

@router.get("/", response_model=SystemSettingsSchema)
async def read_settings(db: AsyncSession = Depends(get_db)):
    try:
        settings = await get_system_settings(db)
        # Убеждаемся, что prompt_settings всегда строка
        if not hasattr(settings, 'prompt_settings') or settings.prompt_settings is None:
            settings.prompt_settings = "{}"
        return settings
    except Exception as e:
        import traceback
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Error getting system settings: {e}\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Ошибка загрузки настроек: {str(e)}")

@router.put("/", response_model=SystemSettingsSchema)
async def update_settings(settings_update: SystemSettingsUpdate, db: AsyncSession = Depends(get_db)):
    return await update_system_settings(db, settings_update)

@router.get("/prompt/defaults")
async def get_prompt_defaults():
    """Получить дефолтные настройки промптов"""
    return PromptBuilder.DEFAULT_SETTINGS

@router.post("/prompt/validate")
async def validate_prompt_settings(settings: dict):
    """Валидировать настройки промптов"""
    try:
        # Пробуем создать PromptBuilder с этими настройками
        builder = PromptBuilder(settings)
        return {
            "valid": True,
            "message": "Настройки валидны"
        }
    except Exception as e:
        return {
            "valid": False,
            "message": f"Ошибка валидации: {str(e)}"
        }
