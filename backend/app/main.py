from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
from pathlib import Path
import asyncio
import traceback
import logging

from app.database import master_engine, MasterBase
from app.config import settings, DATA_DIR, UPLOADS_DIR, __version__
from app.routes import register_routes

# Настройка логирования
logging.basicConfig(
    level=logging.WARNING,  # Показываем WARNING и выше
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

logger = logging.getLogger(__name__)

def run_migrations():
    """Программный запуск миграций Alembic"""
    from alembic.config import Config
    from alembic import command

    # Путь к alembic.ini (он в корне backend/)
    base_path = Path(__file__).parent.parent
    ini_path = base_path / "alembic.ini"

    if ini_path.exists():
        logger.info("Running migrations from %s...", ini_path)
        try:
            cfg = Config(str(ini_path))
            command.upgrade(cfg, "head")
            logger.info("Migrations successful")
        except Exception as e:
            logger.exception("Error during migrations: %s", e)
            raise
    else:
        logger.warning("%s not found. Skipping auto-migration.", ini_path)

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Жизненный цикл приложения"""
    # Создание директорий
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    (UPLOADS_DIR / "covers").mkdir(parents=True, exist_ok=True)
    (UPLOADS_DIR / "portraits").mkdir(parents=True, exist_ok=True)
    (UPLOADS_DIR / "audio" / "background").mkdir(parents=True, exist_ok=True)

    # Запуск миграций
    try:
        await asyncio.to_thread(run_migrations)
    except Exception as e:
        logger.exception("Startup migration failed: %s", e)

    # Создание таблиц (fallback для новых таблиц, не описанных в миграциях)
    from app.database import master_engine, MasterBase
    async with master_engine.begin() as conn:
        await conn.run_sync(MasterBase.metadata.create_all)

    yield

# Создание приложения
app = FastAPI(
    title="ARCHON",
    description="Система управления вселенными",
    version=__version__,
    lifespan=lifespan
)

# CORS
_cors_origins = [o.strip() for o in settings.cors_origins.split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    return {"message": "ARCHON API", "version": __version__}

@app.get("/health")
async def health():
    """Проверка доступности API и мастер-БД."""
    try:
        from sqlalchemy import text
        async with master_engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        return {"status": "ok", "database": "ok"}
    except Exception as e:
        logger.exception("Health check failed: %s", e)
        from fastapi import HTTPException
        raise HTTPException(
            status_code=503,
            detail="Database unavailable" if not settings.debug else str(e),
        )

# Раздача файлов
# Убеждаемся, что директории существуют до монтирования StaticFiles
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
(DATA_DIR / "universes").mkdir(parents=True, exist_ok=True)

# Монтируем общую папку и папку вселенных
app.mount("/api/files/global", StaticFiles(directory=str(UPLOADS_DIR)), name="global_files")
app.mount("/api/files/universes", StaticFiles(directory=str(DATA_DIR / "universes")), name="universe_files")

# Регистрация роутов
register_routes(app)

# Глобальный обработчик исключений
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    error_traceback = traceback.format_exc()
    error_msg = f"Global exception handler: {type(exc).__name__}: {str(exc)}"
    logger.debug("Request URL: %s", request.url)
    logger.debug("Request method: %s", request.method)
    logger.debug("Traceback: %s", error_traceback)
    logger.error(error_msg, exc_info=True)

    from fastapi import HTTPException
    if isinstance(exc, HTTPException):
        raise exc

    detail = "Внутренняя ошибка сервера"
    if settings.debug:
        detail = f"{detail}: {str(exc)}"
    return JSONResponse(
        status_code=500,
        content={"detail": detail}
    )
