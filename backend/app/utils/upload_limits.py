"""Проверка размера и типа загружаемых файлов."""
from fastapi import HTTPException, UploadFile

from app.config import MAX_UPLOAD_SIZE_BYTES

ALLOWED_IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".webp"}


def validate_upload_size(content: bytes, max_bytes: int = MAX_UPLOAD_SIZE_BYTES) -> None:
    """Проверить размер контента; при превышении — HTTP 413."""
    if len(content) > max_bytes:
        raise HTTPException(
            status_code=413,
            detail=f"Файл слишком большой. Максимум: {max_bytes // (1024 * 1024)} МБ.",
        )


async def read_and_validate_upload(file: UploadFile, max_bytes: int = MAX_UPLOAD_SIZE_BYTES) -> bytes:
    """Прочитать файл и проверить размер. При превышении — HTTP 413."""
    content = await file.read()
    validate_upload_size(content, max_bytes)
    return content
