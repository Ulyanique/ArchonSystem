import re
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional
import json
import logging
import traceback
import asyncio

# Паттерн таймштампа вселенной в ответе персонажа (убираем, т.к. интерфейс подставляет время сам)
_UNIVERSE_TS_RE = re.compile(
    r"\[\s*\d{1,2}:\d{2}\s*,\s*\d+\s*день\s*\d+\s*года\s*[^\]]*\]\s*",
    re.IGNORECASE,
)


def _strip_universe_timestamp_from_reply(text: str) -> str:
    """Удалить из текста ответа все вхождения таймштампа [ЧЧ:ММ, N день Y года ...]. Интерфейс подставляет время сам."""
    if not text:
        return text
    return _UNIVERSE_TS_RE.sub("", text).strip()
from app.database import get_db, get_master_db
from app.config import settings
from app.schemas import ChatRequest, ChatResponse, ChatMessage
from app.services.llm import llm_service
from app.services.llm_config import load_llm_settings_from_system
from app.services import knowledge
from app.services import timeline as timeline_service
from app.services.rag import rag_service
from app.services.context_manager import context_manager
from app.services.time_service import time_service

router = APIRouter(prefix="/chat", tags=["chat"])
logger = logging.getLogger(__name__)

@router.post("/universes/{universe_id}", response_model=ChatResponse)
async def chat(universe_id: int, request: ChatRequest, db: AsyncSession = Depends(get_db), master_db: AsyncSession = Depends(get_master_db)):
    """
    Отправить сообщение в чат с ИИ во вселенной.
    """
    import traceback
    logger.info(f"chat: === START === universe_id={universe_id}, provider={request.provider}, model={request.model}")
    try:
        # universe_id берется из пути
        messages = list(request.messages)
        chat_time = request.chat_time

        # Время диалога во вселенной: из chat_time или текущее
        universe_ts = None
        universe_obj = None
        if universe_id:
            universe_obj = await knowledge.get_universe(universe_id, master_db)
            if not universe_obj:
                raise HTTPException(status_code=404, detail="Вселенная не найдена")
        if universe_obj:
            if chat_time:
                epoch = getattr(universe_obj, "universe_epoch_name", None) or "н.э."
                h = chat_time.universe_hour or 0
                m = chat_time.universe_minute or 0
                universe_ts = f"{h:02d}:{m:02d}, {chat_time.universe_day} день {chat_time.universe_year} года {epoch}"
            else:
                u_time = time_service.get_current_universe_time(universe_obj)
                universe_ts = u_time.get("display")

        # Проверяем опцию no_context - если включена, отправляем только последнее сообщение без контекста
        no_context = request.options and request.options.get("no_context", False) if request.options else False
        
        # Проверяем опцию use_character_knowledge - по умолчанию true, если выбран персонаж
        use_character_knowledge = True
        if request.options and "use_character_knowledge" in request.options:
            use_character_knowledge = request.options.get("use_character_knowledge", True)
        elif not request.character_id:
            # Если персонаж не выбран, знания персонажа не используются
            use_character_knowledge = False
        
        # Добавляем временные метки к сообщениям, если их нет
        # И готовим сообщения для LLM (включая метку времени в текст для "памяти" персонажа)
        llm_history = []
        
        if no_context:
            # Режим "только сообщение" - берем только последнее сообщение пользователя
            last_user_message = None
            for msg in reversed(messages):
                if msg.role == "user":
                    last_user_message = msg
                    break
            
            if last_user_message:
                llm_history = [ChatMessage(role="user", content=last_user_message.content)]
            else:
                llm_history = []
        else:
            # Обычный режим - вся история
            for msg in messages:
                if not msg.universe_timestamp and universe_ts:
                    msg.universe_timestamp = universe_ts

                # Для LLM добавляем метку времени в начало сообщения, чтобы персонаж понимал когда это было
                content_with_ts = msg.content
                if msg.universe_timestamp:
                    content_with_ts = f"[{msg.universe_timestamp}] {msg.content}"

                llm_history.append(ChatMessage(role=msg.role, content=content_with_ts))

        user_query = ""
        for msg in reversed(messages):
            if msg.role == "user":
                user_query = msg.content
                break
        
        # Загружаем настройки системы (нужно для enable_rag и промптов)
        from app.repositories.settings import get_system_settings
        system_settings = await get_system_settings(master_db)
        
        rag_context = ""
        # Проверяем настройку enable_rag перед использованием RAG
        enable_rag = getattr(system_settings, "enable_rag", True)
        if enable_rag and not no_context and universe_id and user_query:
            # rag_service.search_with_context пока синхронный внутри, но мы передаем db
            rag_context = await rag_service.search_with_context_async(
                universe_id=universe_id,
                query=user_query,
                n_results=5,
                character_id=request.character_id,
                db=db,
                before_universe_year=chat_time.universe_year if chat_time else None,
                before_universe_day=chat_time.universe_day if chat_time else None,
            )
        from app.services.prompt_builder import get_prompt_builder
        prompt_settings_json = getattr(system_settings, 'prompt_settings', None) or "{}"
        prompt_builder = get_prompt_builder(prompt_settings_json)
        
        # Если включен режим "только сообщение", пропускаем весь контекст
        if no_context:
            # Минимальный системный промпт только для указания языка
            system_message_content = prompt_builder.settings["language_instruction"]
        else:
            # Используем PromptBuilder для формирования промпта
            char = None
            if request.character_id:
                char = await knowledge.get_character(db, request.character_id)
                if not char:
                    raise HTTPException(status_code=404, detail="Персонаж не найден")
                if char.universe_id != universe_id:
                    raise HTTPException(status_code=400, detail="Персонаж не принадлежит указанной вселенной")
                if chat_time and not knowledge.character_alive_at_universe_time(
                    char, chat_time.universe_year, chat_time.universe_day
                ):
                    raise HTTPException(
                        status_code=400,
                        detail="В выбранное время во вселенной этот персонаж ещё не родился или уже умер. Измените время диалога или выберите другого персонажа.",
                    )
                # В 0 лет персонаж не может вести диалог
                if chat_time:
                    age_at_time = knowledge.character_age_at_universe_time(
                        char, chat_time.universe_year, chat_time.universe_day
                    )
                    if age_at_time is not None and age_at_time == 0:
                        raise HTTPException(
                            status_code=400,
                            detail="В выбранное время персонажу 0 лет — диалог недоступен. Выберите момент после дня рождения персонажа.",
                        )
            
            system_message_content = await prompt_builder.build_prompt(
                db=db,
                universe_id=universe_id,
                messages=messages,
                character=char,
                user_query=user_query,
                user_role=request.user_role,
                chat_time=chat_time,
                no_context=no_context,
                master_db=master_db,
                universe_obj=universe_obj,
                use_character_knowledge=use_character_knowledge,
                enable_rag=enable_rag,
                include_note_ids=request.include_note_ids,
                include_chapter_ids=request.include_chapter_ids,
                other_chats_history=request.other_chats_history,
            )

        # Контекст открытой страницы: что сейчас видит пользователь (для AI-терминала)
        page_ctx = request.options.get("page_context") if request.options else None
        if page_ctx and isinstance(page_ctx, dict) and not no_context:
            section = page_ctx.get("section") or page_ctx.get("section_label") or ""
            section_label = page_ctx.get("section_label") or section
            parts = [f"Пользователь сейчас на странице: {section_label}."]
            try:
                if page_ctx.get("character_id"):
                    c = await knowledge.get_character(db, int(page_ctx["character_id"]))
                    if c and c.universe_id == universe_id:
                        parts.append(
                            f" Открыт персонаж: {c.name}"
                            + (f" ({c.role})" if getattr(c, "role", None) else "")
                            + (f". Описание: {(c.description or '')[:300]}" if getattr(c, "description", None) else "")
                        )
                elif page_ctx.get("chapter_id"):
                    ch = await knowledge.get_chapter(db, int(page_ctx["chapter_id"]))
                    if ch and ch.universe_id == universe_id:
                        parts.append(
                            f" Открыта глава: «{ch.title}» (№{getattr(ch, 'chapter_number', '')})."
                            + (f" Краткое содержание: {(ch.summary or '')[:400]}" if getattr(ch, "summary", None) else "")
                            + (f" Заметки: {(ch.notes or '')[:200]}" if getattr(ch, "notes", None) and ch.notes else "")
                        )
                elif page_ctx.get("location_id"):
                    loc = await knowledge.get_location(db, int(page_ctx["location_id"]))
                    if loc and loc.universe_id == universe_id:
                        parts.append(
                            f" Открыта локация: {loc.name}."
                            + (f" Описание: {(loc.description or loc.details or '')[:300]}" if getattr(loc, "description", None) or getattr(loc, "details", None) else "")
                        )
            except (TypeError, ValueError):
                pass
            if parts:
                system_message_content = (system_message_content or "") + "\n\n=== ЧТО СЕЙЧАС ОТКРЫТО У ПОЛЬЗОВАТЕЛЯ ===\n" + "".join(parts)

        # Повторяем инструкцию по языку в конце системного сообщения, чтобы модель не переключалась на английский
        lang_instruction = (prompt_builder.settings.get("language_instruction") or "Ответь только на русском языке.").strip()
        if lang_instruction and system_message_content:
            system_message_content = system_message_content.rstrip() + "\n\n" + lang_instruction

        # Формируем итоговый список сообщений для LLM
        if system_message_content:
            final_messages = [ChatMessage(role="system", content=system_message_content)] + llm_history
        else:
            # Если системного промпта нет, отправляем только историю
            final_messages = llm_history
        
        logger.info(f"chat: final_messages count={len(final_messages)}, system_message_content length={len(system_message_content)}")
        
        provider = request.provider or settings.default_llm_provider
        _, model_from_settings = load_llm_settings_from_system(system_settings, provider)
        model = request.model or model_from_settings
        logger.info(f"chat: Using provider={provider}, model={model} (request.model={request.model}, default={settings.get_default_model(provider)})")

        if request.stream:
            show_prompt = request.options and request.options.get("show_prompt", False)
            show_rag = request.options.get("show_rag_context", True) if request.options else True
            async def stream_chunks():
                try:
                    if show_prompt:
                        yield f"data: {json.dumps({'prompt': system_message_content}, ensure_ascii=False)}\n\n"
                    if show_rag and rag_context:
                        yield f"data: {json.dumps({'rag_context': rag_context}, ensure_ascii=False)}\n\n"
                    chunk_count = 0
                    logger.warning(f"[Chat] Starting stream: provider={provider}, model={model}, messages_count={len(final_messages)}")
                    async for chunk in llm_service.chat_stream(
                        messages=final_messages,
                        provider=provider,
                        model=model,
                        options=request.options
                    ):
                        chunk_count += 1
                        # Отправляем каждый чанк без изменений (метки времени в ответе не вырезаем)
                        chunk_data = f"data: {json.dumps({'content': chunk, 'universe_timestamp': universe_ts}, ensure_ascii=False)}\n\n"
                        yield chunk_data
                        # Логируем первые 5 чанков и каждые 10-й для отладки
                        if chunk_count <= 5 or chunk_count % 10 == 0:
                            logger.debug(f"chat stream: отправлен чанк #{chunk_count} для provider={provider}, длина: {len(chunk)}")
                    
                    if chunk_count == 0:
                        logger.warning(f"chat stream: No chunks received for provider={provider}, model={model}")
                        yield f"data: {json.dumps({'error': 'Модель не вернула ответ. Проверьте логи backend для деталей.', 'status_code': 500}, ensure_ascii=False)}\n\n"
                    else:
                        logger.info(f"chat stream: Completed successfully, total chunks={chunk_count}")
                except ValueError as ve:
                    # Обработка специальных ошибок от LLM сервиса (например, недостаток средств)
                    error_msg = str(ve)
                    logger.error(f"chat stream: ValueError: {error_msg}", exc_info=True)
                    if "Недостаточно средств" in error_msg or "402" in error_msg:
                        logger.warning(f"chat stream: Payment required error: {error_msg}")
                        yield f"data: {json.dumps({'error': error_msg, 'status_code': 402}, ensure_ascii=False)}\n\n"
                    elif "401" in error_msg or "API ключ" in error_msg:
                        logger.warning(f"chat stream: Authentication error: {error_msg}")
                        yield f"data: {json.dumps({'error': error_msg, 'status_code': 401}, ensure_ascii=False)}\n\n"
                    else:
                        logger.error(f"chat stream: LLM validation error: {ve}", exc_info=True)
                        yield f"data: {json.dumps({'error': str(ve), 'status_code': 400}, ensure_ascii=False)}\n\n"
                except Exception as e:
                    logger.error(f"chat stream: Unexpected error: {type(e).__name__}: {e}", exc_info=True)
                    error_msg = str(e)
                    status_code = 500
                    if "401" in error_msg or "unauthorized" in error_msg.lower():
                        status_code = 401
                    elif "400" in error_msg or "bad request" in error_msg.lower():
                        status_code = 400
                    yield f"data: {json.dumps({'error': error_msg, 'status_code': status_code}, ensure_ascii=False)}\n\n"

            return StreamingResponse(
                stream_chunks(),
                media_type="text/event-stream",
                headers={
                    "Cache-Control": "no-cache",
                    "X-Accel-Buffering": "no",
                    "Connection": "keep-alive",
                    "Transfer-Encoding": "chunked"
                }
            )

        logger.info(f"chat: Calling llm_service.chat")
        
        try:
            content = await llm_service.chat(
                messages=final_messages,
                provider=provider,
                model=model,
                options=request.options
            )
            logger.info(f"chat: LLM response received")
            if content:
                content = content.strip()
                content = _strip_universe_timestamp_from_reply(content)

            # Проверяем, нужно ли возвращать промпт и RAG-контекст
            show_prompt_flag = request.options and request.options.get("show_prompt", False) if request.options else False
            show_rag = request.options and request.options.get("show_rag_context", True) if request.options else True

            return ChatResponse(
                content=content,
                model=model or "default",
                provider=provider,
                universe_timestamp=universe_ts,
                prompt=system_message_content if show_prompt_flag else None,
                rag_context=rag_context if (show_rag and rag_context) else None,
            )
        except ValueError as ve:
            # Обработка специальных ошибок от LLM сервиса (например, недостаток средств)
            error_msg = str(ve)
            if "Недостаточно средств" in error_msg or "402" in error_msg:
                logger.warning(f"chat: Payment required error: {error_msg}")
                raise HTTPException(status_code=402, detail=error_msg)
            logger.error(f"chat: LLM validation error: {ve}", exc_info=True)
            raise HTTPException(status_code=400, detail=str(ve))
        except Exception as llm_error:
            logger.error(f"chat: LLM error: {llm_error}", exc_info=True)
            raise
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"chat: Error processing request: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Ошибка при обработке запроса: {str(e)}")

