from pydantic_settings import BaseSettings
from pathlib import Path

# Папка backend (родитель app)
BACKEND_DIR = Path(__file__).resolve().parent.parent
WHISK_DIR = BACKEND_DIR / "whisk"  # Node-скрипт для Whisk (Google Labs)
DATA_DIR = BACKEND_DIR / "data"
UPLOADS_DIR = DATA_DIR / "uploads"  # Default uploads dir for global things if any

# Версия API (единое место)
__version__ = "0.1.0"

# Лимит размера загружаемых файлов (портреты, обложки, изображения) — 10 МБ
MAX_UPLOAD_SIZE_BYTES = 10 * 1024 * 1024

def get_universe_dir(universe_id: int) -> Path:
    """Путь к папке конкретной вселенной."""
    u_dir = DATA_DIR / "universes" / str(universe_id)
    u_dir.mkdir(parents=True, exist_ok=True)
    return u_dir

def get_universe_uploads_dir(universe_id: int) -> Path:
    """Получить путь к папке загрузок конкретной вселенной."""
    u_dir = get_universe_dir(universe_id) / "uploads"
    u_dir.mkdir(parents=True, exist_ok=True)
    return u_dir
DB_PATH = DATA_DIR / "archon.db"
VECTOR_STORE_PATH = DATA_DIR / "vector_store"
SQLALCHEMY_DATABASE_URL = f"sqlite:///{DB_PATH.as_posix()}"

class Settings(BaseSettings):
    model_config = {
        "env_file": str(BACKEND_DIR / ".env"),
        "env_file_encoding": "utf-8",
    }

    ollama_base_url: str = "http://localhost:11434"
    ollama_model: str = "deepseek-v3.1:671b-cloud"
    deepseek_api_key: str = ""
    deepseek_base_url: str = "https://api.deepseek.com"
    deepseek_model: str = "deepseek-chat"
    openrouter_api_key: str = ""
    openrouter_base_url: str = "https://openrouter.ai/api/v1"
    openrouter_model: str = "google/gemini-pro-1.5"
    routerai_api_key: str = ""
    routerai_base_url: str = "https://routerai.ru/api/v1"
    routerai_model: str = "openai/gpt-3.5-turbo" # Default placeholder
    default_llm_provider: str = "ollama"
    backend_port: int = 8000
    debug: bool = False
    cors_origins: str = "http://localhost:5173,http://localhost:3000"

    def get_default_model(self, provider: str) -> str:
        if provider == "ollama":
            return self.ollama_model
        if provider == "deepseek":
            return self.deepseek_model
        if provider == "openrouter":
            return self.openrouter_model
        if provider == "routerai":
            return self.routerai_model
        return self.ollama_model

settings = Settings()
