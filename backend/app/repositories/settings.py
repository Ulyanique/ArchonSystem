from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.settings import SystemSettings
from app.schemas.settings import SystemSettingsUpdate

async def get_system_settings(db: AsyncSession) -> SystemSettings:
    """Получить текущие настройки системы. Создает настройки по умолчанию, если их нет."""
    result = await db.execute(select(SystemSettings))
    settings = result.scalars().first()

    if not settings:
        settings = SystemSettings()
        # Устанавливаем дефолтное значение для prompt_settings
        try:
            settings.prompt_settings = "{}"
        except AttributeError:
            # Поле может не существовать в базе, если миграция не применена
            pass
        db.add(settings)
        await db.commit()
        await db.refresh(settings)
    else:
        # Убеждаемся, что prompt_settings установлено
        try:
            if getattr(settings, 'prompt_settings', None) is None:
                settings.prompt_settings = "{}"
                await db.commit()
                await db.refresh(settings)
        except (AttributeError, Exception):
            # Если поле не существует в базе, игнорируем ошибку
            # Pydantic схема обработает это через Optional[str]
            pass

    return settings

async def update_system_settings(db: AsyncSession, settings_update: SystemSettingsUpdate) -> SystemSettings:
    """Обновить настройки системы."""
    settings = await get_system_settings(db)

    update_data = settings_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(settings, key, value)

    await db.commit()
    await db.refresh(settings)
    return settings
