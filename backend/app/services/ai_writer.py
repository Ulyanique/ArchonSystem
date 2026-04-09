"""Сервис для ИИ-написания текста глав с контекстом вселенной."""
from typing import AsyncGenerator, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from app.services import knowledge
from app.services import timeline as timeline_service
from app.services.rag import rag_service
from app.services.llm import llm_service
from app.schemas import ChatMessage
from app.config import settings

# Сколько символов конца предыдущих глав подставлять в контекст
PREVIOUS_CHAPTER_TAIL = 2500


async def _build_chapter_context(db: AsyncSession, universe_id: int, chapter_id: int, mode: str, master_db: AsyncSession) -> str:
    """Собрать контекст для написания главы."""
    book = await knowledge.get_universe(universe_id, master_db)
    if not book:
        return ""
    parts = [f"=== КНИГА: {book.title} ==="]
    if book.description:
        parts.append(f"Описание: {book.description}")
    if book.genre:
        parts.append(f"Жанр: {book.genre}")
    direction = getattr(book, "direction", None) or ""
    if direction:
        parts.append(f"Направление: {direction}")

    characters = [c for c in await knowledge.get_characters(db, universe_id) if getattr(c, "enabled", True) is not False]
    if characters:
        parts.append("\n=== ПЕРСОНАЖИ ===")
        for c in characters[:25]:
            parts.append(f"- {c.name} ({c.role}): {c.traits}; {c.appearance or ''}")
    locations = [loc for loc in await knowledge.get_locations(db, universe_id) if getattr(loc, "enabled", True) is not False]
    if locations:
        parts.append("\n=== ЛОКАЦИИ ===")
        for loc in locations[:20]:
            parts.append(f"- {loc.name}: {loc.description or loc.details}")

    notes = [n for n in await knowledge.get_notes(db, universe_id) if getattr(n, "enabled", True) is not False]
    avoid_notes = [n for n in notes if (n.note_type or "").strip().lower() == "avoid"]
    if avoid_notes:
        parts.append("\n=== ЧЕГО ИЗБЕГАТЬ В ТЕКСТЕ ===")
        parts.append("Не используй в тексте следующие темы и приёмы:")
        for n in avoid_notes:
            parts.append(f"- {n.title}: {n.content}")

    chapters = [ch for ch in await knowledge.get_chapters(db, universe_id) if getattr(ch, "enabled", True) is not False]
    
    # Таймлайн событий
    timeline_events = await timeline_service.get_timeline_events(db, universe_id)
    if timeline_events:
        parts.append("\n=== ТАЙМЛАЙН СОБЫТИЙ ===")
        for event in timeline_events[:30]:  # Ограничиваем до 30 событий
            event_info = f"- {event.title}"
            if event.date_value:
                event_info += f" ({event.date_value})"
            if event.description:
                event_info += f": {event.description}"
            parts.append(event_info)
    
    current = await knowledge.get_chapter(db, chapter_id)
    if not current:
        return "\n".join(parts)

    # Предыдущие главы: конец текста для режима continue
    prev_texts = []
    for ch in chapters:
        if ch.id == chapter_id:
            break
        if ch.content:
            tail = ch.content[-PREVIOUS_CHAPTER_TAIL:] if len(ch.content) > PREVIOUS_CHAPTER_TAIL else ch.content
            prev_texts.append(f"--- Конец главы {ch.chapter_number}: {ch.title} ---\n{tail}")
    if prev_texts:
        parts.append("\n=== КОНЕЦ ПРЕДЫДУЩИХ ГЛАВ ===")
        parts.append("\n".join(prev_texts[-3:]))  # последние 3 главы

    parts.append(f"\n=== ТЕКУЩАЯ ГЛАВА: {current.title} ===")
    parts.append(f"Краткое содержание: {current.summary or 'не задано'}")
    if current.notes:
        parts.append(f"Заметки к главе: {current.notes}")

    return "\n".join(parts)


