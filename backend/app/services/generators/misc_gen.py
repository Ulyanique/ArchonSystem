import random
from typing import List, Dict
from app.config import settings
from app.services.llm import llm_service
from app.schemas import ChatMessage
from app.services.generators.base_gen import BaseGenerator

class MiscGenerator(BaseGenerator):
    async def generate_note_ideas(
        self,
        genre: str = "фэнтези",
        direction: str = "",
        count: int = 5,
        book_context: str = "",
    ) -> List[Dict]:
        """Сгенерировать идеи заметок на основе контекста всей книги: идеи, технологии, события и прочее."""
        valid_note_types = ("idea", "research", "avoid", "other", "technology", "event")

        context_block = ""
        if book_context.strip():
            context_block = f"""
КОНТЕКСТ ВСЕЛЕННОЙ (используй для релевантных предложений):
{book_context[:4000]}

"""
        prompt = f"""Сгенерируй {count} разнообразных заметок для этой вселенной. Жанр: {genre}.
{context_block}
Нужны предложения разных типов:
- idea — идеи сюжета, мира, конфликтов, развития персонажей;
- technology — технологии, изобретения, магия/наука вселенной (если уместны жанру);
- event — идеи событий для таймлайна (что могло/должно произойти);
- research — что изучить для достоверности;
- avoid — чего избегать в тексте;
- other — прочие полезные заметки.

Предлагай то, чего не хватает по контексту, и что обогатит вселенную. Пиши кратко и по делу.

Типы заметок: idea, research, avoid, other, technology, event.
Формат ответа — только JSON-массив:
[
  {{"title": "Заголовок", "content": "Текст заметки.", "note_type": "idea"}},
  ...
]"""
        try:
            response = await llm_service.chat(
                messages=[ChatMessage(role="user", content=prompt)],
                provider=settings.default_llm_provider,
                model=settings.get_default_model(settings.default_llm_provider)
            )
            items = self._parse_json_array(response)
            if not items:
                return self._generate_fallback_notes(count)
            out = []
            for item in items[:count]:
                raw_type = item.get("note_type", "idea")
                note_type = raw_type if raw_type in valid_note_types else "idea"
                out.append({
                    "title": item.get("title", "Заметка"),
                    "content": item.get("content", ""),
                    "note_type": note_type,
                })
            return out
        except Exception:
            return self._generate_fallback_notes(count)

    def _generate_fallback_notes(self, count: int) -> List[Dict]:
        templates = [
            ("Идея сюжета", "Развить линию предательства со стороны близкого союзника.", "idea"),
            ("Технология/магия", "Описать ограничения и стоимость использования ключевой технологии мира.", "technology"),
            ("Событие для таймлайна", "Добавить событие: первая встреча ключевых персонажей.", "event"),
            ("Чего избегать", "Избегать типичной магии кристаллов и предсказуемых пророчеств.", "avoid"),
            ("Исследование", "Изучить быт и оружие эпохи для достоверности.", "research"),
            ("Заметка", "Добавить контраст между двумя локациями в середине вселенной.", "other"),
        ]
        return [
            {"title": t[0], "content": t[1], "note_type": t[2]}
            for t in (templates * ((count // len(templates)) + 1))[:count]
        ]

    async def generate_name(
        self,
        genre: str = "фэнтези",
        character_type: str = "герой"
    ) -> str:
        prompt = f"""Придумай имя для персонажа в жанре {genre}.
Тип персонажа: {character_type}.
Напиши только одно имя, без пояснений."""
        try:
            response = await llm_service.chat(
                messages=[ChatMessage(role="user", content=prompt)],
                provider=settings.default_llm_provider,
                model=settings.get_default_model(settings.default_llm_provider)
            )
            return response.strip().split()[0] if response else "Александр"
        except Exception:
            names = ["Александр", "Елена", "Виктор", "Наталья", "Дмитрий"]
            return random.choice(names)

    async def generate_description(
        self,
        subject: str,
        context: str = "",
        length: str = "medium"
    ) -> str:
        length_map = {
            "short": "1-2 предложения",
            "medium": "3-4 предложения",
            "long": "5-7 предложений"
        }
        prompt = f"""Опиши: {subject}
{f"Контекст: {context}" if context else ""}
Длина: {length_map.get(length, 'medium')}
Сделай описание ярким и атмосферным."""
        try:
            response = await llm_service.chat(
                messages=[ChatMessage(role="user", content=prompt)],
                provider=settings.default_llm_provider,
                model=settings.get_default_model(settings.default_llm_provider)
            )
            return response
        except Exception:
            return f"Яркое и запоминающееся описание {subject}."

    async def generate_wiki_article_content(
        self,
        entity_type: str,
        entity_data: dict,
        book_title: str = "",
    ) -> str:
        title = entity_data.get("title") or entity_data.get("name") or "Без названия"
        prompt = f"""Напиши статью для вики вселенной (вселенной).
Контекст: {book_title or 'вселенная'}.
Тип сущности: {entity_type}.
Требования: Весь текст на русском. Формат Markdown. Разделы (##).
Ответ только текстом статьи."""
        try:
            response = await llm_service.chat(
                messages=[ChatMessage(role="user", content=prompt)],
                provider=settings.default_llm_provider,
                model=settings.get_default_model(settings.default_llm_provider),
            )
            return response or f"Статья о: {title}"
        except Exception:
            return f"## Описание\n\nМатериал о: {title}."

    async def autofill_note(self, context: str, current: Dict) -> Dict:
        prompt = f"""Контекст вселенной: {context}
Текущие данные заметки: {current}
Предложи значение только для пустого поля content. Ответ — только JSON: {{"content": "..."}}"""
        try:
            response = await llm_service.chat(
                messages=[ChatMessage(role="user", content=prompt)],
                provider=settings.default_llm_provider,
                model=settings.get_default_model(settings.default_llm_provider)
            )
            return self._parse_json_object(response)
        except Exception:
            return {}

    async def generate_timeline_events(
        self,
        context: str,
        existing_events: List[Dict],
        characters: List[Dict],
        locations: List[Dict],
        count: int = 5,
        current_year: int = 2026,
        current_day: int = 1,
        epoch: str = "н.э."
    ) -> List[Dict]:
        """Сгенерировать идеи событий для таймлайна"""
        existing_summary = ""
        if existing_events:
            existing_summary = "\nСуществующие события (для контекста и последовательности):\n" + "\n".join([
                f"- {e.get('title', 'Без названия')} (Год {e.get('universe_year', '?')}, День {e.get('universe_day', '?')}): {e.get('description', '')[:150]}" + 
                (f" [Участники: {', '.join(e.get('characters', [])[:3])}]" if e.get('characters') else "")
                for e in existing_events[:10]
            ])
        
        chars_summary = ""
        if characters:
            chars_summary = "\nКлючевые персонажи (ОБЯЗАТЕЛЬНО используй их имена в событиях!):\n" + "\n".join([
                f"- {c.get('name', 'Без имени')} ({c.get('role', '')})" + 
                (f": {c.get('description', '')[:100]}" if c.get('description') else "") +
                (f" [Черты: {c.get('traits', '')[:80]}]" if c.get('traits') else "")
                for c in characters[:15]
            ])
        
        locs_summary = ""
        if locations:
            locs_summary = "\nЛокации (ОБЯЗАТЕЛЬНО используй их названия в событиях!):\n" + "\n".join([
                f"- {l.get('name', 'Без названия')}" + 
                (f": {l.get('description', '')[:100]}" if l.get('description') else "")
                for l in locations[:10]
            ])
        
        # Выбираем случайных персонажей и локации для примеров
        example_chars = ", ".join([c.get('name', '') for c in characters[:3]]) if characters else "персонажи"
        example_locs = ", ".join([l.get('name', '') for l in locations[:2]]) if locations else "локации"
        
        prompt = f"""Сгенерируй {count} конкретных событий для таймлайна вселенной.

ВАЖНО: Текущее время во вселенной: {current_year} год {epoch}, День {current_day}.

Контекст вселенной:
{context}
{existing_summary}
{chars_summary}
{locs_summary}

КРИТИЧНО: События должны быть КОНКРЕТНЫМИ и использовать реальные имена персонажей и локаций из контекста!
НЕ используй общие фразы типа "Герои отправляются в путешествие" или "Персонажи обнаруживают информацию".
Вместо этого используй конкретику: "{example_chars} отправляются в {example_locs}" или "{example_chars[0] if example_chars else 'Персонаж'} обнаруживает артефакт в {example_locs[0] if example_locs else 'локации'}".

Для каждого события укажи:
1. title - конкретное название события с именами персонажей или локаций (например: "Встреча {example_chars.split(',')[0] if example_chars else 'Харпер'} и {example_chars.split(',')[1] if len(example_chars.split(',')) > 1 else 'союзника'} в {example_locs.split(',')[0] if example_locs else 'крепости'}")
2. description - конкретное описание события (2-3 предложения) с упоминанием конкретных персонажей, локаций и деталей из контекста вселенной. Опиши ЧТО именно происходит, КТО участвует, ГДЕ это происходит.
3. event_type - тип события (general, battle, meeting, journey, death, birth, discovery, conflict, romance, act, chapter, other)
4. date_value - дата/время в формате вселенной (например: "{current_year} год, День {current_day}" или "Глава 3")
5. universe_year - год во вселенной (ЧИСЛО, например {current_year} или близкое к нему, НЕ маленькие числа вроде 12 или 84)
6. universe_day - день во вселенной (число от 1 до 365, или null)

КРИТИЧНО: universe_year должен быть близок к текущему году вселенной ({current_year}) или в разумных пределах от него (например, от {max(1, current_year - 100)} до {current_year + 100}). 
НЕ используй маленькие числа типа 12, 84, 1 - это будет интерпретироваться как события тысячи лет назад!
События могут быть в прошлом (меньше {current_year}), настоящем (около {current_year}) или будущем (больше {current_year}).

События должны быть логически связаны с контекстом вселенной, использовать конкретных персонажей и локации, и развивать существующие сюжетные линии.
Разнообразь типы событий.

Формат ответа — только JSON-массив:
[
  {{
    "title": "Конкретное название с именами персонажей/локаций",
    "description": "Конкретное описание события с деталями из контекста вселенной.",
    "event_type": "general",
    "date_value": "{current_year} год, День 50",
    "universe_year": {current_year},
    "universe_day": 50
  }},
  ...
]"""
        try:
            response = await llm_service.chat(
                messages=[ChatMessage(role="user", content=prompt)],
                provider=settings.default_llm_provider,
                model=settings.get_default_model(settings.default_llm_provider)
            )
            items = self._parse_json_array(response)
            if not items:
                return self._generate_fallback_events(count)
            
            out = []
            for item in items[:count]:
                out.append({
                    "title": item.get("title", "Событие"),
                    "description": item.get("description", ""),
                    "event_type": item.get("event_type", "general") if item.get("event_type") in (
                        "general", "battle", "meeting", "journey", "death", "birth", 
                        "discovery", "conflict", "romance", "act", "chapter", "other"
                    ) else "general",
                    "date_value": item.get("date_value"),
                    "universe_year": item.get("universe_year"),
                    "universe_day": item.get("universe_day"),
                })
            return out
        except Exception:
            return self._generate_fallback_events(count, current_year, current_day)

    async def generate_single_timeline_event(
        self,
        context: str,
        existing_events: List[Dict],
        characters: List[Dict],
        locations: List[Dict],
        current_year: int = 2026,
        current_day: int = 1,
        epoch: str = "н.э."
    ) -> Dict:
        """Сгенерировать одно событие для таймлайна, максимально подходящее под контекст вселенной"""
        existing_summary = ""
        if existing_events:
            existing_summary = "\nСуществующие события (для контекста и последовательности):\n" + "\n".join([
                f"- {e.get('title', 'Без названия')} (Год {e.get('universe_year', '?')}, День {e.get('universe_day', '?')}): {e.get('description', '')[:150]}" + 
                (f" [Участники: {', '.join(e.get('characters', [])[:3])}]" if e.get('characters') else "")
                for e in existing_events[:10]
            ])
        
        chars_summary = ""
        if characters:
            chars_summary = "\nКлючевые персонажи (ОБЯЗАТЕЛЬНО используй их имена в событии!):\n" + "\n".join([
                f"- {c.get('name', 'Без имени')} ({c.get('role', '')})" + 
                (f": {c.get('description', '')[:100]}" if c.get('description') else "") +
                (f" [Черты: {c.get('traits', '')[:80]}]" if c.get('traits') else "")
                for c in characters[:15]
            ])
        
        locs_summary = ""
        if locations:
            locs_summary = "\nЛокации (ОБЯЗАТЕЛЬНО используй их названия в событии!):\n" + "\n".join([
                f"- {l.get('name', 'Без названия')}" + 
                (f": {l.get('description', '')[:100]}" if l.get('description') else "")
                for l in locations[:10]
            ])
        
        # Выбираем случайных персонажей и локации для примеров
        example_chars = ", ".join([c.get('name', '') for c in characters[:3]]) if characters else "персонажи"
        example_locs = ", ".join([l.get('name', '') for l in locations[:2]]) if locations else "локации"
        
        # Анализируем пробелы в типах событий
        existing_types = set(e.get('event_type', '') for e in existing_events)
        common_types = ["general", "battle", "meeting", "journey", "death", "birth", "discovery", "conflict", "romance"]
        missing_types = [t for t in common_types if t not in existing_types]
        type_hint = ""
        if missing_types:
            type_hint = f"\nВАЖНО: Рекомендуется создать событие типа: {', '.join(missing_types[:3])} - таких типов событий пока мало или нет."
        
        prompt = f"""Сгенерируй ОДНО конкретное событие для таймлайна вселенной.

ВАЖНО: Текущее время во вселенной: {current_year} год {epoch}, День {current_day}.

Контекст вселенной:
{context}
{existing_summary}
{chars_summary}
{locs_summary}
{type_hint}

КРИТИЧНО: Событие должно быть КОНКРЕТНЫМ и использовать реальные имена персонажей и локаций из контекста!
НЕ используй общие фразы типа "Герои отправляются в путешествие" или "Персонажи обнаруживают информацию".
Вместо этого используй конкретику: "{example_chars} отправляются в {example_locs}" или "{example_chars.split(',')[0] if example_chars else 'Персонаж'} обнаруживает артефакт в {example_locs.split(',')[0] if example_locs else 'локации'}".

Событие должно быть:
- Логически связано с контекстом вселенной
- Использовать конкретных персонажей и локации из контекста
- Развивать существующие сюжетные линии или создавать новую интересную линию
- Быть детально проработанным и интересным

Для события укажи:
1. title - конкретное название события с именами персонажей или локаций (например: "Встреча {example_chars.split(',')[0] if example_chars else 'Харпер'} и {example_chars.split(',')[1] if len(example_chars.split(',')) > 1 else 'союзника'} в {example_locs.split(',')[0] if example_locs else 'крепости'}")
2. description - конкретное описание события (3-4 предложения) с упоминанием конкретных персонажей, локаций и деталей из контекста вселенной. Опиши ЧТО именно происходит, КТО участвует, ГДЕ это происходит, ПОЧЕМУ это важно.
3. event_type - тип события (general, battle, meeting, journey, death, birth, discovery, conflict, romance, act, chapter, other)
4. date_value - дата/время в формате вселенной (например: "{current_year} год, День {current_day}" или "Глава 3")
5. universe_year - год во вселенной (ЧИСЛО, например {current_year} или близкое к нему, НЕ маленькие числа вроде 12 или 84)
6. universe_day - день во вселенной (число от 1 до 365, или null)

КРИТИЧНО: universe_year должен быть близок к текущему году вселенной ({current_year}) или в разумных пределах от него (например, от {max(1, current_year - 100)} до {current_year + 100}). 
НЕ используй маленькие числа типа 12, 84, 1 - это будет интерпретироваться как события тысячи лет назад!
Событие может быть в прошлом (меньше {current_year}), настоящем (около {current_year}) или будущем (больше {current_year}).

Формат ответа — только JSON-объект (НЕ массив!):
{{
  "title": "Конкретное название с именами персонажей/локаций",
  "description": "Конкретное описание события с деталями из контекста вселенной.",
  "event_type": "general",
  "date_value": "{current_year} год, День 50",
  "universe_year": {current_year},
  "universe_day": 50
}}"""
        try:
            response = await llm_service.chat(
                messages=[ChatMessage(role="user", content=prompt)],
                provider=settings.default_llm_provider,
                model=settings.get_default_model(settings.default_llm_provider)
            )
            item = self._parse_json_object(response)
            if not item:
                # Fallback - берем первое из резервных
                fallback_list = self._generate_fallback_events(1, current_year, current_day)
                return fallback_list[0] if fallback_list else {}
            
            return {
                "title": item.get("title", "Событие"),
                "description": item.get("description", ""),
                "event_type": item.get("event_type", "general") if item.get("event_type") in (
                    "general", "battle", "meeting", "journey", "death", "birth", 
                    "discovery", "conflict", "romance", "act", "chapter", "other"
                ) else "general",
                "date_value": item.get("date_value"),
                "universe_year": item.get("universe_year"),
                "universe_day": item.get("universe_day"),
            }
        except Exception:
            fallback_list = self._generate_fallback_events(1, current_year, current_day)
            return fallback_list[0] if fallback_list else {}

    def _generate_fallback_events(self, count: int, current_year: int = 2026, current_day: int = 1) -> List[Dict]:
        """Резервные события если AI недоступен"""
        # Генерируем события вокруг текущего времени
        templates = [
            ("Важное открытие", "Персонажи обнаруживают ключевую информацию.", "discovery", f"Год {current_year}, День {min(current_day + 10, 365)}", current_year, min(current_day + 10, 365)),
            ("Битва", "Происходит решающее сражение.", "battle", f"Год {current_year}, День {min(current_day + 20, 365)}", current_year, min(current_day + 20, 365)),
            ("Встреча", "Важная встреча между ключевыми персонажами.", "meeting", f"Год {current_year}, День {min(current_day + 15, 365)}", current_year, min(current_day + 15, 365)),
            ("Путешествие", "Герои отправляются в опасное путешествие.", "journey", f"Год {current_year}, День {max(1, current_day - 5)}", current_year, max(1, current_day - 5)),
            ("Конфликт", "Возникает конфликт интересов.", "conflict", f"Год {current_year}, День {min(current_day + 25, 365)}", current_year, min(current_day + 25, 365)),
        ]
        return [
            {
                "title": t[0],
                "description": t[1],
                "event_type": t[2],
                "date_value": t[3],
                "universe_year": t[4],
                "universe_day": t[5],
            }
            for t in (templates * ((count // len(templates)) + 1))[:count]
        ]

    async def generate_faction_ideas(
        self,
        genre: str = "фэнтези",
        context: str = "",
        existing_factions: List[Dict] = None,
        count: int = 5
    ) -> List[Dict]:
        """Сгенерировать идеи фракций"""
        existing_summary = ""
        if existing_factions:
            existing_summary = "\nСуществующие фракции:\n" + "\n".join([
                f"- {f.get('name', 'Без названия')} ({f.get('faction_type', '')})" 
                for f in existing_factions[:10]
            ])
        
        prompt = f"""Сгенерируй {count} уникальных фракций/организаций для вселенной в жанре {genre}.

{f"Контекст вселенной:\n{context}" if context else ""}
{existing_summary}

Для каждой фракции укажи:
1. name - название фракции (запоминающееся, подходящее жанру)
2. description - описание фракции (2-3 предложения о её сути и роли)
3. faction_type - тип фракции (Военная, Религиозная, Торговая, Политическая, Тайная, Магическая, Криминальная, Научная и т.д.)
4. ideology - идеология/философия фракции (1-2 предложения)
5. goals - цели фракции (что она хочет достичь, 1-2 предложения)
6. headquarters - штаб-квартира или основная база (название локации или описание)
7. leader_name - имя лидера фракции
8. influence_level - уровень влияния от 1 до 10 (где 1 - слабая, 10 - могущественная)

Фракции должны быть логически связаны с контекстом вселенной и отличаться от существующих.
Разнообразь типы фракций.

Формат ответа — только JSON-массив:
[
  {{
    "name": "Название фракции",
    "description": "Описание фракции.",
    "faction_type": "Военная",
    "ideology": "Идеология фракции.",
    "goals": "Цели фракции.",
    "headquarters": "Название локации",
    "leader_name": "Имя лидера",
    "influence_level": 7
  }},
  ...
]"""
        try:
            response = await llm_service.chat(
                messages=[ChatMessage(role="user", content=prompt)],
                provider=settings.default_llm_provider,
                model=settings.get_default_model(settings.default_llm_provider)
            )
            items = self._parse_json_array(response)
            if not items:
                return self._generate_fallback_factions(count)
            
            out = []
            for item in items[:count]:
                influence = item.get("influence_level", 5)
                if isinstance(influence, str):
                    try:
                        influence = int(influence)
                    except:
                        influence = 5
                influence = max(1, min(10, influence))  # Ограничиваем от 1 до 10
                
                out.append({
                    "name": item.get("name", "Фракция"),
                    "description": item.get("description", ""),
                    "faction_type": item.get("faction_type", ""),
                    "ideology": item.get("ideology", ""),
                    "goals": item.get("goals", ""),
                    "headquarters": item.get("headquarters", ""),
                    "leader_name": item.get("leader_name", ""),
                    "influence_level": influence,
                })
            return out
        except Exception:
            return self._generate_fallback_factions(count)

    async def generate_single_faction(
        self,
        genre: str = "фэнтези",
        context: str = "",
        existing_factions: List[Dict] = None,
    ) -> Dict:
        """Сгенерировать одну фракцию, максимально подходящую под контекст вселенной и заполняющую пробелы"""
        existing_summary = ""
        if existing_factions:
            existing_summary = "\nСуществующие фракции:\n" + "\n".join([
                f"- {f.get('name', 'Без названия')} ({f.get('faction_type', '')})" 
                for f in existing_factions[:15]
            ])
        
        # Анализируем пробелы в типах фракций
        existing_types = set(f.get('faction_type', '') for f in (existing_factions or []))
        common_types = ["Военная", "Религиозная", "Торговая", "Политическая", "Тайная", "Магическая", "Криминальная", "Научная"]
        missing_types = [t for t in common_types if t not in existing_types]
        type_hint = ""
        if missing_types:
            type_hint = f"\nВАЖНО: Рекомендуется создать фракцию типа: {', '.join(missing_types[:3])} - таких типов пока нет."
        
        prompt = f"""Сгенерируй ОДНУ уникальную фракцию/организацию для вселенной в жанре {genre}.

{f"Контекст вселенной:\n{context}" if context else ""}
{existing_summary}
{type_hint}

Фракция должна быть:
- Логически связана с контекстом вселенной
- Отличаться от существующих фракций
- Заполнять пробелы в типах организаций вселенной
- Быть детально проработанной и интересной

Для фракции укажи:
1. name - название фракции (запоминающееся, подходящее жанру)
2. description - описание фракции (3-4 предложения о её сути, роли и истории)
3. faction_type - тип фракции (Военная, Религиозная, Торговая, Политическая, Тайная, Магическая, Криминальная, Научная и т.д.)
4. ideology - идеология/философия фракции (2-3 предложения, детально)
5. goals - цели фракции (что она хочет достичь, 2-3 предложения, конкретно)
6. headquarters - штаб-квартира или основная база (название локации или описание)
7. leader_name - имя лидера фракции
8. influence_level - уровень влияния от 1 до 10 (где 1 - слабая, 10 - могущественная)

Формат ответа — только JSON-объект (НЕ массив!):
{{
  "name": "Название фракции",
  "description": "Описание фракции.",
  "faction_type": "Военная",
  "ideology": "Идеология фракции.",
  "goals": "Цели фракции.",
  "headquarters": "Название локации",
  "leader_name": "Имя лидера",
  "influence_level": 7
}}"""
        try:
            response = await llm_service.chat(
                messages=[ChatMessage(role="user", content=prompt)],
                provider=settings.default_llm_provider,
                model=settings.get_default_model(settings.default_llm_provider)
            )
            item = self._parse_json_object(response)
            if not item:
                # Fallback - берем первую из резервных
                fallback_list = self._generate_fallback_factions(1)
                return fallback_list[0] if fallback_list else {}
            
            influence = item.get("influence_level", 5)
            if isinstance(influence, str):
                try:
                    influence = int(influence)
                except:
                    influence = 5
            influence = max(1, min(10, influence))  # Ограничиваем от 1 до 10
            
            return {
                "name": item.get("name", "Фракция"),
                "description": item.get("description", ""),
                "faction_type": item.get("faction_type", ""),
                "ideology": item.get("ideology", ""),
                "goals": item.get("goals", ""),
                "headquarters": item.get("headquarters", ""),
                "leader_name": item.get("leader_name", ""),
                "influence_level": influence,
            }
        except Exception:
            fallback_list = self._generate_fallback_factions(1)
            return fallback_list[0] if fallback_list else {}

    def _generate_fallback_factions(self, count: int) -> List[Dict]:
        """Резервные фракции если AI недоступен"""
        templates = [
            ("Орден Света", "Религиозная организация, поклоняющаяся силам добра.", "Религиозная", "Служение свету и защита невинных", "Искоренение зла и установление справедливости", "Храм Света", "Верховный Жрец", 8),
            ("Торговая Гильдия", "Мощная организация купцов, контролирующая торговые пути.", "Торговая", "Свободная торговля и прибыль", "Монополия на торговлю и расширение влияния", "Торговый квартал", "Главный Торговец", 6),
            ("Тайный Орден", "Скрытная организация, действующая из тени.", "Тайная", "Тайное управление событиями", "Контроль над ключевыми решениями", "Скрыто", "Неизвестен", 7),
            ("Военный Альянс", "Объединение военных сил для защиты границ.", "Военная", "Сила и порядок", "Защита территории и поддержание мира", "Крепость", "Главнокомандующий", 9),
            ("Магическая Академия", "Организация магов, изучающих древние искусства.", "Магическая", "Знание и магия", "Сохранение магических знаний и обучение", "Башня Магов", "Архимаг", 7),
        ]
        return [
            {
                "name": t[0],
                "description": t[1],
                "faction_type": t[2],
                "ideology": t[3],
                "goals": t[4],
                "headquarters": t[5],
                "leader_name": t[6],
                "influence_level": t[7],
            }
            for t in (templates * ((count // len(templates)) + 1))[:count]
        ]
