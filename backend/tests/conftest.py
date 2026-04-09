"""Pytest fixtures for API tests. Use a temporary SQLite file so all connections share the same DB."""
import os
import tempfile
import pytest
import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from app.main import app
from app.database import get_db, get_master_db, Base, MasterBase
from app.models import *  # noqa: F401


async def _init_tables(engine):
    """Create MasterBase and Base tables on the given engine."""
    async with engine.begin() as conn:
        await conn.run_sync(MasterBase.metadata.create_all)
        await conn.run_sync(Base.metadata.create_all)


@pytest.fixture
def client():
    """Test client with a temporary database file."""
    fd, path = tempfile.mkstemp(suffix=".db")
    os.close(fd)

    try:
        url = f"sqlite+aiosqlite:///{path}"
        engine = create_async_engine(url, connect_args={"check_same_thread": False})
        asyncio.run(_init_tables(engine))

        TestingSessionLocal = async_sessionmaker(
            bind=engine,
            class_=AsyncSession,
            expire_on_commit=False,
        )

        # Mock run_migrations to do nothing in tests
        from app import main as main_module
        original_run_migrations = main_module.run_migrations
        main_module.run_migrations = lambda: None

        async def override_get_db(universe_id: int):
            """Для тестов используем одну и ту же сессию для любого universe_id."""
            async with TestingSessionLocal() as db:
                yield db

        async def override_get_master_db():
            async with TestingSessionLocal() as db:
                yield db

        from app.main import app as fastapi_app
        import app.database as database_module

        fastapi_app.dependency_overrides[get_db] = override_get_db
        fastapi_app.dependency_overrides[get_master_db] = override_get_master_db

        # Use temp engine for lifespan (create_all already done above; lifespan still runs but on temp DB)
        original_master_engine = database_module.master_engine
        database_module.master_engine = engine

        from fastapi.testclient import TestClient
        with TestClient(fastapi_app) as c:
            yield c

        fastapi_app.dependency_overrides.clear()
        database_module.master_engine = original_master_engine
        main_module.run_migrations = original_run_migrations

        asyncio.run(engine.dispose())
    finally:
        try:
            os.unlink(path)
        except Exception:
            pass