async def write_chapter_prose(
    db: AsyncSession,
    universe_id: int,
    chapter_id: int,
    mode: str = "from_summary",
    prompt_extra: Optional[str] = None,
    master_db: Optional[AsyncSession] = None,
) -> AsyncGenerator[str, None]:
    """
    Сгенерировать текст главы (стриминг).
    mode: from_summary — по описанию главы; continue — продолжить после предыдущих глав.
    """
    if not master_db:
        raise ValueError("master_db is required for write_chapter_prose")
    current = await knowledge.get_chapter(db, chapter_id)
    if not current or current.universe_id != universe_id:
        return
    context = await _build_chapter_context(db, universe_id, chapter_id, mode, master_db)
    rag_extra = ""
    if current.summary or current.notes:
        q = f"{current.summary or ''} {current.notes or ''}".strip()
        if q:
            rag_extra = await rag_service.search_with_context_async(universe_id, q, n_results=3)

    if rag_extra:
        context = f"{context}\n\n{rag_extra}"

    if mode == "continue":
        instruction = (
            "Продолжи историю вселенной. Опиши события этой главы, опираясь на конец предыдущих глав и краткое содержание текущей. "
            "Сохраняй стиль и тон. Пиши законченный текст главы (проза, без пометок)."
        )
    else:
        instruction = (
            "Напиши полный текст этой главы по краткому содержанию и заметкам. "
            "Опирайся на контекст вселенной (персонажи, локации, жанр). Пиши только прозу, без заголовков и пометок."
        )
    if prompt_extra:
        instruction += f"\nДополнительно: {prompt_extra}"

    user_content = f"{instruction}\n\n--- КОНТЕКСТ ---\n{context}"
    messages = [ChatMessage(role="user", content=user_content)]
    provider = settings.default_llm_provider
    model = settings.get_default_model(provider)
    async for chunk in llm_service.chat_stream(messages=messages, provider=provider, model=model):
        yield chunk


async def write_chapter_prose_from_instruction(
    db: AsyncSession,
    universe_id: int,
    chapter_id: int,
    instruction: str,
    text_before_cursor: Optional[str] = None,
    master_db: Optional[AsyncSession] = None,
) -> AsyncGenerator[str, None]:
    """
    Сгенерировать прозу по инструкции автора (режим Write / scene beat).
    text_before_cursor: текст главы до места вставки (для «Продолжи с этого места»).
    Если instruction пусто и задан text_before_cursor — используется промпт «продолжи».
    """
    if not master_db:
        raise ValueError("master_db is required for write_chapter_prose_from_instruction")
    current = await knowledge.get_chapter(db, chapter_id)
    if not current or current.universe_id != universe_id:
        return
    context = await _build_chapter_context(db, universe_id, chapter_id, "from_summary", master_db)

    if text_before_cursor and (text_before_cursor or "").strip():
        context = f"{context}\n\n--- ТЕКСТ ДО МЕСТА ВСТАВКИ (продолжи после него) ---\n{(text_before_cursor or '').strip()}"

    rag_extra = ""
    q = (instruction or "").strip() or f"{current.summary or ''} {current.notes or ''}".strip()
    if q:
        rag_extra = await rag_service.search_with_context_async(universe_id, q, n_results=3)
    if rag_extra:
        context = f"{context}\n\n{rag_extra}"

    instruction_stripped = (instruction or "").strip()
    if not instruction_stripped and text_before_cursor:
        main_instruction = (
            "Продолжи историю с этого места. Сохраняй стиль, тон и логику сюжета. "
            "Пиши только прозу, без заголовков и пояснений."
        )
    else:
        main_instruction = (
            "Ты — автор. Ниже дана инструкция от автора (что написать). "
            "Опирайся на контекст вселенной (персонажи, локации, жанр, тон). "
            "Пиши только прозу, без заголовков и пояснений. Сохраняй стиль и логику сюжета.\n\n"
            f"Инструкция автора: {instruction_stripped or 'Продолжи с этого места.'}"
        )
    user_content = f"{main_instruction}\n\n--- КОНТЕКСТ ВСЕЛЕННОЙ И ГЛАВЫ ---\n{context}"
    messages = [ChatMessage(role="user", content=user_content)]
    provider = settings.default_llm_provider
    model = settings.get_default_model(provider)
    async for chunk in llm_service.chat_stream(messages=messages, provider=provider, model=model):
        yield chunk


