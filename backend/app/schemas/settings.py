from pydantic import BaseModel, ConfigDict
from typing import Optional
from datetime import datetime

class SystemSettingsBase(BaseModel):
    default_provider: str = "ollama"
    ollama_base_url: str = "http://localhost:11434"
    ollama_model: str = "deepseek-v3.1:671b-cloud"

    deepseek_api_key: Optional[str] = ""
    deepseek_base_url: Optional[str] = "https://api.deepseek.com"
    deepseek_model: Optional[str] = "deepseek-chat"

    openrouter_api_key: Optional[str] = ""
    openrouter_base_url: Optional[str] = "https://openrouter.ai/api/v1"
    openrouter_model: Optional[str] = "google/gemini-pro-1.5"
    openrouter_image_model: Optional[str] = "sourceful/riverflow-v2-pro"

    image_provider: Optional[str] = "openrouter"  # openrouter | cloudflare | pixazo | whisk
    cloudflare_image_url: Optional[str] = ""
    cloudflare_image_api_key: Optional[str] = ""
    pixazo_api_key: Optional[str] = ""
    pixazo_model: Optional[str] = "flux-1-schnell"  # flux-1-schnell (бесплатно) | flux-2-pro (платный)
    whisk_google_cookie: Optional[str] = ""  # Cookie для Whisk (Google Labs)

    routerai_api_key: Optional[str] = ""
    routerai_base_url: Optional[str] = "https://routerai.ru/api/v1"
    routerai_model: Optional[str] = "openai/gpt-3.5-turbo"

    theme: str = "dark"
    language: str = "ru"
    accent_color: str = "green"  # green | blue | purple | orange | cyan

    show_toast_notifications: bool = True
    toast_position: str = "bottom-center"  # top-left | top-center | top-right | bottom-left | bottom-center | bottom-right
    toast_duration: int = 3000  # мс, 0 = не скрывать автоматически

    enable_rag: bool = True
    context_window_size: int = 4096
    draft_context_budget: int = 3000  # макс. символов черновиков в контексте чата (общий бюджет)
    include_all_drafts_in_context: bool = False  # True = все черновики в контекст; False = только релевантные (search+RAG)
    context_base_budget: int = 4000  # макс. символов блока «знания персонажа»
    context_mentions_budget: int = 2000  # макс. символов блока «упоминания»
    context_creator_chars: int = 8000  # макс. символов списка персонажей для Помощника Создателя
    context_technologies_budget: int = 4000  # макс. символов блока «технологии и артефакты»

    prompt_settings: Optional[str] = "{}"  # JSON с настройками промптов

class SystemSettingsUpdate(SystemSettingsBase):
    pass

class SystemSettingsSchema(SystemSettingsBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    updated_at: datetime
