from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime
from datetime import datetime, timezone
from app.database import MasterBase

class SystemSettings(MasterBase):
    """Глобальные настройки системы Archon."""
    __tablename__ = "system_settings"

    id = Column(Integer, primary_key=True, index=True)

    # LLM Settings
    default_provider = Column(String(50), default="ollama")
    ollama_base_url = Column(String(255), default="http://localhost:11434")
    ollama_model = Column(String(100), default="deepseek-v3.1:671b-cloud")

    deepseek_api_key = Column(String(255), default="")
    deepseek_base_url = Column(String(255), default="https://api.deepseek.com")
    deepseek_model = Column(String(100), default="deepseek-chat")

    openrouter_api_key = Column(String(255), default="")
    openrouter_base_url = Column(String(255), default="https://openrouter.ai/api/v1")
    openrouter_model = Column(String(100), default="google/gemini-pro-1.5")
    openrouter_image_model = Column(String(200), default="sourceful/riverflow-v2-pro")

    # Провайдер генерации изображений для портретов: openrouter | cloudflare | pixazo | whisk
    image_provider = Column(String(50), default="openrouter")
    cloudflare_image_url = Column(String(512), default="")
    cloudflare_image_api_key = Column(String(255), default="")
    pixazo_api_key = Column(String(255), default="")
    pixazo_model = Column(String(50), default="flux-1-schnell")  # flux-1-schnell | flux-2-pro
    whisk_google_cookie = Column(String(4096), default="")  # Cookie для Whisk (labs.google)

    routerai_api_key = Column(String(255), default="")
    routerai_base_url = Column(String(255), default="https://routerai.ru/api/v1")
    routerai_model = Column(String(100), default="openai/gpt-3.5-turbo")

    # UI/UX Settings
    theme = Column(String(20), default="dark")
    language = Column(String(10), default="ru")
    accent_color = Column(String(20), default="green")  # green | blue | purple | orange | cyan
    show_toast_notifications = Column(Boolean, default=True)
    toast_position = Column(String(30), default="bottom-center")
    toast_duration = Column(Integer, default=3000)  # ms

    # Advanced AI Settings
    enable_rag = Column(Boolean, default=True)
    context_window_size = Column(Integer, default=4096)
    draft_context_budget = Column(Integer, default=3000)  # макс. символов черновиков в контексте чата
    include_all_drafts_in_context = Column(Boolean, default=False)  # если True — все черновики в контекст; иначе только релевантные (search+RAG)
    # Лимиты контекста чата (символы)
    context_base_budget = Column(Integer, default=4000)  # макс. символов блока «знания персонажа»
    context_mentions_budget = Column(Integer, default=2000)  # макс. символов блока «упоминания»
    context_creator_chars = Column(Integer, default=8000)  # макс. символов списка персонажей для Помощника Создателя
    context_technologies_budget = Column(Integer, default=4000)  # макс. символов блока «технологии и артефакты»

    # Prompt Settings (JSON)
    prompt_settings = Column(Text, default="{}")  # JSON с настройками промптов

    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
