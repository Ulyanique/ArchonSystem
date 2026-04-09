import pytest

def test_notes_crud(client):
    r = client.post("/api/universes", json={"title": "Notes Universe"})
    universe_id = r.json()["id"]

    # Create note
    r = client.post(
        f"/api/universes/{universe_id}/notes",
        json={"title": "Secret Note", "content": "The password is 42"}
    )
    assert r.status_code == 200
    note_id = r.json()["id"]

    # List
    r = client.get(f"/api/universes/{universe_id}/notes")
    assert r.status_code == 200
    assert any(n["id"] == note_id for n in r.json())

    # Delete
    r = client.delete(f"/api/universes/{universe_id}/notes/{note_id}")
    assert r.status_code == 200

def test_quotes_crud(client):
    r = client.post("/api/universes", json={"title": "Quotes Universe"})
    universe_id = r.json()["id"]
    r_char = client.post(f"/api/universes/{universe_id}/characters", json={"name": "Speaker"})
    char_id = r_char.json()["id"]

    # Create quote
    r = client.post(
        f"/api/universes/{universe_id}/quotes",
        json={
            "character_id": char_id,
            "interlocutor_type": "author",
            "quote_text": "Hello world"
        }
    )
    assert r.status_code == 200
    quote_id = r.json()["id"]

    # List
    r = client.get(f"/api/universes/{universe_id}/quotes")
    assert r.status_code == 200
    assert any(q["id"] == quote_id for q in r.json())

    # Delete
    r = client.delete(f"/api/universes/{universe_id}/quotes/{quote_id}")
    assert r.status_code == 200

def test_links_crud(client):
    r = client.post("/api/universes", json={"title": "Links Universe"})
    universe_id = r.json()["id"]

    # Create link
    r = client.post(
        f"/api/universes/{universe_id}/links",
        json={
            "source_type": "character",
            "source_id": 1,
            "target_type": "location",
            "target_id": 1,
            "link_type": "lives_in"
        }
    )
    assert r.status_code == 200
    link_id = r.json()["id"]

    # List
    r = client.get(f"/api/universes/{universe_id}/links")
    assert r.status_code == 200
    assert any(l["id"] == link_id for l in r.json())

    # Delete
    r = client.delete(f"/api/universes/{universe_id}/links/{link_id}")
    assert r.status_code == 200
