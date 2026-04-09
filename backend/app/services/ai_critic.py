import asyncio
import json
import re
from typing import List, Dict, Optional, AsyncGenerator
from app.config import settings
from app.services.llm import llm_service
from app.schemas import ChatMessage
from app.services.rag import rag_service

class AICriticService:
    """Сервис для AI анализа и предложений по элементам вселенной"""
    
    def analyze_character(
        self,
        character_data: Dict,
        book_context: str,
        all_characters: List[Dict],
        stream: bool = False,
        provider: Optional[str] = None,
        model: Optional[str] = None,
    ):
        """Анализ персонажа: поиск противоречий, глубины, мотивации"""
        
        # Промпт с жёстким требованием: только JSON, без заголовков и пояснений
        prompt = f"""Ты — литературный редактор. Проанализируй персонажа кратко и по делу.

КНИГА: {book_context[:200] if len(book_context) > 200 else book_context}

ПЕРСОНАЖ: {character_data.get('name', 'Unknown')} ({character_data.get('role', 'Unknown')})
Описание: {character_data.get('description', '')[:150] or 'Нет'}
Черты: {character_data.get('traits', '')[:100] or 'Нет'}

ЗАДАНИЕ: Оцени по критериям (противоречия, глубина, мотивация, арка, связи, уникальность). Максимум 3-5 проблем, 2-3 предложения, 2-3 вопроса.

КРИТИЧЕСКИ ВАЖНО: Верни ТОЛЬКО один валидный JSON-объект. Без заголовков («AI Анализ», «Оценка», «ПРЕДЛОЖЕНИЯ», «Ручной анализ»), без текста до или после, без markdown-блока (```json). Начни ответ сразу с {{ и закончи }}.

Структура (строго соблюдай ключи):
{{
  "score": 0-10,
  "issues": [{{"type": "contradiction|depth|motivation|arc|connections|uniqueness", "severity": "low|medium|high", "description": "краткое описание"}}],
  "suggestions": [{{"title": "заголовок", "description": "краткое предложение"}}],
  "strengths": ["кратко"],
  "questions": ["кратко"]
}}"""
        
        if stream:
            _provider = provider or settings.default_llm_provider
            _model = model or settings.get_default_model(_provider)
            # Возвращаем async generator напрямую
            async def _stream_analysis():
                try:
                    print(f"[AI Critic] Начинаю стриминг анализа персонажа: {character_data.get('name', 'Unknown')}")
                    print(f"[AI Critic] Провайдер: {_provider}, модель: {_model}")
                    print(f"[AI Critic] Длина промпта: {len(prompt)} символов")
                    
                    full_response = ""
                    chunk_count = 0
                    first_chunk_received = False
                    start_time = asyncio.get_event_loop().time()
                    
                    # Начинаем стриминг от LLM
                    stream_gen = llm_service.chat_stream(
                        messages=[ChatMessage(role="user", content=prompt)],
                        provider=_provider,
                        model=_model
                    )
                    
                    # Таймаут для первого чанка - если не получили за 30 секунд, выбрасываем ошибку
                    timeout_task = None
                    try:
                        async for chunk in stream_gen:
                            if not first_chunk_received:
                                first_chunk_received = True
                                elapsed = asyncio.get_event_loop().time() - start_time
                                print(f"[AI Critic] Первый чанк получен через {elapsed:.2f} секунд")
                            
                            chunk_count += 1
                            if chunk:
                                full_response += chunk
                                yield chunk
                                # Логируем каждые 10 чанков
                                if chunk_count % 10 == 0:
                                    print(f"[AI Critic] Получено {chunk_count} чанков, длина ответа: {len(full_response)} символов")
                        
                        if chunk_count == 0:
                            elapsed = asyncio.get_event_loop().time() - start_time
                            raise Exception(f"LLM сервис не вернул ни одного чанка за {elapsed:.1f} секунд. Проверьте, что {_provider} запущен и доступен.")
                        
                        print(f"[AI Critic] Стриминг завершен. Всего чанков: {chunk_count}, длина ответа: {len(full_response)} символов")
                        
                        # После завершения стриминга парсим полный ответ
                        parsed = self._parse_json_response(full_response)
                        print(f"[AI Critic] Результат парсинга: score={parsed.get('score', 0)}, issues={len(parsed.get('issues', []))}")
                        yield f"\n\n<ANALYSIS_COMPLETE>{json.dumps(parsed, ensure_ascii=False)}</ANALYSIS_COMPLETE>"
                    except asyncio.TimeoutError:
                        elapsed = asyncio.get_event_loop().time() - start_time
                        raise Exception(f"Таймаут ожидания ответа от LLM ({elapsed:.1f}с). Проверьте доступность {_provider}.")
                except Exception as e:
                    import traceback
                    error_msg = f"Ошибка в _stream_analysis: {str(e)}\n{traceback.format_exc()}"
                    print(f"[AI Critic] {error_msg}")
                    error_result = {
                        "error": str(e),
                        "score": 0,
                        "issues": [],
                        "suggestions": [],
                        "strengths": [],
                        "questions": []
                    }
                    yield json.dumps(error_result, ensure_ascii=False)
            
            return _stream_analysis()

        # Не стриминг режим - возвращаем корутину
        _provider = provider or settings.default_llm_provider
        _model = model or settings.get_default_model(_provider)
        async def _non_stream_analysis():
            try:
                response = await llm_service.chat(
                    messages=[ChatMessage(role="user", content=prompt)],
                    provider=_provider,
                    model=_model
                )
                return self._parse_json_response(response)
            except Exception as e:
                return {
                    "error": str(e),
                    "score": 0,
                    "issues": [],
                    "suggestions": [],
                    "strengths": [],
                    "questions": []
                }
        
        return _non_stream_analysis()
    
    async def analyze_location(
        self,
        location_data: Dict,
        book_context: str,
        all_locations: List[Dict],
        provider: Optional[str] = None,
        model: Optional[str] = None,
    ) -> Dict:
        """Анализ локации: детализация, связность, атмосфера"""
        
        prompt = f"""Ты — опытный литературный редактор и критик. Проанализируй локацию и дай развёрнутую критику.

## КОНТЕКСТ КНИГИ
{book_context}

## ДРУГИЕ ЛОКАЦИИ
{self._format_locations_list(all_locations)}

## АНАЛИЗИРУЕМАЯ ЛОКАЦИЯ
Название: {location_data.get('name', 'Unknown')}
Тип: {location_data.get('location_type', 'Unknown')}
Описание: {location_data.get('description', 'No description')}
Детали: {location_data.get('details', 'Not specified')}

## ЗАДАНИЕ
Проанализируй локацию по следующим критериям:

1. **ДЕТАЛИЗАЦИЯ** — достаточно ли подробно описано место?
2. **АТМОСФЕРА** — передаёт ли описание нужное настроение?
3. **СВЯЗНОСТЬ** — как локация связана с сюжетом и персонажами?
4. **УНИКАЛЬНОСТЬ** — чем это место отличается от других?
5. **ЧУВСТВА** — задействованы ли органы чувств (зрение, звук, запах)?
6. **ФУНКЦИЯ** — какую роль локация играет в истории?

## ФОРМАТ ОТВЕТА
Верни ответ в формате JSON:
{{
  "score": 0-10,
  "issues": [
    {{"type": "detail|atmosphere|coherence|uniqueness|senses|function", "severity": "low|medium|high", "description": "описание проблемы"}}
  ],
  "suggestions": [
    {{"title": "заголовок", "description": "подробное предложение"}}
  ],
  "strengths": ["сильные стороны локации"],
  "questions": ["вопросы, которые стоит задать себе о локации"]
}}

Будь конструктивен, но критичен."""

        _provider = provider or settings.default_llm_provider
        _model = model or settings.get_default_model(_provider)
        try:
            response = await llm_service.chat(
                messages=[ChatMessage(role="user", content=prompt)],
                provider=_provider,
                model=_model
            )
            return self._parse_json_response(response)
        except Exception as e:
            return {
                "error": str(e),
                "score": 0,
                "issues": [],
                "suggestions": [],
                "strengths": [],
                "questions": []
            }
    
    async def analyze_chapter(
        self,
        chapter_data: Dict,
        book_context: str,
        all_chapters: List[Dict],
        provider: Optional[str] = None,
        model: Optional[str] = None,
    ) -> Dict:
        """Анализ главы: сюжет, темп, логика, диалоги"""
        
        prompt = f"""Ты — опытный литературный редактор и критик. Проанализируй главу и дай развёрнутую критику.

## КОНТЕКСТ КНИГИ
{book_context}

## СТРУКТУРА КНИГИ
{self._format_chapters_list(all_chapters)}

## АНАЛИЗИРУЕМАЯ ГЛАВА
Глава {chapter_data.get('chapter_number', '?')}: {chapter_data.get('title', 'Untitled')}
Краткое содержание: {chapter_data.get('summary', 'No summary')}
Содержание: {chapter_data.get('content', 'No content')[:3000]}
Заметки: {chapter_data.get('notes', 'Not specified')}

## ЗАДАНИЕ
Проанализируй главу по следующим критериям:

1. **СЮЖЕТ** — есть ли чёткая структура (начало, середина, конец)?
2. **ТЕМП** — не слишком ли быстро/медленно развивается действие?
3. **ЛОГИКА** — нет ли логических несостыковок?
4. **ДИАЛОГИ** — естественны ли они? Несут ли функцию?
5. **ПОКАЗЫВАЙ, НЕ РАССКАЗЫВАЙ** — используется ли этот принцип?
6. **КЛИФФХЭНГЕР** — есть ли крючок для следующей главы?
7. **РАЗВИТИЕ** — что изменилось к концу главы?

## ФОРМАТ ОТВЕТА
Верни ответ в формате JSON:
{{
  "score": 0-10,
  "issues": [
    {{"type": "plot|pace|logic|dialogue|showing|cliffhanger|development", "severity": "low|medium|high", "description": "описание проблемы"}}
  ],
  "suggestions": [
    {{"title": "заголовок", "description": "подробное предложение"}}
  ],
  "strengths": ["сильные стороны главы"],
  "questions": ["вопросы, которые стоит задать себе о главе"]
}}

Будь конструктивен, но критичен."""

        _provider = provider or settings.default_llm_provider
        _model = model or settings.get_default_model(_provider)
        try:
            response = await llm_service.chat(
                messages=[ChatMessage(role="user", content=prompt)],
                provider=_provider,
                model=_model
            )
            return self._parse_json_response(response)
        except Exception as e:
            return {
                "error": str(e),
                "score": 0,
                "issues": [],
                "suggestions": [],
                "strengths": [],
                "questions": []
            }

    async def analyze_act(
        self,
        act_title: str,
        chapters_data: List[Dict],
        book_context: str,
        all_chapters: List[Dict],
        provider: Optional[str] = None,
        model: Optional[str] = None,
    ) -> Dict:
        """Анализ акта: структура, темп, связность глав"""
        chapters_text = "\n\n---\n\n".join([
            f"Глава {c.get('chapter_number', '?')}: {c.get('title', '')}\nКраткое содержание: {c.get('summary', '')}\nТекст (фрагмент): {(c.get('content') or '')[:2500]}"
            for c in chapters_data
        ])
        prompt = f"""Ты — опытный литературный редактор. Проанализируй акт как целостный блок.

## КОНТЕКСТ КНИГИ
{book_context}

## СТРУКТУРА КНИГИ
{self._format_chapters_list(all_chapters)}

## АНАЛИЗИРУЕМЫЙ АКТ
Название акта: {act_title}
Число глав в акте: {len(chapters_data)}

## ГЛАВЫ АКТА
{chapters_text[:12000]}

## ЗАДАНИЕ
Оцени акт по критериям:
1. **СТРУКТУРА** — есть ли ясное начало, развитие, кульминация акта?
2. **ТЕМП** — баланс между главами, нет ли затянутости или сжатости?
3. **СВЯЗНОСТЬ** — логичны ли переходы между главами?
4. **РАЗВИТИЕ** — что меняется к концу акта по сравнению с началом?
5. **КРЮЧОК** — готов ли читатель к следующему акту?

## ФОРМАТ ОТВЕТА
Верни JSON:
{{
  "score": 0-10,
  "issues": [
    {{"type": "structure|pace|coherence|development|hook", "severity": "low|medium|high", "description": "описание"}}
  ],
  "suggestions": [{{"title": "заголовок", "description": "подробно"}}],
  "strengths": ["сильные стороны акта"],
  "questions": ["вопросы для размышления"]
}}

Будь конструктивен."""

        _provider = provider or settings.default_llm_provider
        _model = model or settings.get_default_model(_provider)
        try:
            response = await llm_service.chat(
                messages=[ChatMessage(role="user", content=prompt)],
                provider=_provider,
                model=_model
            )
            return self._parse_json_response(response)
        except Exception as e:
            return {
                "error": str(e),
                "score": 0,
                "issues": [],
                "suggestions": [],
                "strengths": [],
                "questions": []
            }

    async def analyze_beat(
        self,
        beat_data: Dict,
        chapter_context: str,
        book_context: str,
        provider: Optional[str] = None,
        model: Optional[str] = None,
    ) -> Dict:
        """Анализ сцены (scene beat): фокус, диалог, действие"""
        prompt = f"""Ты — опытный литературный редактор. Проанализируй сцену (блок текста внутри главы).

## КОНТЕКСТ КНИГИ
{book_context}

## ГЛАВА (контекст сцены)
{chapter_context}

## СЦЕНА
Название: {beat_data.get('title', 'Без названия')}
Описание: {beat_data.get('description', '')}
Текст сцены:
{(beat_data.get('content') or 'Нет текста')[:4000]}

## ЗАДАНИЕ
Оцени сцену по критериям:
1. **ФОКУС** — одна ли ясная сцена/конфликт/момент?
2. **ДИАЛОГ/ДЕЙСТВИЕ** — баланс, естественность реплик.
3. **ПОКАЗ** — показано ли через действие, а не рассказано?
4. **ЭМОЦИИ** — переданы ли переживания персонажей?
5. **ДЛИНА** — уместна ли для данной сцены?

## ФОРМАТ ОТВЕТА
Верни JSON:
{{
  "score": 0-10,
  "issues": [
    {{"type": "focus|dialogue|showing|emotion|length", "severity": "low|medium|high", "description": "описание"}}
  ],
  "suggestions": [{{"title": "заголовок", "description": "подробно"}}],
  "strengths": ["сильные стороны сцены"],
  "questions": ["вопросы для доработки"]
}}

Будь кратким и конкретным."""

        _provider = provider or settings.default_llm_provider
        _model = model or settings.get_default_model(_provider)
        try:
            response = await llm_service.chat(
                messages=[ChatMessage(role="user", content=prompt)],
                provider=_provider,
                model=_model
            )
            return self._parse_json_response(response)
        except Exception as e:
            return {
                "error": str(e),
                "score": 0,
                "issues": [],
                "suggestions": [],
                "strengths": [],
                "questions": []
            }

    async def analyze_note(
        self,
        note_data: Dict,
        book_context: str,
        provider: Optional[str] = None,
        model: Optional[str] = None,
    ) -> Dict:
        """Анализ заметки: развитие идей, полезность"""
        
        prompt = f"""Ты — опытный литературный редактор. Проанализируй заметку и оцени её полезность для вселенной.

## КОНТЕКСТ КНИГИ
{book_context}

## ЗАМЕТКА
Название: {note_data.get('title', 'Untitled')}
Тип: {note_data.get('note_type', 'idea')}
Содержание: {note_data.get('content', 'No content')}

## ЗАДАНИЕ
Оцени заметку по критериям:

1. **ЯСНОСТЬ** — понятна ли идея?
2. **ПОЛЕЗНОСТЬ** — как это поможет вселенной?
3. **РАЗВИТИЕ** — что можно добавить к этой идее?
4. **СВЯЗИ** — с чем это можно связать в вселенной?

## ФОРМАТ ОТВЕТА
Верни ответ в формате JSON:
{{
  "score": 0-10,
  "issues": [
    {{"type": "clarity|usefulness|development|connections|other", "severity": "low|medium|high", "description": "конкретное описание проблемы — обязательно заполни, не оставляй пустым"}}
  ],
  "suggestions": [
    {{"title": "заголовок", "description": "подробное предложение"}}
  ],
  "strengths": ["сильные стороны заметки"],
  "related_ideas": ["с чем можно связать эту заметку"]
}}

Важно: у каждой проблемы в issues обязательно укажи поле "description" с ясным текстом (что именно не так). severity: low = мелочь, medium = средне, high = критично. Будь конструктивен."""

        _provider = provider or settings.default_llm_provider
        _model = model or settings.get_default_model(_provider)
        try:
            response = await llm_service.chat(
                messages=[ChatMessage(role="user", content=prompt)],
                provider=_provider,
                model=_model
            )
            return self._parse_json_response(response)
        except Exception as e:
            return {
                "error": str(e),
                "score": 0,
                "issues": [],
                "suggestions": [],
                "strengths": [],
                "related_ideas": []
            }
    
    async def analyze_book_consistency(
        self,
        book_data: Dict,
        all_characters: List[Dict],
        all_locations: List[Dict],
        all_chapters: List[Dict],
        provider: Optional[str] = None,
        model: Optional[str] = None,
    ) -> Dict:
        """Анализ согласованности всей вселенной"""
        
        prompt = f"""Ты — опытный литературный редактор. Найди противоречия и несостыковки в вселенной.

## КНИГА
Название: {book_data.get('title', 'Unknown')}
Жанр: {book_data.get('genre', 'Unknown')}
Описание: {book_data.get('description', 'No description')}

## ПЕРСОНАЖИ
{self._format_characters_list(all_characters)}

## ЛОКАЦИИ
{self._format_locations_list(all_locations)}

## ГЛАВЫ
{self._format_chapters_list(all_chapters)}

## ЗАДАНИЕ
Найди:
1. **ПРОТИВОРЕЧИЯ** — персонажи, локации, события, которые противоречат друг другу
2. **НЕИСПОЛЬЗОВАННЫЕ ЭЛЕМЕНТЫ** — персонажи/локации, которые не появляются в главах
3. **ПРОБЕЛЫ** — чего не хватает для целостности истории
4. **ХРОНОЛОГИЯ** — есть ли проблемы с последовательностью событий

## ФОРМАТ ОТВЕТА
Верни ответ в формате JSON:
{{
  "contradictions": [
    {{"type": "character|location|plot|timeline", "description": "описание противоречия", "severity": "low|medium|high"}}
  ],
  "unused_elements": [
    {{"element": "тип: название", "suggestion": "как использовать"}}
  ],
  "gaps": ["чего не хватает"],
  "timeline_issues": ["проблемы с хронологией"]
}}

Будь внимателен к деталям."""

        _provider = provider or settings.default_llm_provider
        _model = model or settings.get_default_model(_provider)
        try:
            response = await llm_service.chat(
                messages=[ChatMessage(role="user", content=prompt)],
                provider=_provider,
                model=_model
            )
            return self._parse_json_response(response)
        except Exception as e:
            return {
                "error": str(e),
                "contradictions": [],
                "unused_elements": [],
                "gaps": [],
                "timeline_issues": []
            }
    
    def _format_characters_list(self, characters: List[Dict]) -> str:
        if not characters:
            return "Нет других персонажей"
        return "\n".join([f"- {c.get('name', 'Unknown')}: {c.get('role', '')} — {c.get('traits', '')[:50]}" for c in characters])
    
    def _format_locations_list(self, locations: List[Dict]) -> str:
        if not locations:
            return "Нет других локаций"
        return "\n".join([f"- {l.get('name', 'Unknown')} ({l.get('location_type', '')}): {l.get('description', '')[:50]}" for l in locations])
    
    def _format_chapters_list(self, chapters: List[Dict]) -> str:
        if not chapters:
            return "Нет других глав"
        return "\n".join([f"- Глава {c.get('chapter_number', '?')}: {c.get('title', '')} — {c.get('summary', '')[:50]}" for c in chapters])
    
    def _parse_json_response(self, response: str) -> Dict:
        """Извлечь и распарсить JSON из ответа ИИ (текст + markdown или только JSON)."""
        if not (response or "").strip():
            return self._default_analysis_result()

        text = response.strip()

        # 1) Извлечь содержимое из ```json ... ``` или ``` ... ```
        for pattern in (r"```json\s*([\s\S]*?)\s*```", r"```\s*([\s\S]*?)\s*```"):
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                try:
                    obj = json.loads(match.group(1).strip())
                    return self._normalize_analysis_result(obj)
                except json.JSONDecodeError:
                    pass

        # 2) Найти первый { и подобрать закрывающую } по скобкам (игнорируя { } внутри строк)
        start = text.find("{")
        if start >= 0:
            depth = 0
            in_string = False
            i = start
            while i < len(text):
                c = text[i]
                if in_string:
                    if c == "\\" and i + 1 < len(text):
                        i += 2
                        continue
                    if c == '"':
                        in_string = False
                    i += 1
                    continue
                if c == '"':
                    in_string = True
                    i += 1
                    continue
                if c == "{":
                    depth += 1
                elif c == "}":
                    depth -= 1
                    if depth == 0:
                        try:
                            obj = json.loads(text[start : i + 1])
                            return self._normalize_analysis_result(obj)
                        except json.JSONDecodeError:
                            pass
                        break
                i += 1

        # 3) Жадная попытка: первый { до последнего }
        json_match = re.search(r"\{[\s\S]*\}", text)
        if json_match:
            try:
                return self._normalize_analysis_result(json.loads(json_match.group()))
            except json.JSONDecodeError:
                pass

        return self._default_analysis_result(raw=text)

    def _normalize_analysis_result(self, obj: Dict) -> Dict:
        """Привести распарсенный объект к единой структуре анализа."""
        return {
            "score": int(obj.get("score", 5)) if isinstance(obj.get("score"), (int, float)) else 5,
            "issues": list(obj.get("issues", [])) if isinstance(obj.get("issues"), list) else [],
            "suggestions": list(obj.get("suggestions", [])) if isinstance(obj.get("suggestions"), list) else [],
            "strengths": list(obj.get("strengths", [])) if isinstance(obj.get("strengths"), list) else [],
            "questions": list(obj.get("questions", [])) if isinstance(obj.get("questions"), list) else [],
        }

    def _default_analysis_result(self, raw: Optional[str] = None) -> Dict:
        """Результат по умолчанию при неудачном парсинге."""
        result = {
            "score": 5,
            "issues": [],
            "suggestions": [],
            "strengths": [],
            "questions": [],
        }
        if raw:
            result["raw_response"] = raw[:2000]
            result["suggestions"] = [{"title": "Не удалось распарсить ответ ИИ", "description": raw[:500]}]
        return result

# Глобальный экземпляр
ai_critic_service = AICriticService()