async def write_chapter_prose_full(
    db: AsyncSession,
    universe_id: int,
    chapter_id: int,
    mode: str = "from_summary",
    prompt_extra: Optional[str] = None,
    master_db: Optional[AsyncSession] = None,
) -> str:
    """Сгенерировать текст главы целиком (без стриминга). Fallback при недоступности стрима."""
    if not master_db:
        raise ValueError("master_db is required for write_chapter_prose_full")
    current = await knowledge.get_chapter(db, chapter_id)
    if not current or current.universe_id != universe_id:
        return ""
    context = await _build_chapter_context(db, universe_id, chapter_id, mode, master_db)
    rag_extra = ""
    if current.summary or current.notes:
        q = f"{current.summary or ''} {current.notes or ''}".strip()
        if q:
            rag_extra = await rag_service.search_with_context_async(universe_id, q, n_results=3)
    if rag_extra:
        context = f"{context}\n\n{rag_extra}"
    if mode == "continue":
        instruction = (
            "Продолжи историю вселенной. Опиши события этой главы, опираясь на конец предыдущих глав и краткое содержание текущей. "
            "Сохраняй стиль и тон. Пиши законченный текст главы (проза, без пометок)."
        )
    else:
        instruction = (
            "Напиши полный текст этой главы по краткому содержанию и заметкам. "
            "Опирайся на контекст вселенной (персонажи, локации, жанр). Пиши только прозу, без заголовков и пометок."
        )
    if prompt_extra:
        instruction += f"\nДополнительно: {prompt_extra}"
    user_content = f"{instruction}\n\n--- КОНТЕКСТ ---\n{context}"
    messages = [ChatMessage(role="user", content=user_content)]
    provider = settings.default_llm_provider
    model = settings.get_default_model(provider)
    return await llm_service.chat(messages=messages, provider=provider, model=model, stream=False)


async def get_chapter_suggestions(
    db: AsyncSession,
    universe_id: int,
    chapter_id: int,
    master_db: Optional[AsyncSession] = None,
) -> dict:
    """
    Получить подсказки ИИ для написания главы на основе контекста вселенной.
    Возвращает словарь с подсказками по персонажам, локациям, событиям и стилю.
    """
    if not master_db:
        raise ValueError("master_db is required for get_chapter_suggestions")
    
    current = await knowledge.get_chapter(db, chapter_id)
    if not current or current.universe_id != universe_id:
        return {}
    
    context = await _build_chapter_context(db, universe_id, chapter_id, "from_summary", master_db)
    
    # RAG поиск релевантного контекста
    rag_extra = ""
    if current.summary or current.notes:
        q = f"{current.summary or ''} {current.notes or ''}".strip()
        if q:
            rag_extra = await rag_service.search_with_context_async(universe_id, q, n_results=5)
    
    if rag_extra:
        context = f"{context}\n\n{rag_extra}"
    
    prompt = f"""Проанализируй контекст вселенной и краткое содержание главы. Дай конкретные подсказки для автора:

ГЛАВА: {current.title}
Краткое содержание: {current.summary or 'не задано'}
Заметки: {current.notes or 'нет'}

Ответь в формате JSON со следующими полями:
{{
  "characters": ["список имён персонажей, которые логично могут появиться в этой главе, с кратким обоснованием"],
  "locations": ["список локаций, которые подходят для этой главы, с кратким обоснованием"],
  "events": ["релевантные события из таймлайна, которые могут быть упомянуты или повлиять на главу"],
  "style_tips": ["советы по стилю и тону, основанные на жанре вселенной"],
  "plot_ideas": ["конкретные идеи для развития сюжета в этой главе"],
  "warnings": ["предупреждения о возможных противоречиях с предыдущими главами или лором"]
}}

--- КОНТЕКСТ ВСЕЛЕННОЙ ---
{context}
"""
    
    messages = [ChatMessage(role="user", content=prompt)]
    provider = settings.default_llm_provider
    model = settings.get_default_model(provider)
    
    try:
        response = await llm_service.chat(messages=messages, provider=provider, model=model, stream=False)
        import json
        import re
        
        # Извлекаем JSON из ответа (может быть обёрнут в markdown код)
        json_match = re.search(r'```(?:json)?\s*(\{.*?\})\s*```', response, re.DOTALL)
        if json_match:
            response = json_match.group(1)
        else:
            # Пытаемся найти JSON напрямую
            json_match = re.search(r'\{.*\}', response, re.DOTALL)
            if json_match:
                response = json_match.group(0)
        
        suggestions = json.loads(response)
        return suggestions
    except Exception as e:
        # В случае ошибки парсинга возвращаем структуру с сообщением об ошибке
        return {
            "error": f"Не удалось получить подсказки: {str(e)}",
            "characters": [],
            "locations": [],
            "events": [],
            "style_tips": [],
            "plot_ideas": [],
            "warnings": []
        }
