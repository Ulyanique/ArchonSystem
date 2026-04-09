import pytest

def test_characters_crud(client):
    # Create universe first
    r = client.post("/api/universes", json={"title": "Character Universe"})
    universe_id = r.json()["id"]

    # Create character
    r = client.post(
        f"/api/universes/{universe_id}/characters",
        json={
            "name": "John Doe",
            "description": "A regular guy",
            "role": "protagonist",
            "traits": "brave",
            "age": 30
        }
    )
    assert r.status_code == 200
    char = r.json()
    assert char["name"] == "John Doe"
    char_id = char["id"]

    # List characters in universe
    r = client.get(f"/api/universes/{universe_id}/characters")
    assert r.status_code == 200
    assert len(r.json()) == 1
    assert r.json()[0]["name"] == "John Doe"

    # Get character by ID
    r = client.get(f"/api/universes/{universe_id}/characters/{char_id}")
    assert r.status_code == 200
    assert r.json()["name"] == "John Doe"

    # Update character
    r = client.put(
        f"/api/universes/{universe_id}/characters/{char_id}",
        json={"name": "Jane Doe", "enabled": False}
    )
    assert r.status_code == 200
    assert r.json()["name"] == "Jane Doe"
    assert r.json()["enabled"] is False

    # Delete character
    r = client.delete(f"/api/universes/{universe_id}/characters/{char_id}")
    assert r.status_code == 200

    r = client.get(f"/api/universes/{universe_id}/characters/{char_id}")
    assert r.status_code == 404
