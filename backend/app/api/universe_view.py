"""API для страницы «Вселенная целиком»: полный текст, расширение/перезапись фрагмента, привязка к сущностям."""
import json
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from app.utils.author_notes import strip_author_notes as do_strip_author_notes
from app.utils.resolve_markers import resolve_markers
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel
from app.database import get_db, get_master_db
from app.services import knowledge
from app.services.context_manager import context_manager
from app.services.llm import llm_service
from app.services.llm_config import load_llm_settings_from_system
from app.repositories.settings import get_system_settings
from app.schemas import ChatMessage, ChapterUpdate

router = APIRouter(prefix="/universes/{universe_id}/book-view", tags=["book-view"])


class ExpandFragmentBody(BaseModel):
    fragment: str


class LinkBody(BaseModel):
    chapter_id: int
    start_offset: int
    end_offset: int
    entity_type: str  # character, location, note
    entity_id: int


class RewriteBody(BaseModel):
    chapter_id: int
    start_offset: int
    end_offset: int
    fragment: str


class GenerateBeatBody(BaseModel):
    chapter_id: int
    beat_id: Optional[int] = None  # если нет — генерируем «следующий» бит (контекст = всё до конца главы)
    beat_title: str = ""
    beat_description: Optional[str] = None  # описание сцены (что должно произойти) — подставляется в промпт
    words: int = 400  # 200, 400 или 600
    instructions: Optional[str] = None
    additional_context: Optional[str] = None


class GenerateBeatDescriptionBody(BaseModel):
    chapter_id: int
    beat_id: Optional[int] = None  # если есть — контекст учитывает соседние биты
    beat_title: str = ""


@router.get("/text")
async def get_full_text(
    universe_id: int,
    db: AsyncSession = Depends(get_db),
    master_db: AsyncSession = Depends(get_master_db),
    resolve_links: bool = Query(False, alias="resolve_links"),
    strip_author_notes: bool = Query(False, description="Убрать блоки %% ... %% (комментарии автора для ИИ) из текста для превью/экспорта"),
):
    """Получить полный текст вселенной: конкатенация глав по порядку + структура глав + биты сцен. Комментарии автора %% ... %% видны только ИИ; при strip_author_notes=true удаляются."""
    if not await knowledge.get_universe(universe_id, master_db):
        raise HTTPException(status_code=404, detail="Вселенная не найдена")
    chapters = [c for c in await knowledge.get_chapters(db, universe_id) if getattr(c, "enabled", True)]
    chapters = sorted(chapters, key=lambda c: (c.chapter_number, c.id))
    parts = []
    chapter_list = []
    for ch in chapters:
        beats = await knowledge.get_beats(db, ch.id)
        if beats:
            content = "\n\n".join((b.content or "").strip() for b in beats).strip()
        else:
            content = (ch.content or "").strip()
        if strip_author_notes:
            content = do_strip_author_notes(content)
        if resolve_links:
            content = await resolve_markers(db, universe_id, content)
        header = f"# Глава {ch.chapter_number}: {ch.title}\n\n"
        block = header + content
        beat_contents = []
        for b in beats:
            c = (b.content or "").strip()
            if strip_author_notes:
                c = do_strip_author_notes(c)
            desc = (getattr(b, "description", None) or "").strip()
            beat_contents.append({"id": b.id, "sort_order": b.sort_order, "title": (b.title or ""), "description": desc, "content": c})
        chapter_list.append({
            "id": ch.id,
            "title": ch.title,
            "chapter_number": ch.chapter_number,
            "content": content,
            "beats": beat_contents,
        })
        parts.append(block)
    full_text = "\n\n".join(parts) if parts else ""
    return {"fullText": full_text, "chapters": chapter_list}


