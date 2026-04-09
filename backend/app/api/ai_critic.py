from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List
import json
import re
from app.database import get_db, get_master_db
from app.schemas import Character, Location, Chapter, Note
from app.services import knowledge
from app.repositories.note import get_outline_items
from app.services.ai_critic import ai_critic_service
from app.services.llm_config import load_llm_settings_from_system
from app.repositories.settings import get_system_settings
from app.services.rag import rag_service

router = APIRouter(prefix="/universes/{universe_id}/ai", tags=["ai-critic"])

@router.post("/characters/{character_id}/analyze")
async def analyze_character(universe_id: int, character_id: int, stream: bool = False, db: AsyncSession = Depends(get_db), master_db: AsyncSession = Depends(get_master_db)):
    """Анализ персонажа с поддержкой стриминга"""
    character = await knowledge.get_character(db, character_id)
    if not character or character.universe_id != universe_id:
        raise HTTPException(status_code=404, detail="Персонаж не найден")
    
    # Получаем контекст вселенной
    book = await knowledge.get_universe(universe_id, master_db)
    all_characters = await knowledge.get_characters(db, universe_id)
    
    book_context = f"{book.title}\n{book.description}\n{book.genre}" if book else ""
    
    character_data = {
        "name": character.name,
        "role": character.role,
        "description": character.description,
        "traits": character.traits,
        "appearance": character.appearance,
        "backstory": character.backstory
    }

    system_settings = await get_system_settings(master_db)
    provider, model = load_llm_settings_from_system(system_settings)
    
    if stream:
        async def stream_analysis():
            import asyncio
            full_text = ""
            parsed_result = None
            chunk_count = 0
            last_chunk_time = asyncio.get_event_loop().time()
            
            # Отправляем начальное сообщение
            yield f"data: {json.dumps({'status': 'started', 'message': 'Начинаю анализ...'}, ensure_ascii=False)}\n\n"
            
            print(f"[AI Critic API] Начинаю стриминг анализа для персонажа ID={character_id}")
            print(f"[AI Critic API] Провайдер: {provider}, модель: {model}")
            
            stream_gen = ai_critic_service.analyze_character(
                character_data=character_data,
                book_context=book_context,
                all_characters=[{
                    "name": c.name,
                    "role": c.role,
                    "traits": c.traits
                } for c in all_characters if c.id != character_id],
                stream=True,
                provider=provider,
                model=model,
            )
            
            try:
                async for chunk in stream_gen:
                    chunk_count += 1
                    current_time = asyncio.get_event_loop().time()
                    time_since_last = current_time - last_chunk_time
                    last_chunk_time = current_time
                    
                    # Обрабатываем heartbeat сообщения
                    if "<HEARTBEAT>" in chunk:
                        heartbeat_match = re.search(r'<HEARTBEAT>(.*?)</HEARTBEAT>', chunk, re.DOTALL)
                        if heartbeat_match:
                            try:
                                heartbeat_data = json.loads(heartbeat_match.group(1))
                                yield f"data: {json.dumps(heartbeat_data, ensure_ascii=False)}\n\n"
                            except:
                                pass
                        # Удаляем heartbeat из chunk перед дальнейшей обработкой
                        chunk = re.sub(r'<HEARTBEAT>.*?</HEARTBEAT>', '', chunk, flags=re.DOTALL)
                    
                    # Проверяем, не завершился ли анализ
                    if "<ANALYSIS_COMPLETE>" in chunk:
                        # Извлекаем JSON из завершающего маркера
                        match = re.search(r'<ANALYSIS_COMPLETE>(.*?)</ANALYSIS_COMPLETE>', chunk, re.DOTALL)
                        if match:
                            try:
                                parsed_result = json.loads(match.group(1))
                                print(f"[AI Critic API] Получен финальный результат: score={parsed_result.get('score', 0)}")
                            except Exception as e:
                                print(f"[AI Critic API] Ошибка парсинга финального результата: {e}")
                        # Отправляем только текст до маркера
                        chunk = chunk.split("<ANALYSIS_COMPLETE>")[0]
                    
                    if chunk and chunk.strip():
                        full_text += chunk
                        yield f"data: {json.dumps({'content': chunk}, ensure_ascii=False)}\n\n"
                        # Логируем каждые 20 чанков
                        if chunk_count % 20 == 0:
                            print(f"[AI Critic API] Отправлено {chunk_count} чанков, длина текста: {len(full_text)} символов")
                            
            except Exception as e:
                import traceback
                error_msg = f"Ошибка стриминга: {str(e)}\n{traceback.format_exc()}"
                print(f"[AI Critic API] {error_msg}")
                yield f"data: {json.dumps({'error': str(e), 'status': 'error'}, ensure_ascii=False)}\n\n"
                raise
            
            print(f"[AI Critic API] Стриминг завершен. Всего чанков: {chunk_count}, длина текста: {len(full_text)} символов")
            
            # Сохраняем анализ в базу данных после завершения
            if parsed_result:
                from app.schemas import CharacterUpdate
                analysis_json = json.dumps(parsed_result, ensure_ascii=False)
                await knowledge.update_character(db, character_id, CharacterUpdate(ai_analysis=analysis_json))
                yield f"data: {json.dumps({'complete': True, 'result': parsed_result}, ensure_ascii=False)}\n\n"
            else:
                # Пытаемся распарсить из полного текста
                try:
                    parsed_result = ai_critic_service._parse_json_response(full_text)
                    from app.schemas import CharacterUpdate
                    analysis_json = json.dumps(parsed_result, ensure_ascii=False)
                    await knowledge.update_character(db, character_id, CharacterUpdate(ai_analysis=analysis_json))
                    yield f"data: {json.dumps({'complete': True, 'result': parsed_result}, ensure_ascii=False)}\n\n"
                except:
                    yield f"data: {json.dumps({'error': 'Не удалось распарсить результат'}, ensure_ascii=False)}\n\n"
        
        return StreamingResponse(
            stream_analysis(),
            media_type="text/event-stream",
            headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"}
        )
    else:
        result_coro = ai_critic_service.analyze_character(
            character_data=character_data,
            book_context=book_context,
            all_characters=[{
                "name": c.name,
                "role": c.role,
                "traits": c.traits
            } for c in all_characters if c.id != character_id],
            stream=False,
            provider=provider,
            model=model,
        )
        result = await result_coro
        
        # Сохраняем анализ в базу данных
        from app.schemas import CharacterUpdate
        analysis_json = json.dumps(result, ensure_ascii=False)
        await knowledge.update_character(db, character_id, CharacterUpdate(ai_analysis=analysis_json))
        
        return result

