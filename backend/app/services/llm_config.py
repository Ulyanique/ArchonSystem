"""
Централизованная загрузка настроек LLM из system_settings в llm_service.
Использовать в начале каждого эндпоинта, который вызывает LLM.
"""
from typing import Optional, Tuple, Any
from app.services.llm import llm_service
from app.config import settings


def load_llm_settings_from_system(
    system_settings: Any,
    provider: Optional[str] = None,
) -> Tuple[str, str]:
    """
    Загрузить настройки провайдера из system_settings в llm_service.
    Возвращает (provider, model) для использования в вызовах llm_service.chat / chat_stream.
    """
    prov = (provider or getattr(system_settings, "default_provider", None) or "ollama").strip().lower()
    model = getattr(system_settings, f"{prov}_model", None) or getattr(
        system_settings, "ollama_model", "llama3.2"
    )

    if prov == "ollama":
        llm_service.ollama_url = getattr(system_settings, "ollama_base_url", None) or "http://localhost:11434"
        llm_service.ollama_model = getattr(system_settings, "ollama_model", None) or model
    elif prov == "openrouter":
        llm_service.openrouter_api_key = getattr(system_settings, "openrouter_api_key", None) or ""
        llm_service.openrouter_url = getattr(system_settings, "openrouter_base_url", None) or "https://openrouter.ai/api/v1"
        llm_service.openrouter_model = getattr(system_settings, "openrouter_model", None) or model
    elif prov == "routerai":
        llm_service.routerai_api_key = getattr(system_settings, "routerai_api_key", None) or ""
        llm_service.routerai_url = getattr(system_settings, "routerai_base_url", None) or "https://routerai.ru/api/v1"
        llm_service.routerai_model = getattr(system_settings, "routerai_model", None) or model
    elif prov == "deepseek":
        llm_service.deepseek_api_key = getattr(system_settings, "deepseek_api_key", None) or ""
        llm_service.deepseek_url = getattr(system_settings, "deepseek_base_url", None) or "https://api.deepseek.com"
        llm_service.deepseek_model = getattr(system_settings, "deepseek_model", None) or model

    return (prov, model or settings.get_default_model(prov))
