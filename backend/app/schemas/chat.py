from pydantic import BaseModel
from typing import Optional, List, Dict, Any

class ChatMessage(BaseModel):
    role: str  # user, assistant, system
    content: str
    universe_timestamp: Optional[str] = None

class ChatTime(BaseModel):
    """Момент времени во вселенной, в который происходит диалог (для фильтра контекста и истории)."""
    universe_year: int
    universe_day: int
    universe_hour: Optional[int] = 0
    universe_minute: Optional[int] = 0

class ChatRequest(BaseModel):
    character_id: Optional[int] = None
    messages: List[ChatMessage]
    model: Optional[str] = None
    provider: Optional[str] = None
    stream: Optional[bool] = False
    # Время диалога во вселенной (если не задано — текущее время вселенной)
    chat_time: Optional[ChatTime] = None
    # История других чатов (для помощника - все чаты с персонажами)
    other_chats_history: Optional[List[dict]] = None
    # Роль пользователя: "author" (автор/создатель), "helper" (помощник), "character:{id}" (персонаж)
    user_role: Optional[str] = "author"
    # Явно включить в контекст чата: ID заметок/черновиков и/или глав (полный текст попадёт в промпт)
    include_note_ids: Optional[List[int]] = None
    include_chapter_ids: Optional[List[int]] = None
    # Дополнительные настройки (например, num_ctx для Ollama)
    options: Optional[Dict[str, Any]] = None

class ChatResponse(BaseModel):
    content: str
    model: str
    provider: str
    universe_timestamp: Optional[str] = None
    prompt: Optional[str] = None  # Системный промпт для отображения
    rag_context: Optional[str] = None  # Фрагменты из RAG для отображения в чате