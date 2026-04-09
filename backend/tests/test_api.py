"""API tests: books list and create."""
import pytest


def test_get_books_empty(client):
    """GET /api/books returns 200 and empty list when no books."""
    r = client.get("/api/books")
    assert r.status_code == 200
    assert r.json() == []


def test_create_and_get_book(client):
    """POST /api/books creates a book; GET /api/books returns it."""
    r = client.post(
        "/api/books",
        json={
            "title": "Тестовая книга",
            "description": "Описание",
            "genre": "фэнтези",
            "direction": "",
        },
    )
    assert r.status_code == 200
    data = r.json()
    assert data["title"] == "Тестовая книга"
    assert data["genre"] == "фэнтези"
    assert "id" in data

    r2 = client.get("/api/books")
    assert r2.status_code == 200
    books = r2.json()
    assert len(books) == 1
    assert books[0]["title"] == "Тестовая книга"


def test_get_book_by_id(client):
    """GET /api/books/{id} returns the book or 404."""
    r = client.post(
        "/api/books",
        json={"title": "Одна", "description": "", "genre": "", "direction": ""},
    )
    assert r.status_code == 200
    book_id = r.json()["id"]

    r2 = client.get(f"/api/books/{book_id}")
    assert r2.status_code == 200
    assert r2.json()["title"] == "Одна"

    r3 = client.get("/api/books/99999")
    assert r3.status_code == 404
