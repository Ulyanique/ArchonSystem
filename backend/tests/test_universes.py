import pytest

def test_universes_crud(client):
    # Create
    r = client.post(
        "/api/universes",
        json={
            "title": "New Universe",
            "description": "A mysterious place",
            "genre": "Sci-Fi",
            "universe_type": "Space Opera"
        }
    )
    assert r.status_code == 200
    universe = r.json()
    assert universe["title"] == "New Universe"
    universe_id = universe["id"]

    # List
    r = client.get("/api/universes")
    assert r.status_code == 200
    assert any(u["id"] == universe_id for u in r.json())

    # Get by ID
    r = client.get(f"/api/universes/{universe_id}")
    assert r.status_code == 200
    assert r.json()["title"] == "New Universe"

    # Update
    r = client.put(
        f"/api/universes/{universe_id}",
        json={"title": "Updated Universe"}
    )
    assert r.status_code == 200
    assert r.json()["title"] == "Updated Universe"

    # Delete
    r = client.delete(f"/api/universes/{universe_id}")
    assert r.status_code == 200

    r = client.get(f"/api/universes/{universe_id}")
    assert r.status_code == 404

def test_universe_clock(client):
    r = client.post("/api/universes", json={"title": "Clock Universe"})
    universe_id = r.json()["id"]

    r = client.get(f"/api/universes/{universe_id}/clock")
    assert r.status_code == 200
    data = r.json()
    assert "year" in data
    assert "display" in data
