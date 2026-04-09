import importlib
import pkgutil
from fastapi import APIRouter, FastAPI
import app.api

def register_routes(fastapi_app: FastAPI):
    """Регистрация всех роутов под префиксом /api автоматически из пакета app.api"""
    api_router = APIRouter(prefix="/api")

    # Обходим все модули в пакете app.api
    for loader, module_name, is_pkg in pkgutil.walk_packages(app.api.__path__, app.api.__name__ + "."):
        # Пропускаем сам пакет и __init__.py (он уже включен в walk_packages)
        if is_pkg:
            continue

        module = importlib.import_module(module_name)

        # Ищем все объекты типа APIRouter в модуле, которые называются 'router' или начинаются на 'router_'
        for attr_name in dir(module):
            attr = getattr(module, attr_name)
            if isinstance(attr, APIRouter) and (attr_name == "router" or attr_name.startswith("router_")):
                api_router.include_router(attr)

    fastapi_app.include_router(api_router)
