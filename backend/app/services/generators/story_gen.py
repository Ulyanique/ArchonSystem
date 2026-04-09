import random
from typing import List, Dict, Optional
from app.config import settings
from app.services.llm import llm_service
from app.schemas import ChatMessage
from app.services.generators.base_gen import BaseGenerator

class StoryGenerator(BaseGenerator):
    PLOT_HOOKS = [
        "неожиданное предательство", "древняя тайна", "пропавший артефакт",
        "семейная вражда", "политический заговор", "магическая катастрофа",
        "забытое пророчество", "внезапное вторжение", "эпидемия", "восстание"
    ]

    async def generate_plot_twist(
        self,
        genre: str = "фэнтези",
        context: str = ""
    ) -> Dict:
        """Сгенерировать неожиданный поворот сюжета"""
        hook = random.choice(self.PLOT_HOOKS)
        prompt = f"""Придумай неожиданный поворот сюжета для вселенной в жанре {genre}.

Завязка: {hook}
{f"Контекст: {context}" if context else ""}

Опиши:
1. Сам поворот (что происходит)
2. Почему это неожиданно для читателя
3. Какие последствия это имеет для персонажей

Формат ответа - JSON:
{{
  "twist": "описание поворота",
  "why_unexpected": "почему неожиданно",
  "consequences": "последствия"
}}"""
        try:
            response = await llm_service.chat(
                messages=[ChatMessage(role="user", content=prompt)],
                provider=settings.default_llm_provider,
                model=settings.get_default_model(settings.default_llm_provider)
            )
            return self._parse_json_object(response)
        except Exception:
            return {
                "twist": f"Внезапно выясняется, что {hook} была лишь частью большего плана",
                "why_unexpected": "Читатель ожидает одного, но происходит другое",
                "consequences": "Персонажи должны пересмотреть свои планы"
            }

    async def generate_chapter_summary(
        self,
        chapter_number: int,
        previous_summary: str = "",
        genre: str = "фэнтези"
    ) -> str:
        """Сгенерировать краткое содержание главы"""
        prompt = f"""Напиши краткое содержание главы {chapter_number} для вселенной в жанре {genre}.

{f"Предыдущие события: {previous_summary}" if previous_summary else ""}

Содержание должно включать:
1. Что происходит в главе
2. Какие персонажи участвуют
3. Какой конфликт развивается
4. Чем заканчивается глава (клиффхэнгер если возможно)

Ответ должен быть 3-5 предложений."""
        try:
            response = await llm_service.chat(
                messages=[ChatMessage(role="user", content=prompt)],
                provider=settings.default_llm_provider,
                model=settings.get_default_model(settings.default_llm_provider)
            )
            return response
        except Exception:
            return f"Глава {chapter_number}: Персонажи сталкиваются с новыми вызовами и делают важные открытия."

    async def generate_outline(
        self,
        book_title: str,
        book_description: str,
        direction: str,
        genre: str,
        existing_characters: List[Dict],
        existing_locations: List[Dict],
        num_chapters: int = 12
    ) -> List[Dict]:
        """Сгенерировать план вселенной (акты/главы) по направлению."""
        chars_text = "\n".join([f"- {c.get('name', '')}: {c.get('role', '')}" for c in existing_characters[:15]]) if existing_characters else "Пока нет."
        locs_text = "\n".join([f"- {l.get('name', '')}" for l in existing_locations[:15]]) if existing_locations else "Пока нет."
        prompt = f"""По направлению и контексту вселенной составь план (аутлайн): акты и главы.

## КНИГА
Название: {book_title}
Описание: {book_description}
Жанр: {genre}
Направление/премиса: {direction or "не задано"}

## УЖЕ ЕСТЬ В КНИГЕ
Персонажи:
{chars_text}
Локации:
{locs_text}

## ЗАДАНИЕ
Сгенерируй план из примерно {num_chapters} глав. Можно сгруппировать в 3 акта.
Для каждого пункта укажи: outline_type (act или chapter), title, summary (2-3 предложения).

Формат ответа — только JSON-массив:
[
  {{"outline_type": "act", "title": "Акт 1: ...", "summary": "..."}},
  {{"outline_type": "chapter", "title": "Глава 1: ...", "summary": "..."}},
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
                return []
            out = []
            for i, item in enumerate(items):
                out.append({
                    "outline_type": item.get("outline_type", "chapter"),
                    "title": item.get("title", f"Пункт {i+1}"),
                    "summary": item.get("summary", ""),
                    "sort_order": i
                })
            return out
        except Exception:
            return []
