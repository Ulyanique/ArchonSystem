import random
import re
import logging
from typing import List, Dict, Optional
from app.config import settings
from app.services.llm import llm_service
from app.schemas import ChatMessage
from app.services.generators.base_gen import BaseGenerator

logger = logging.getLogger(__name__)


class LocationGenerator(BaseGenerator):
    LOCATION_TYPES = [
        "замок", "город", "деревня", "лес", "горы", "пустыня",
        "подземелье", "остров", "крепость", "храм", "рынок"
    ]

    async def generate_location_ideas(
        self,
        genre: str = "фэнтези",
        count: int = 5
    ) -> List[Dict]:
        """Сгенерировать идеи локаций"""
        location_type = random.choice(self.LOCATION_TYPES)
        prompt = f"""Сгенерируй {count} уникальных локаций для вселенной в жанре {genre}.

Тип локации: {location_type}

Для каждой локации укажи:
1. Название (атмосферное, запоминающееся)
2. Тип (уточнение)
3. Описание (2-3 предложения, атмосфера, особенности)
4. Секрет или особенность (что делает это место уникальным)

Формат ответа - JSON массив:
[
  {{
    "name": "Название",
    "type": "тип",
    "description": "описание",
    "secret": "секрет или особенность"
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
            return self._generate_fallback_locations(count)

    def _generate_fallback_locations(self, count: int) -> List[Dict]:
        """Резервные локации если AI недоступен"""
        prefixes = ["Древний", "Забытый", "Тайный", "Тёмный", "Светлый", "Северный"]
        suffixes = ["замок", "город", "лес", "храм", "остров", "перевал"]
        return [
            {
                "name": f"{random.choice(prefixes)} {random.choice(suffixes)}",
                "type": random.choice(self.LOCATION_TYPES),
                "description": "Атмосферное место с богатой историей",
                "secret": "Скрывает важную тайну"
            }
            for _ in range(count)
        ]

    async def autofill_location(self, context: str, current: Dict) -> Dict:
        """Предложить значения для пустых полей локации по контексту вселенной."""
        prompt = f"""Контекст вселенной:

{context}

Текущие данные локации:
- Название: {current.get('name', '') or '(не задано)'}
- Описание: {current.get('description', '') or '(пусто)'}
- Тип: {current.get('location_type', '') or '(пусто)'}
- Детали: {current.get('details', '') or '(пусто)'}

Предложи значения только для пустых полей. Ответ — только JSON, например: {{"description": "...", "location_type": "...", "details": "..."}}"""
        try:
            response = await llm_service.chat(
                messages=[ChatMessage(role="user", content=prompt)],
                provider=settings.default_llm_provider,
                model=settings.get_default_model(settings.default_llm_provider)
            )
            return self._parse_json_object(response)
        except Exception:
            return {}

    async def generate_location_image_prompt(
        self, location_data: Dict, universe_data: Dict, provider: str, model: str
    ) -> Optional[str]:
        """Сгенерировать промпт для изображения локации (пейзаж/место)."""
        system_content = """Ты эксперт по созданию промптов для AI-генераторов изображений (Midjourney, Stable Diffusion, DALL-E).
Твоя задача: создать чистый промпт для изображения локации/места (пейзаж, архитектура, интерьер), без текста и букв на картинке.
Правила:
1. Используй только ключевые визуальные детали: тип места, атмосфера, освещение, стиль.
2. Формат: [тип сцены], [описание места], [стиль/сеттинг], [качество].
3. Английские термины: landscape, environment, detailed, atmospheric, 8k.
4. Пример: "atmospheric landscape of a medieval castle on a hill at sunset, fantasy art style, highly detailed, dramatic lighting, 8k resolution"
Верни ТОЛЬКО промпт, без объяснений и кавычек."""
        user_parts = [
            "Создай промпт для изображения локации:",
            f"Название: {location_data.get('name') or 'не указано'}",
            f"Тип: {location_data.get('location_type') or 'не указан'}",
            f"Описание: {location_data.get('description') or 'нет'}",
            f"Детали: {location_data.get('details') or 'нет'}",
        ]
        if universe_data.get("genre") or universe_data.get("style_notes"):
            user_parts.append(
                "Сеттинг вселенной: "
                + f"жанр: {universe_data.get('genre') or '-'}, стиль: {universe_data.get('style_notes') or '-'}"
            )
        user_parts.append("Создай чистый промпт для AI-генератора изображений.")
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
            return raw.strip() or None
        except Exception as e:
            logger.exception("generate_location_image_prompt: %s", e)
            return None
