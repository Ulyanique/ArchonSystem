import logging
import random
import re
import json
from typing import List, Dict, Optional
from app.config import settings

logger = logging.getLogger(__name__)
from app.services.llm import llm_service
from app.schemas import ChatMessage
from app.services.generators.base_gen import BaseGenerator

class CharacterGenerator(BaseGenerator):
    ARCHETYPES = [
        "герой", "антигерой", "наставник", "трикстер", "тень",
        "хранитель", "соблазнитель", "творец", "бунтарь", "искатель"
    ]

    async def generate_character_ideas(self, genre: str = "фэнтези", count: int = 5) -> List[Dict]:
        archetype = random.choice(self.ARCHETYPES)
        prompt = f"""Сгенерируй {count} уникальных персонажей для вселенной в жанре {genre}.

Архетип: {archetype}

Для каждого персонажа укажи:
1. Имя (уникальное, подходящее жанру)
2. Возраст
3. Ключевую черту характера (одна яркая черта)
4. Внешность (2-3 детали)
5. Краткую предысторию (1-2 предложения)
6. Мотивацию (чего хочет персонаж)

Формат ответа - JSON массив:
[
  {{
    "name": "Имя",
    "age": 25,
    "trait": "черта характера",
    "appearance": "внешность",
    "backstory": "предыстория",
    "motivation": "мотивация"
  }}
]"""
        try:
            response = await llm_service.chat(
                messages=[ChatMessage(role="user", content=prompt)],
                provider=settings.default_llm_provider,
                model=settings.get_default_model(settings.default_llm_provider)
            )
            return self._parse_json_array(response)
        except Exception:
            return self._generate_fallback_characters(count)

    def _generate_fallback_characters(self, count: int) -> List[Dict]:
        names = ["Александр", "Елена", "Виктор", "Наталья", "Дмитрий", "Ольга", "Максим", "Анна"]
        traits = ["храбрый", "умный", "хитрый", "добрый", "загадочный", "амбициозный"]
        return [
            {
                "name": random.choice(names),
                "age": random.randint(18, 60),
                "trait": random.choice(traits),
                "appearance": "Запоминающаяся внешность",
                "backstory": "Интересная предыстория",
                "motivation": "Стремится к своей цели"
            }
            for _ in range(count)
        ]

    async def autofill_character(self, context: str, current: Dict) -> Dict:
        prompt = f"""Контекст вселенной для автора:

{context}

Текущие данные персонажа (пустые поля нужно заполнить):
- Имя: {current.get('name', '') or '(не задано)'}
- Описание: {current.get('description', '') or '(пусто)'}
- Роль: {current.get('role', '') or '(пусто)'}
- Черты: {current.get('traits', '') or '(пусто)'}
- Внешность: {current.get('appearance', '') or '(пусто)'}
- Предыстория: {current.get('backstory', '') or '(пусто)'}

Предложи значения только для пустых полей (description, role, traits, appearance, backstory), опираясь на контекст вселенной. Не меняй имя.
Ответ — только JSON объект с ключами для заполняемых полей, например: {{"description": "...", "role": "...", "traits": "...", "appearance": "...", "backstory": "..."}}"""
        try:
            response = await llm_service.chat(
                messages=[ChatMessage(role="user", content=prompt)],
                provider=settings.default_llm_provider,
                model=settings.get_default_model(settings.default_llm_provider)
            )
            return self._parse_json_object(response)
        except Exception:
            return {}

    async def generate_contextual_character(
        self, context: str, existing_characters: List[Dict], provider: Optional[str] = None, model: Optional[str] = None
    ) -> Dict:
        provider = provider or settings.default_llm_provider
        model = model or settings.get_default_model(provider)

        characters_summary = "\n".join([
            f"- {c.get('name', 'Без имени')}: {c.get('role', 'без роли')}, {c.get('profession', 'без профессии')}"
            for c in existing_characters[:20]
        ]) if existing_characters else "Пока нет персонажей"

        prompt = f"""Ты — помощник писателя. Твоя задача — создать ОДНОГО персонажа, который МАКСИМАЛЬНО подходит под контекст вселенной и заполняет логические пробелы в мире.

=== ПОЛНЫЙ КОНТЕКСТ ВСЕЛЕННОЙ ===
{context}

=== СУЩЕСТВУЮЩИЕ ПЕРСОНАЖИ ===
{characters_summary}

=== КРИТИЧЕСКИ ВАЖНЫЕ ИНСТРУКЦИИ ===
1. ВНИМАТЕЛЬНО ПРОЧИТАЙ описание вселенной выше. Извлеки ключевые концепции, темы, особенности мира.
2. Если в описании вселенной упоминается конкретная концепция (например, "Главный ИИ, захвативший власть над людьми"), персонаж ДОЛЖЕН соответствовать этой концепции, а не быть случайным.
3. Все поля персонажа (role, description, profession, traits, backstory и т.д.) ДОЛЖНЫ логично вытекать из описания вселенной.
4. Персонаж должен быть органичной частью мира, описанного в контексте.

=== ЗАДАНИЕ ===
Создай персонажа, который:
1. СТРОГО СООТВЕТСТВУЕТ описанию вселенной и её ключевым концепциям
2. ЛОГИЧНО вписывается в мир вселенной (если описано, что это мир с ИИ, захватившим власть, персонаж должен быть связан с этой концепцией)
3. ЗАПОЛНЯЕТ ПРОБЕЛЫ — добавляет то, чего не хватает, но в рамках описанного мира
4. ИМЕЕТ СВЯЗИ с существующими персонажами (если они есть)
5. Все характеристики персонажа (роль, профессия, описание, предыстория) должны быть согласованы между собой и с миром вселенной

=== ПРИМЕР ===
Если в описании вселенной написано "Главный ИИ, захвативший власть над людьми", то персонаж должен быть связан с этой концепцией:
- Роль может быть: "Главный ИИ", "Ассистент ИИ", "Человек, работающий на ИИ", "Сопротивленец против ИИ" и т.д.
- Профессия должна соответствовать миру с ИИ
- Описание должно отражать связь с концепцией ИИ и власти
- Предыстория должна объяснять, как персонаж оказался в этом мире

НЕ создавай персонажа, который не связан с описанным миром (например, "Хватчик данных" в мире про ИИ, захватившего власть, если это не логично связано с концепцией).

Заполни ВСЕ перечисленные поля в соответствии с контекстом вселенной. Не оставляй пустых строк — каждое поле должно содержать осмысленное значение, вытекающее из мира.

НЕ заполняй дату смерти: поля death_date, death_universe_year, death_universe_day не включай в ответ (оставь их пустыми — автор заполнит при необходимости).

Формат ответа — ТОЛЬКО JSON объект со следующими полями (все обязательны к заполнению, кроме даты смерти):
name (строка), role (строка), description (строка), traits (строка), appearance (строка, важно для портрета), backstory (строка), gender (строка: мужской/женский/иной), age (число или null), profession (строка), goals (строка), fears (строка), conflicts (строка), character_values (строка), speech_pattern (строка), skills (строка), abilities (строка), mannerisms (строка), habits (строка), relationships (строка), nationality (строка или null), birth_place (строка или null), birth_date (строка или null).
Верни ТОЛЬКО JSON. Все текстовые поля на русском языке."""
        try:
            response = await llm_service.chat(
                messages=[ChatMessage(role="user", content=prompt)],
                provider=provider,
                model=model,
            )
            raw = (response or "").strip()
            # Убираем обёртку markdown ```json ... ```
            if raw.startswith("```"):
                raw = re.sub(r"^```(?:json)?\s*", "", raw)
                raw = re.sub(r"\s*```$", "", raw)
            result = self._parse_json_object(raw)
            if result and result.get('name'):
                return result
            json_match = re.search(r'\{[\s\S]*\}', raw)
            if json_match:
                try:
                    obj = json.loads(json_match.group())
                    if obj and obj.get('name'):
                        return obj
                except json.JSONDecodeError as e:
                    logger.warning("generate_contextual_character: JSON decode error %s, snippet: %s", e, (raw[:500] if raw else ""))
            else:
                logger.warning("generate_contextual_character: JSON не найден в ответе, snippet: %s", (raw[:500] if raw else ""))
            return {}
        except Exception as e:
            logger.exception("generate_contextual_character: %s", e)
            return {}

    async def generate_portrait_prompt(
        self, character_data: Dict, universe_data: Dict, provider: str, model: str
    ) -> str:
        """Сгенерировать промпт для портрета (как в форме для Midjourney/Stable Diffusion). Полный контекст + сеттинг. Без имени в промпте."""
        system_content = """Ты эксперт по созданию промптов для AI-генераторов изображений (Midjourney, Stable Diffusion, DALL-E, Leonardo.ai).
Твоя задача: создать чистый, оптимизированный промпт для портрета персонажа, который можно сразу использовать в генераторе изображений.
Правила:
1. Используй только ключевые визуальные характеристики
2. Формат: описание внешности, стиль, настроение, качество
3. Без лишних слов, только то, что нужно для генерации изображения
4. Используй английские термины (portrait, detailed, high quality)
5. Структура: [тип изображения], [описание внешности], [стиль/сеттинг], [качество]
6. НЕ включай имя персонажа в промпт — модель не должна рисовать текст
7. Пример: "portrait of a young woman with long dark hair, piercing blue eyes, wearing medieval armor, fantasy art style, highly detailed, professional lighting, 8k resolution"
Верни ТОЛЬКО промпт, без объяснений и кавычек."""
        user_parts = [
            "Создай промпт для портрета персонажа:",
            f"Внешность: {character_data.get('appearance') or 'не указана'}",
            f"Роль: {character_data.get('role') or 'не указана'}",
            f"Пол: {character_data.get('gender') or 'не указан'}",
            f"Возраст: {character_data.get('age') or 'не указан'}",
            f"Описание: {character_data.get('description') or 'нет'}",
        ]
        if universe_data.get("genre") or universe_data.get("style_notes") or universe_data.get("description"):
            user_parts.append(
                "Сеттинг вселенной (отрази в стиле промпта): "
                + f"жанр: {universe_data.get('genre') or '-'}, стиль: {universe_data.get('style_notes') or '-'}, описание: {(universe_data.get('description') or '')[:150]}"
            )
        user_parts.append("Создай чистый промпт для AI-генератора изображений, без имени персонажа в тексте.")
        user_content = "\n".join(user_parts)
        try:
            response = await llm_service.chat(
                messages=[
                    ChatMessage(role="system", content=system_content),
                    ChatMessage(role="user", content=user_content),
                ],
                provider=provider,
                model=model,
            )
            raw = (response or "").strip()
            raw = re.sub(r'^["\']|["\']$', "", raw)
            raw = re.sub(r"^(Промпт|Prompt):\s*", "", raw, flags=re.IGNORECASE)
            return raw.strip()
        except Exception:
            return ""

    # Поля, для которых нужна одна короткая фраза (без сцен и длинного текста)
    SHORT_FIELDS = frozenset({
        "nationality", "birth_place", "gender", "profession", "role",
        "birth_date", "death_date", "name"
    })
    MAX_SHORT_FIELD_LEN = 150
    MAX_LONG_FIELD_LEN = 2000

    async def generate_character_field(
        self,
        universe_title: str,
        universe_description: str,
        character_data: Dict,
        field_name: str,
        provider: Optional[str] = None,
        model: Optional[str] = None,
    ) -> str:
        """Сгенерировать значение одного поля персонажа. Для роли используется полный контекст персонажа."""
        provider = provider or settings.default_llm_provider
        model = model or settings.get_default_model(provider)
        short_context = (universe_description or "")[:800].strip()
        char_name = character_data.get("name") or "персонаж"
        char_role = character_data.get("role") or ""
        char_profession = character_data.get("profession") or ""

        max_char_context = 350
        def _trunc(s: str, n: int = max_char_context) -> str:
            s = (s or "").strip()
            return s[:n] + ("..." if len(s) > n else "")

        full_character_context = ""
        ai_analysis_context = self._format_ai_analysis_for_context(character_data.get("ai_analysis"), _trunc)

        if field_name == "role":
            character_context_lines = []
            for key, label in [
                ("description", "Описание"),
                ("backstory", "Предыстория"),
                ("traits", "Черты характера"),
                ("goals", "Цели"),
                ("profession", "Профессия"),
                ("skills", "Навыки"),
                ("abilities", "Способности"),
                ("conflicts", "Конфликты"),
                ("fears", "Страхи"),
                ("appearance", "Внешность"),
            ]:
                val = (character_data.get(key) or "").strip()
                if val:
                    character_context_lines.append(f"{label}: {_trunc(val)}")
            full_character_context = "\n".join(character_context_lines) if character_context_lines else ""
            if ai_analysis_context:
                full_character_context = (full_character_context + "\n\n" + ai_analysis_context).strip()

        field_labels = {
            "nationality": "национальность (одно-два слова, например: русский, американец)",
            "birth_place": "место рождения (город, страна или краткое описание)",
            "gender": "пол/гендер (одно слово: Мужской, Женский или Безполое)",
            "profession": "профессия или род занятий",
            "role": "роль в сюжете — суть персонажа в мире (не архетип «главный герой», а краткая формулировка: например «последний архитектор органических нейросетей», «цифровой бог, захвативший Лимб»)",
            "birth_date": "дата рождения текстом (например: весна 2006, 15 марта 1990)",
            "death_date": "дата смерти текстом (если применимо)",
            "name": "имя персонажа",
        }
        label = field_labels.get(field_name, field_name)
        is_short = field_name in self.SHORT_FIELDS
        max_len = self.MAX_SHORT_FIELD_LEN if is_short else self.MAX_LONG_FIELD_LEN

        role_instruction = ""
        if field_name == "role":
            role_instruction = """
РОЛЬ В СЮЖЕТЕ — это не архетип («главный герой», «антагонист»), а СУТЬ персонажа в мире: одна короткая, ёмкая формулировка. Опирайся на ВЕСЬ контекст персонажа (описание, предыстория, цели, профессия, способности и т.д.) и на описание вселенной. Ответ — только эта фраза, без кавычек и пояснений."""

        system = """Ты — помощник писателя. Твоя задача — сгенерировать значение ОДНОГО поля карточки персонажа.

КРИТИЧЕСКИ ВАЖНО:
- Верни ТОЛЬКО значение поля на РУССКОМ языке. Никакого другого текста.
- НЕ пиши инструкции, подписи («Ответ:», «Answer:»), сцены, диалоги, JSON, кавычки вокруг ответа.
- Для национальности: одно-два слова (русский, американец). Для пола: Мужской, Женский или Безполое.""" + role_instruction

        if field_name == "role" and full_character_context:
            user = f"""Вселенная: {universe_title}
{("Описание мира: " + short_context) if short_context else ""}

=== ПОЛНЫЙ КОНТЕКСТ ПЕРСОНАЖА (имя: {char_name}) ===
{full_character_context}
{("Текущая роль (можно заменить): " + char_role) if char_role else ""}

Сформулируй роль в сюжете — суть этого персонажа в мире, одной короткой фразой. Только фраза, без подписей."""
        else:
            user = f"""Вселенная: {universe_title}
{("Краткое описание мира: " + short_context) if short_context else ""}

Персонаж: {char_name}
{("Профессия: " + char_profession) if char_profession else ""}
{("Текущая роль (можно заменить): " + char_role) if char_role else ""}
{f"\n{ai_analysis_context}\n" if ai_analysis_context else ""}

Дай только значение поля «{label}» для этого персонажа. Короткая фраза на русском, без подписей и инструкций."""

        try:
            response = await llm_service.chat(
                messages=[
                    ChatMessage(role="system", content=system),
                    ChatMessage(role="user", content=user),
                ],
                provider=provider,
                model=model,
            )
            value = self._clean_generated_field_value(response or "", field_name, max_len)
            return value
        except Exception as e:
            logger.warning("generate_character_field %s: %s", field_name, e)
            return ""

    def _format_ai_analysis_for_context(
        self, raw_ai_analysis: Optional[str], _trunc, max_len: int = 380
    ) -> str:
        """Формирует краткий блок из сохранённого AI-анализа для контекста при повторной генерации полей."""
        if not (raw_ai_analysis or "").strip():
            return ""
        try:
            data = json.loads(raw_ai_analysis)
        except (json.JSONDecodeError, TypeError):
            return ""
        parts = []
        score = data.get("score")
        if score is not None:
            parts.append(f"Ранее AI-анализ: оценка {int(score)}/10.")
        issues = data.get("issues") or []
        if issues:
            descs = [_trunc((i.get("description") or "").strip(), 80) for i in issues[:3] if (i.get("description") or "").strip()]
            if descs:
                parts.append("Проблемы: " + "; ".join(descs))
        suggestions = data.get("suggestions") or []
        if suggestions:
            texts = []
            for s in suggestions[:2]:
                if isinstance(s, str) and s.strip():
                    texts.append(_trunc(s, 60))
                elif isinstance(s, dict):
                    t = (s.get("title") or s.get("description") or "").strip()
                    if t:
                        texts.append(_trunc(t, 60))
            if texts:
                parts.append("Предложения: " + "; ".join(texts))
        if not parts:
            return ""
        block = " ".join(parts)
        return ("AI-анализ персонажа (учитывай при генерации): " + block)[:max_len]

    def _clean_generated_field_value(self, raw: str, field_name: str, max_len: int) -> str:
        """Убрать из ответа инструкции, подписи «Ответ:», английский текст и т.п.; оставить только значение поля."""
        value = (raw or "").strip()
        value = re.sub(r'^["\']|["\']$', "", value)
        value = re.sub(r"^```\w*\s*|\s*```$", "", value).strip()
        if not value:
            return ""
        lines = [ln.strip() for ln in value.split("\n") if ln.strip()]
        bad_starts = (
            "answer:", "ответ:", "отет:", "reply:", "write a", "write:", "60 символов",
            "максимум", "символов максимум", "message:", "сообщение:"
        )
        bad_contains = (
            "символов максимум", "становится репликой", "для сгенерирования",
            "сообщение-то всего на английском", "write a reply", "reply from"
        )
        for line in lines:
            line_lower = line.lower()
            if any(line_lower.startswith(b) for b in bad_starts):
                continue
            if any(b in line_lower for b in bad_contains):
                continue
            if len(line) < 2:
                continue
            value = line
            break
        else:
            value = lines[0] if lines else value
        value = re.sub(r"^(Answer|Reply|Отет|Ответ|Message|Сообщение)\s*:\s*", "", value, flags=re.IGNORECASE)
        value = re.sub(r"^Write a reply[^.]*\.\s*", "", value, flags=re.IGNORECASE)
        for prefix in ("ответ:", "answer:", "отет:", "reply:", "message:"):
            if prefix in value.lower():
                idx = value.lower().rfind(prefix)
                value = value[idx + len(prefix) :].strip()
                break
        value = value.strip()
        if len(value) > max_len:
            value = value[: max_len - 3].rstrip() + "..."
        letters = re.sub(r"[^\w\u0400-\u04ff]", "", value)
        if len(letters) > 10 and sum(1 for c in letters if "\u0400" <= c <= "\u04ff") < len(letters) * 0.5:
            return ""
        return value
