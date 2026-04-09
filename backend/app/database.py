import os
import logging
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import declarative_base
from app.config import DATA_DIR

logger = logging.getLogger(__name__)

# Master Database
MASTER_DB_PATH = DATA_DIR / "archon_master.db"
ASYNC_MASTER_DB_URL = f"sqlite+aiosqlite:///{MASTER_DB_PATH.as_posix()}"

master_engine = create_async_engine(
    ASYNC_MASTER_DB_URL,
    connect_args={"check_same_thread": False},
)

MasterSessionLocal = async_sessionmaker(
    bind=master_engine,
    class_=AsyncSession,
    expire_on_commit=False,
)

async def get_master_db():
    async with MasterSessionLocal() as session:
        yield session

# Master Base
MasterBase = declarative_base()

# Universe Databases
Base = declarative_base()
_universe_engines = {}
_universe_db_inited: set = set()

def get_universe_engine(universe_id: int):
    if universe_id in _universe_engines:
        return _universe_engines[universe_id]

    universe_dir = DATA_DIR / "universes" / str(universe_id)
    universe_dir.mkdir(parents=True, exist_ok=True)
    db_path = universe_dir / "universe.db"

    url = f"sqlite+aiosqlite:///{db_path.as_posix()}"
    engine = create_async_engine(
        url,
        connect_args={"check_same_thread": False},
    )
    _universe_engines[universe_id] = engine
    return engine

def _ensure_location_image_columns(connection):
    """Добавить колонки image_path и image_ai_prompt в locations, если их ещё нет (для существующих БД)."""
    from sqlalchemy import inspect, text
    insp = inspect(connection)
    if "locations" not in insp.get_table_names():
        return
    columns = [c["name"] for c in insp.get_columns("locations")]
    if "image_path" not in columns:
        connection.execute(text("ALTER TABLE locations ADD COLUMN image_path VARCHAR(512)"))
    if "image_ai_prompt" not in columns:
        connection.execute(text("ALTER TABLE locations ADD COLUMN image_ai_prompt TEXT"))


def _ensure_scene_beat_description(connection):
    """Добавить колонку description в scene_beats, если её ещё нет (для существующих БД)."""
    from sqlalchemy import inspect, text
    insp = inspect(connection)
    if "scene_beats" not in insp.get_table_names():
        return
    columns = [c["name"] for c in insp.get_columns("scene_beats")]
    if "description" not in columns:
        connection.execute(text("ALTER TABLE scene_beats ADD COLUMN description TEXT DEFAULT ''"))


def _ensure_scene_beat_enabled_collapsed(connection):
    """Добавить колонки enabled и collapsed в scene_beats (для существующих БД)."""
    from sqlalchemy import inspect, text
    insp = inspect(connection)
    if "scene_beats" not in insp.get_table_names():
        return
    columns = [c["name"] for c in insp.get_columns("scene_beats")]
    if "enabled" not in columns:
        connection.execute(text("ALTER TABLE scene_beats ADD COLUMN enabled BOOLEAN DEFAULT 1"))
    if "collapsed" not in columns:
        connection.execute(text("ALTER TABLE scene_beats ADD COLUMN collapsed BOOLEAN DEFAULT 0"))


def _ensure_location_celestial_body(connection):
    """Добавить колонку celestial_body_id в locations (связь с небесным телом)."""
    from sqlalchemy import inspect, text
    insp = inspect(connection)
    if "locations" not in insp.get_table_names():
        return
    columns = [c["name"] for c in insp.get_columns("locations")]
    if "celestial_body_id" not in columns:
        connection.execute(text("ALTER TABLE locations ADD COLUMN celestial_body_id INTEGER"))


def _ensure_celestial_parent_body(connection):
    """Добавить колонку parent_body_id в celestial_bodies (спутник орбитирует планету)."""
    from sqlalchemy import inspect, text
    insp = inspect(connection)
    if "celestial_bodies" not in insp.get_table_names():
        return
    columns = [c["name"] for c in insp.get_columns("celestial_bodies")]
    if "parent_body_id" not in columns:
        connection.execute(text("ALTER TABLE celestial_bodies ADD COLUMN parent_body_id INTEGER"))


def _ensure_storylines_table(connection):
    """Создать таблицу storylines для существующих БД (сюжетные линии)."""
    from sqlalchemy import inspect, text
    insp = inspect(connection)
    if "storylines" in insp.get_table_names():
        return
    connection.execute(text("""
        CREATE TABLE storylines (
            id INTEGER NOT NULL PRIMARY KEY,
            universe_id INTEGER NOT NULL,
            title VARCHAR(255) NOT NULL,
            description TEXT,
            sort_order INTEGER DEFAULT 0,
            main_character_id INTEGER,
            created_at DATETIME,
            updated_at DATETIME,
            FOREIGN KEY(main_character_id) REFERENCES characters (id)
        )
    """))
    connection.execute(text("CREATE INDEX ix_storylines_universe_id ON storylines (universe_id)"))
    connection.execute(text("CREATE INDEX ix_storylines_main_character_id ON storylines (main_character_id)"))


def _ensure_chapter_storyline_columns(connection):
    """Добавить колонки сюжетных линий в chapters для существующих БД."""
    from sqlalchemy import inspect, text
    insp = inspect(connection)
    if "chapters" not in insp.get_table_names():
        return
    columns = [c["name"] for c in insp.get_columns("chapters")]
    if "storyline_id" not in columns:
        connection.execute(text("ALTER TABLE chapters ADD COLUMN storyline_id INTEGER"))
    if "storyline_order" not in columns:
        connection.execute(text("ALTER TABLE chapters ADD COLUMN storyline_order INTEGER DEFAULT 0"))
    if "reading_order" not in columns:
        connection.execute(text("ALTER TABLE chapters ADD COLUMN reading_order INTEGER"))


async def init_universe_db(universe_id: int):
    """Инициализация таблиц в базе данных конкретной вселенной."""
    engine = get_universe_engine(universe_id)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        await conn.run_sync(_ensure_location_image_columns)
        await conn.run_sync(_ensure_scene_beat_description)
        await conn.run_sync(_ensure_scene_beat_enabled_collapsed)
        await conn.run_sync(_ensure_location_celestial_body)
        await conn.run_sync(_ensure_celestial_parent_body)
        await conn.run_sync(_ensure_storylines_table)
        await conn.run_sync(_ensure_chapter_storyline_columns)

async def get_db(universe_id: int):
    try:
        if universe_id not in _universe_db_inited:
            await init_universe_db(universe_id)
            _universe_db_inited.add(universe_id)
        logger.debug("get_db: Called with universe_id=%s", universe_id)
        engine = get_universe_engine(universe_id)
        session_factory = async_sessionmaker(
            bind=engine,
            class_=AsyncSession,
            expire_on_commit=False,
        )
        async with session_factory() as session:
            logger.debug("get_db: Session created for universe_id=%s", universe_id)
            yield session
    except Exception as e:
        logger.exception("get_db: ERROR - %s", e)
        raise
