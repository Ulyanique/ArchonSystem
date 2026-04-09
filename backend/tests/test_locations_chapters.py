import pytest

def test_locations_crud(client):
    r = client.post("/api/universes", json={"title": "Location Universe"})
    universe_id = r.json()["id"]

    # Create location
    r = client.post(
        f"/api/universes/{universe_id}/locations",
        json={
            "name": "Central Square",
            "description": "Busy area",
            "location_type": "City"
        }
    )
    assert r.status_code == 200
    loc_id = r.json()["id"]

    # List locations
    r = client.get(f"/api/universes/{universe_id}/locations")
    assert r.status_code == 200
    assert any(l["id"] == loc_id for l in r.json())

    # Get location
    r = client.get(f"/api/universes/{universe_id}/locations/{loc_id}")
    assert r.status_code == 200
    assert r.json()["name"] == "Central Square"

    # Update
    r = client.put(f"/api/universes/{universe_id}/locations/{loc_id}", json={"name": "Old Square"})
    assert r.status_code == 200
    assert r.json()["name"] == "Old Square"

    # Delete
    r = client.delete(f"/api/universes/{universe_id}/locations/{loc_id}")
    assert r.status_code == 200

def test_chapters_crud(client):
    r = client.post("/api/universes", json={"title": "Chapter Universe"})
    universe_id = r.json()["id"]

    # Create chapter
    r = client.post(
        f"/api/universes/{universe_id}/chapters",
        json={
            "title": "Chapter 1",
            "chapter_number": 1,
            "content": "Once upon a time..."
        }
    )
    assert r.status_code == 200
    chap_id = r.json()["id"]

    # List
    r = client.get(f"/api/universes/{universe_id}/chapters")
    assert r.status_code == 200
    assert any(c["id"] == chap_id for c in r.json())

    # Update
    r = client.put(f"/api/universes/{universe_id}/chapters/{chap_id}", json={"title": "Chapter One"})
    assert r.status_code == 200
    assert r.json()["title"] == "Chapter One"

    # Delete
    r = client.delete(f"/api/universes/{universe_id}/chapters/{chap_id}")
    assert r.status_code == 200
