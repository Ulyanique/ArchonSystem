"""Тесты лимитов загрузки файлов (413 при превышении размера) и успешной загрузки."""
import pytest

from app.config import MAX_UPLOAD_SIZE_BYTES


def test_upload_cover_rejects_large_file(client):
    """Загрузка обложки больше MAX_UPLOAD_SIZE_BYTES возвращает 413."""
    r = client.post("/api/universes", json={"title": "Upload Test", "description": "", "genre": ""})
    assert r.status_code == 200
    universe_id = r.json()["id"]

    # Файл на 1 байт больше лимита
    large = b"\x00" * (MAX_UPLOAD_SIZE_BYTES + 1)
    r = client.post(
        f"/api/universes/{universe_id}/cover",
        files={"file": ("huge.jpg", large, "image/jpeg")},
    )
    assert r.status_code == 413
    assert "МБ" in (r.json().get("detail") or "")


def test_upload_cover_accepts_small_file(client):
    """Загрузка обложки в пределах лимита возвращает 200."""
    r = client.post("/api/universes", json={"title": "Cover OK", "description": "", "genre": ""})
    assert r.status_code == 200
    universe_id = r.json()["id"]

    small = b"\xff\xd8\xff\xe0\x00\x10JFIF" + b"\x00" * 100  # минимальный "jpeg"
    r = client.post(
        f"/api/universes/{universe_id}/cover",
        files={"file": ("small.jpg", small, "image/jpeg")},
    )
    assert r.status_code == 200
    assert r.json().get("cover_image_path")


def test_upload_portrait_rejects_large_file(client):
    """Загрузка портрета персонажа больше лимита возвращает 413."""
    r = client.post("/api/universes", json={"title": "Portrait Test", "description": "", "genre": ""})
    universe_id = r.json()["id"]
    r = client.post(
        f"/api/universes/{universe_id}/characters",
        json={"name": "Hero", "description": "", "role": ""},
    )
    assert r.status_code == 200
    character_id = r.json()["id"]

    large = b"\x00" * (MAX_UPLOAD_SIZE_BYTES + 1)
    r = client.post(
        f"/api/universes/{universe_id}/characters/{character_id}/portrait",
        files={"file": ("huge.png", large, "image/png")},
    )
    assert r.status_code == 413


def test_upload_portrait_accepts_small_file(client):
    """Загрузка портрета в пределах лимита возвращает 200."""
    r = client.post("/api/universes", json={"title": "Portrait OK", "description": "", "genre": ""})
    universe_id = r.json()["id"]
    r = client.post(
        f"/api/universes/{universe_id}/characters",
        json={"name": "Alice", "description": "", "role": ""},
    )
    assert r.status_code == 200
    character_id = r.json()["id"]

    small = b"\x89PNG\r\n\x1a\n" + b"\x00" * 50
    r = client.post(
        f"/api/universes/{universe_id}/characters/{character_id}/portrait",
        files={"file": ("tiny.png", small, "image/png")},
    )
    assert r.status_code == 200
    assert r.json().get("portrait_image_path")


def test_upload_location_image_rejects_large_file(client):
    """Загрузка изображения локации больше лимита возвращает 413."""
    r = client.post("/api/universes", json={"title": "Loc Img Test", "description": "", "genre": ""})
    universe_id = r.json()["id"]
    r = client.post(
        f"/api/universes/{universe_id}/locations",
        json={"name": "Place", "description": "", "location_type": "city"},
    )
    assert r.status_code == 200
    location_id = r.json()["id"]

    large = b"\x00" * (MAX_UPLOAD_SIZE_BYTES + 1)
    r = client.post(
        f"/api/universes/{universe_id}/locations/{location_id}/image",
        files={"file": ("huge.jpg", large, "image/jpeg")},
    )
    assert r.status_code == 413


def test_backup_returns_zip(client):
    """Эндпоинт бэкапа возвращает zip-архив."""
    r = client.post("/api/universes", json={"title": "Backup Target", "description": "", "genre": ""})
    assert r.status_code == 200
    universe_id = r.json()["id"]

    r = client.get(f"/api/universes/{universe_id}/backup")
    assert r.status_code == 200
    assert "application/zip" in r.headers.get("content-type", "")
    assert r.content[:2] == b"PK"  # ZIP magic


def test_restore_creates_universe(client):
    """Восстановление из архива создаёт новую вселенную."""
    r = client.post("/api/universes", json={"title": "To Backup", "description": "Desc", "genre": "Sci-Fi"})
    assert r.status_code == 200
    orig_id = r.json()["id"]

    backup_resp = client.get(f"/api/universes/{orig_id}/backup")
    assert backup_resp.status_code == 200
    zip_bytes = backup_resp.content

    r = client.post(
        "/api/universes/restore",
        files={"file": ("backup.zip", zip_bytes, "application/zip")},
    )
    assert r.status_code == 200
    data = r.json()
    assert "universe_id" in data
    assert data["universe_id"] != orig_id
    assert data.get("title") == "To Backup"

    r2 = client.get("/api/universes")
    assert r2.status_code == 200
    ids = [u["id"] for u in r2.json()]
    assert data["universe_id"] in ids