@router.post("/locations/{location_id}/analyze")
async def analyze_location(universe_id: int, location_id: int, db: AsyncSession = Depends(get_db), master_db: AsyncSession = Depends(get_master_db)):
    """Анализ локации"""
    location = await knowledge.get_location(db, location_id)
    if not location or location.universe_id != universe_id:
        raise HTTPException(status_code=404, detail="Локация не найдена")
    
    book = await knowledge.get_universe(universe_id, master_db)
    all_locations = await knowledge.get_locations(db, universe_id)
    system_settings = await get_system_settings(master_db)
    provider, model = load_llm_settings_from_system(system_settings)
    
    book_context = f"{book.title}\n{book.description}\n{book.genre}" if book else ""
    
    location_data = {
        "name": location.name,
        "location_type": location.location_type,
        "description": location.description,
        "details": location.details
    }
    
    result = await ai_critic_service.analyze_location(
        location_data=location_data,
        book_context=book_context,
        all_locations=[{
            "name": l.name,
            "location_type": l.location_type,
            "description": l.description
        } for l in all_locations if l.id != location_id],
        provider=provider,
        model=model,
    )
    
    return result

@router.post("/chapters/{chapter_id}/analyze")
async def analyze_chapter(universe_id: int, chapter_id: int, db: AsyncSession = Depends(get_db), master_db: AsyncSession = Depends(get_master_db)):
    """Анализ главы"""
    chapter = await knowledge.get_chapter(db, chapter_id)
    if not chapter or chapter.universe_id != universe_id:
        raise HTTPException(status_code=404, detail="Глава не найдена")
    
    book = await knowledge.get_universe(universe_id, master_db)
    all_chapters = await knowledge.get_chapters(db, universe_id)
    system_settings = await get_system_settings(master_db)
    provider, model = load_llm_settings_from_system(system_settings)
    
    book_context = f"{book.title}\n{book.description}\n{book.genre}" if book else ""
    
    chapter_data = {
        "chapter_number": chapter.chapter_number,
        "title": chapter.title,
        "summary": chapter.summary,
        "content": chapter.content,
        "notes": chapter.notes
    }
    
    result = await ai_critic_service.analyze_chapter(
        chapter_data=chapter_data,
        book_context=book_context,
        all_chapters=[{
            "chapter_number": c.chapter_number,
            "title": c.title,
            "summary": c.summary
        } for c in all_chapters if c.id != chapter_id],
        provider=provider,
        model=model,
    )
    
    return result


