"""
Комментарии автора в тексте: синтаксис %% ... %%.
Видит только ИИ-помощник; в экспорте и превью эти блоки удаляются.
"""
import re

# Блок между %% и %% (включая переносы строк), нежадный. Внутри не должно быть %% (иначе комментарий обрежется).
AUTHOR_NOTE_PATTERN = re.compile(r"%%[\s\S]*?%%", re.UNICODE)


def strip_author_notes(text: str) -> str:
    """Удалить из текста блоки комментариев автора %% ... %%. Оставить остальное."""
    if not text:
        return text
    cleaned = AUTHOR_NOTE_PATTERN.sub("", text)
    # Убрать лишние пустые строки (например, оставшиеся после удаления %% ... %% на отдельной строке)
    cleaned = re.sub(r"\n{3,}", "\n\n", cleaned)
    return cleaned.strip() if cleaned != text else cleaned