@router.post("/expand")
async def expand_fragment(universe_id: int, body: ExpandFragmentBody, db: AsyncSession = Depends(get_db), master_db: AsyncSession = Depends(get_master_db)):
    """Расширить выделенный фрагмент текста с помощью ИИ (контекст вселенной)."""
    if not await knowledge.get_universe(universe_id, master_db):
        raise HTTPException(status_code=404, detail="Вселенная не найдена")
    fragment = (body.fragment or "").strip()
    if not fragment:
        raise HTTPException(status_code=400, detail="Фрагмент пуст")
    context = await context_manager.build_context(db, universe_id, master_db=master_db)
    prompt = f"""Контекст вселенной для автора:

{context}

Выделенный фрагмент текста (нужно расширить, развить, не меняя смысла):
---
{fragment}
---

Напиши расширенную версию этого фрагмента: больше деталей, атмосферы, внутренних переживаний или действий — в том же стиле. Верни только расширенный текст, без пояснений."""
    try:
        system_settings = await get_system_settings(master_db)
        provider, model = load_llm_settings_from_system(system_settings)
        response = await llm_service.chat(
            messages=[ChatMessage(role="user", content=prompt)],
            provider=provider,
            model=model,
        )
        return {"expanded": (response or "").strip()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ошибка ИИ: {str(e)}")


@router.post("/link")
async def link_selection(universe_id: int, body: LinkBody, db: AsyncSession = Depends(get_db), master_db: AsyncSession = Depends(get_master_db)):
    """Привязать выделенный фрагмент главы к сущности (персонаж/локация/заметка). В текст подставляется маркер [[type:id]]."""
    if not await knowledge.get_universe(universe_id, master_db):
        raise HTTPException(status_code=404, detail="Вселенная не найдена")
    ch = await knowledge.get_chapter(db, body.chapter_id)
    if not ch or ch.universe_id != universe_id:
        raise HTTPException(status_code=404, detail="Глава не найдена")
    if body.entity_type not in ("character", "location", "note"):
        raise HTTPException(status_code=400, detail="entity_type должен быть character, location или note")
    content = ch.content or ""
    start, end = body.start_offset, body.end_offset
    if start < 0 or end > len(content) or start >= end:
        raise HTTPException(status_code=400, detail="Некорректный диапазон")
    marker = f"[[{body.entity_type}:{body.entity_id}]]"
    new_content = content[:start] + marker + content[end:]
    await knowledge.update_chapter(db, body.chapter_id, ChapterUpdate(content=new_content))
    return {"content": new_content}


@router.post("/rewrite")
async def rewrite_fragment(universe_id: int, body: RewriteBody, db: AsyncSession = Depends(get_db), master_db: AsyncSession = Depends(get_master_db)):
    """Переписать выделенный фрагмент с помощью ИИ: контекст вселенной + фрагмент, вернуть новый текст (замена вместо вставки)."""
    if not await knowledge.get_universe(universe_id, master_db):
        raise HTTPException(status_code=404, detail="Вселенная не найдена")
    ch = await knowledge.get_chapter(db, body.chapter_id)
    if not ch or ch.universe_id != universe_id:
        raise HTTPException(status_code=404, detail="Глава не найдена")
    fragment = (body.fragment or "").strip()
    if not fragment:
        raise HTTPException(status_code=400, detail="Фрагмент пуст")
    context = await context_manager.build_context(db, universe_id, master_db=master_db)
    prompt = f"""Контекст вселенной для автора:

{context}

Выделенный фрагмент текста (нужно переписать в том же стиле, можно изменить формулировки, улучшить):
---
{fragment}
---

Напиши переписанную версию этого фрагмента: тот же смысл, тот же стиль, без пояснений. Верни только новый текст."""
    try:
        system_settings = await get_system_settings(master_db)
        provider, model = load_llm_settings_from_system(system_settings)
        response = await llm_service.chat(
            messages=[ChatMessage(role="user", content=prompt)],
            provider=provider,
            model=model,
        )
        return {"replacement": (response or "").strip()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ошибка ИИ: {str(e)}")


async def _text_before_beat(db: AsyncSession, universe_id: int, chapter_id: int, before_beat_sort_order: Optional[int]) -> str:
    """Текст книги до начала текущего бита: все предыдущие главы + в текущей главе все биты с sort_order < before_beat_sort_order."""
    chapters = [c for c in await knowledge.get_chapters(db, universe_id) if getattr(c, "enabled", True)]
    chapters = sorted(chapters, key=lambda c: (c.chapter_number, c.id))
    parts = []
    for ch in chapters:
        if ch.id != chapter_id:
            beats = await knowledge.get_beats(db, ch.id)
            if beats:
                content = "\n\n".join((b.content or "").strip() for b in beats).strip()
            else:
                content = (ch.content or "").strip()
            if content:
                parts.append(content)
        else:
            beats = await knowledge.get_beats(db, ch.id)
            for b in beats:
                if before_beat_sort_order is None or b.sort_order < before_beat_sort_order:
                    if (b.content or "").strip():
                        parts.append((b.content or "").strip())
            break
    return "\n\n".join(parts).strip()


WRITE_MODE_SYSTEM = """Ты — опытный писатель художественной литературы. Пиши в прошедшем времени, на русском языке (орфография, грамматика, разговорный стиль). Используй активный залог. Следуй принципу «показывай, не рассказывай». Избегай наречий, клише и избитых фраз. Передавай события через диалоги и действия. Чередуй короткие и длинные предложения. Не используй теги «он сказал / она сказала» — передавай через действия и реплики. Диалог должен двигать действие. Верни только текст сцены, без пояснений и заголовков."""


@router.post("/generate-beat")
async def generate_beat(universe_id: int, body: GenerateBeatBody, db: AsyncSession = Depends(get_db), master_db: AsyncSession = Depends(get_master_db)):
    """Режим write: сгенерировать текст для сценарного бита. Контекст = вселенная + текст до этой сцены; объём в словах 200/400/600."""
    if not await knowledge.get_universe(universe_id, master_db):
        raise HTTPException(status_code=404, detail="Вселенная не найдена")
    ch = await knowledge.get_chapter(db, body.chapter_id)
    if not ch or ch.universe_id != universe_id:
        raise HTTPException(status_code=404, detail="Глава не найдена")
    words = body.words if body.words in (200, 400, 600) else 400
    before_sort: Optional[int] = None
    if body.beat_id:
        beat = await knowledge.get_beat(db, body.beat_id)
        if beat and beat.chapter_id == body.chapter_id:
            before_sort = beat.sort_order
    context_before = await _text_before_beat(db, universe_id, body.chapter_id, before_sort)
    universe_context = await context_manager.build_context(db, universe_id, master_db=master_db)
    scene_label = (body.beat_title or "Сцена").strip() or "Сцена"
    prompt_parts = [
        "Контекст вселенной для автора:\n",
        universe_context,
        "\n\n--- Уже написанный текст книги (продолжай в том же стиле) ---\n",
        context_before[:12000] if context_before else "(начало главы)",
        "\n\n--- Задание ---\n",
        f"Напиши сцену: «{scene_label}». Объём: примерно {words} слов. Не повторяй уже написанное.",
    ]
    if body.beat_description and body.beat_description.strip():
        prompt_parts.append(f"\nОписание сцены (что должно произойти):\n{body.beat_description.strip()}")
    if body.instructions and body.instructions.strip():
        prompt_parts.append(f"\nДополнительные указания автора:\n{body.instructions.strip()}")
    if body.additional_context and body.additional_context.strip():
        prompt_parts.append(f"\nДополнительный контекст:\n{body.additional_context.strip()}")
    prompt_parts.append("\nВерни только текст сцены, без заголовков и пояснений.")
    prompt = "".join(prompt_parts)
    try:
        system_settings = await get_system_settings(master_db)
        provider, model = load_llm_settings_from_system(system_settings)
        response = await llm_service.chat(
            messages=[
                ChatMessage(role="system", content=WRITE_MODE_SYSTEM),
                ChatMessage(role="user", content=prompt),
            ],
            provider=provider,
            model=model,
        )
        return {"text": (response or "").strip()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ошибка ИИ: {str(e)}")


@router.post("/generate-beat/stream")
async def generate_beat_stream(universe_id: int, body: GenerateBeatBody, db: AsyncSession = Depends(get_db), master_db: AsyncSession = Depends(get_master_db)):
    """Стриминг генерации текста для сценарного бита (SSE). События: data: {\"content\": \"chunk\"} или data: {\"error\": \"...\"}."""
    if not await knowledge.get_universe(universe_id, master_db):
        raise HTTPException(status_code=404, detail="Вселенная не найдена")
    ch = await knowledge.get_chapter(db, body.chapter_id)
    if not ch or ch.universe_id != universe_id:
        raise HTTPException(status_code=404, detail="Глава не найдена")
    words = body.words if body.words in (200, 400, 600) else 400
    before_sort: Optional[int] = None
    if body.beat_id:
        beat = await knowledge.get_beat(db, body.beat_id)
        if beat and beat.chapter_id == body.chapter_id:
            before_sort = beat.sort_order
    context_before = await _text_before_beat(db, universe_id, body.chapter_id, before_sort)
    universe_context = await context_manager.build_context(db, universe_id, master_db=master_db)
    scene_label = (body.beat_title or "Сцена").strip() or "Сцена"
    prompt_parts = [
        "Контекст вселенной для автора:\n",
        universe_context,
        "\n\n--- Уже написанный текст книги (продолжай в том же стиле) ---\n",
        context_before[:12000] if context_before else "(начало главы)",
        "\n\n--- Задание ---\n",
        f"Напиши сцену: «{scene_label}». Объём: примерно {words} слов. Не повторяй уже написанное.",
    ]
    if body.beat_description and body.beat_description.strip():
        prompt_parts.append(f"\nОписание сцены (что должно произойти):\n{body.beat_description.strip()}")
    if body.instructions and body.instructions.strip():
        prompt_parts.append(f"\nДополнительные указания автора:\n{body.instructions.strip()}")
    if body.additional_context and body.additional_context.strip():
        prompt_parts.append(f"\nДополнительный контекст:\n{body.additional_context.strip()}")
    prompt_parts.append("\nВерни только текст сцены, без заголовков и пояснений.")
    prompt = "".join(prompt_parts)
    messages = [
        ChatMessage(role="system", content=WRITE_MODE_SYSTEM),
        ChatMessage(role="user", content=prompt),
    ]

    async def stream():
        try:
            system_settings = await get_system_settings(master_db)
            provider, model = load_llm_settings_from_system(system_settings)
            async for chunk in llm_service.chat_stream(
                messages=messages,
                provider=provider,
                model=model,
            ):
                if chunk:
                    yield f"data: {json.dumps({'content': chunk}, ensure_ascii=False)}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)}, ensure_ascii=False)}\n\n"

    return StreamingResponse(
        stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
            "Transfer-Encoding": "chunked",
        },
    )


@router.post("/generate-beat-description")
async def generate_beat_description(
    universe_id: int,
    body: GenerateBeatDescriptionBody,
    db: AsyncSession = Depends(get_db),
    master_db: AsyncSession = Depends(get_master_db),
):
    """Сгенерировать описание сцены по контексту книги и незаполненным пробелам (биты без описания/текста)."""
    if not await knowledge.get_universe(universe_id, master_db):
        raise HTTPException(status_code=404, detail="Вселенная не найдена")
    ch = await knowledge.get_chapter(db, body.chapter_id)
    if not ch or ch.universe_id != universe_id:
        raise HTTPException(status_code=404, detail="Глава не найдена")
    before_sort: Optional[int] = None
    if body.beat_id:
        beat = await knowledge.get_beat(db, body.beat_id)
        if beat and beat.chapter_id == body.chapter_id:
            before_sort = beat.sort_order
    context_before = await _text_before_beat(db, universe_id, body.chapter_id, before_sort)
    universe_context = await context_manager.build_context(db, universe_id, master_db=master_db)
    beats = await knowledge.get_beats(db, body.chapter_id)
    gaps = []
    for b in beats:
        desc = (getattr(b, "description", None) or "").strip()
        cnt = (b.content or "").strip()
        if not desc or not cnt:
            gaps.append(f"- Сцена {b.sort_order + 1} (id={b.id}): описание={bool(desc)}, текст={bool(cnt)}")
    scene_label = (body.beat_title or "Сцена").strip() or "Сцена"
    prompt = f"""Контекст вселенной и книги:

{universe_context}

--- Уже написанный текст до этой сцены ---
{context_before[:8000] if context_before else "(начало главы)"}

--- Глава: {ch.chapter_number}. {ch.title} ---
{(f"Краткое содержание главы: {ch.summary}" if (ch.summary or "").strip() else "")}

--- Незаполненные пробелы в главе (сцены без описания или без текста) ---
{chr(10).join(gaps) if gaps else "Все сцены заполнены."}

Задание: предложи краткое описание сцены («{scene_label}») в 1–3 предложениях: что происходит в этой сцене, кто участвует, какой поворот. Описание будет использоваться как неизменный план для последующей генерации текста. Пиши на русском. Верни только текст описания, без заголовков."""
    try:
        system_settings = await get_system_settings(master_db)
        provider, model = load_llm_settings_from_system(system_settings)
        response = await llm_service.chat(
            messages=[ChatMessage(role="user", content=prompt)],
            provider=provider,
            model=model,
        )
        return {"description": (response or "").strip()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ошибка ИИ: {str(e)}")