@router.post("/acts/{act_id}/analyze")
async def analyze_act(universe_id: int, act_id: int, db: AsyncSession = Depends(get_db), master_db: AsyncSession = Depends(get_master_db)):
    """Анализ акта (пункт плана типа act): структура, темп, связность глав"""
    outline = await get_outline_items(db, universe_id)
    act_item = next((o for o in outline if o.id == act_id), None)
    if not act_item or getattr(act_item, "outline_type", None) != "act":
        raise HTTPException(status_code=404, detail="Акт не найден")
    if getattr(act_item, "enabled", True) is False:
        raise HTTPException(status_code=400, detail="Акт отключён (скрыт). Включите его в плане для анализа.")
    # Главы этого акта: только включённые пункты типа chapter после этого акта до следующего акта
    act_index = outline.index(act_item)
    chapter_ids = []
    for i in range(act_index + 1, len(outline)):
        item = outline[i]
        if getattr(item, "outline_type", None) == "act":
            break
        if getattr(item, "enabled", True) is False:
            continue
        if getattr(item, "outline_type", None) == "chapter" and getattr(item, "chapter_id", None):
            chapter_ids.append(item.chapter_id)
    chapters = []
    for cid in chapter_ids:
        ch = await knowledge.get_chapter(db, cid)
        if ch and ch.universe_id == universe_id and getattr(ch, "enabled", True) is not False:
            chapters.append(ch)
    book = await knowledge.get_universe(universe_id, master_db)
    all_chapters_raw = await knowledge.get_chapters(db, universe_id)
    all_chapters = [c for c in all_chapters_raw if getattr(c, "enabled", True) is not False]
    system_settings = await get_system_settings(master_db)
    provider, model = load_llm_settings_from_system(system_settings)
    book_context = f"{book.title}\n{book.description}\n{book.genre}" if book else ""
    chapters_data = [
        {"chapter_number": c.chapter_number, "title": c.title, "summary": c.summary or "", "content": c.content or ""}
        for c in chapters
    ]
    result = await ai_critic_service.analyze_act(
        act_title=getattr(act_item, "title", "Акт"),
        chapters_data=chapters_data,
        book_context=book_context,
        all_chapters=[{"chapter_number": c.chapter_number, "title": c.title, "summary": (c.summary or "")} for c in all_chapters],
        provider=provider,
        model=model,
    )
    return result


@router.post("/chapters/{chapter_id}/beats/{beat_id}/analyze")
async def analyze_beat(universe_id: int, chapter_id: int, beat_id: int, db: AsyncSession = Depends(get_db), master_db: AsyncSession = Depends(get_master_db)):
    """Анализ сцены (scene beat)"""
    chapter = await knowledge.get_chapter(db, chapter_id)
    if not chapter or chapter.universe_id != universe_id:
        raise HTTPException(status_code=404, detail="Глава не найдена")
    beat = await knowledge.get_beat(db, beat_id)
    if not beat or beat.chapter_id != chapter_id:
        raise HTTPException(status_code=404, detail="Сцена не найдена")
    book = await knowledge.get_universe(universe_id, master_db)
    system_settings = await get_system_settings(master_db)
    provider, model = load_llm_settings_from_system(system_settings)
    book_context = f"{book.title}\n{book.description}\n{book.genre}" if book else ""
    chapter_context = f"Глава {chapter.chapter_number}: {chapter.title}. Краткое содержание: {chapter.summary or ''}"
    beat_data = {"title": beat.title, "description": beat.description or "", "content": beat.content or ""}
    result = await ai_critic_service.analyze_beat(
        beat_data=beat_data,
        chapter_context=chapter_context,
        book_context=book_context,
        provider=provider,
        model=model,
    )
    return result


@router.post("/notes/{note_id}/analyze")
async def analyze_note(universe_id: int, note_id: int, db: AsyncSession = Depends(get_db), master_db: AsyncSession = Depends(get_master_db)):
    """Анализ заметки"""
    note = await knowledge.get_note(db, note_id)
    if not note or note.universe_id != universe_id:
        raise HTTPException(status_code=404, detail="Заметка не найдена")
    
    book = await knowledge.get_universe(universe_id, master_db)
    system_settings = await get_system_settings(master_db)
    provider, model = load_llm_settings_from_system(system_settings)
    book_context = f"{book.title}\n{book.description}\n{book.genre}" if book else ""
    
    note_data = {
        "title": note.title,
        "note_type": note.note_type,
        "content": note.content
    }
    
    result = await ai_critic_service.analyze_note(
        note_data=note_data,
        book_context=book_context,
        provider=provider,
        model=model,
    )
    
    return result

@router.post("/consistency")
async def analyze_consistency(universe_id: int, db: AsyncSession = Depends(get_db), master_db: AsyncSession = Depends(get_master_db)):
    """Анализ согласованности вселенной"""
    book = await knowledge.get_universe(universe_id, master_db)
    if not book:
        raise HTTPException(status_code=404, detail="Вселенная не найдена")
    
    all_characters = await knowledge.get_characters(db, universe_id)
    all_locations = await knowledge.get_locations(db, universe_id)
    all_chapters = await knowledge.get_chapters(db, universe_id)
    system_settings = await get_system_settings(master_db)
    provider, model = load_llm_settings_from_system(system_settings)
    
    book_data = {
        "title": book.title,
        "genre": book.genre,
        "description": book.description
    }
    
    result = await ai_critic_service.analyze_book_consistency(
        book_data=book_data,
        all_characters=[{
            "name": c.name,
            "role": c.role,
            "traits": c.traits,
            "backstory": c.backstory
        } for c in all_characters],
        all_locations=[{
            "name": l.name,
            "location_type": l.location_type,
            "description": l.description
        } for l in all_locations],
        all_chapters=[{
            "chapter_number": c.chapter_number,
            "title": c.title,
            "summary": c.summary,
            "content": c.content
        } for c in all_chapters],
        provider=provider,
        model=model,
    )
    
    return result