@router.get("/models")
async def list_models(provider: Optional[str] = None, db: AsyncSession = Depends(get_master_db)):
    try:
        from app.repositories.settings import get_system_settings
        system_settings = await get_system_settings(db)
        load_llm_settings_from_system(system_settings, provider)
        models = await llm_service.list_models(provider)
        logger.info(f"list_models: provider={provider}, models_count={len(models) if models else 0}")
        return {"models": models}
    except Exception as e:
        logger.error(f"Error listing models: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Ошибка получения списка моделей: {str(e)}")

@router.get("/status")
async def connection_status():
    return await llm_service.check_connection()

@router.get("/universes/{universe_id}/context")
async def get_book_context(universe_id: int, db: AsyncSession = Depends(get_db), master_db: AsyncSession = Depends(get_master_db)):
    context = await context_manager.build_context(db, universe_id, master_db=master_db)
    return {"context": context}

@router.post("/universes/{universe_id}/smart-context")
async def get_smart_context_endpoint(
    universe_id: int,
    request_data: dict,
    db: AsyncSession = Depends(get_db),
    master_db: AsyncSession = Depends(get_master_db)
):
    try:
        from app.schemas import ChatTime
        messages_data = request_data.get("messages", [])
        messages = [ChatMessage(**msg) if isinstance(msg, dict) else msg for msg in messages_data]
        character_id = request_data.get("character_id")
        user_query = request_data.get("user_query", "")
        user_role = request_data.get("user_role")
        chat_time_data = request_data.get("chat_time")
        chat_time = ChatTime(**chat_time_data) if isinstance(chat_time_data, dict) else None

        context = await context_manager.build_smart_context_optimized(
            db, universe_id, messages, character_id, user_query, user_role, chat_time=chat_time, master_db=master_db
        )
        return {"context": context}
    except Exception as e:
        return {"context": f"(Ошибка: {str(e)})"}
