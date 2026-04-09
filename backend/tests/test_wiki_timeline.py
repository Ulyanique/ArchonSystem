import pytest

def test_wiki_crud(client):
    r = client.post("/api/universes", json={"title": "Wiki Universe"})
    universe_id = r.json()["id"]

    # Create wiki article
    r = client.post(
        f"/api/universes/{universe_id}/wiki",
        json={
            "title": "History of Magic",
            "content": "Magic was born in...",
            "article_type": "manual"
        }
    )
    assert r.status_code == 200
    article = r.json()
    assert article["title"] == "History of Magic"
    article_id = article["id"]
    slug = article["slug"]

    # List articles
    r = client.get(f"/api/universes/{universe_id}/wiki")
    assert r.status_code == 200
    assert any(a["id"] == article_id for a in r.json())

    # Get by slug
    r = client.get(f"/api/universes/{universe_id}/wiki/slug/{slug}")
    assert r.status_code == 200
    assert r.json()["title"] == "History of Magic"

    # Update
    r = client.put(f"/api/universes/{universe_id}/wiki/{article_id}", json={"title": "Ancient History of Magic"})
    assert r.status_code == 200
    assert r.json()["title"] == "Ancient History of Magic"

    # Delete
    r = client.delete(f"/api/universes/{universe_id}/wiki/{article_id}")
    assert r.status_code == 200

def test_timeline_crud(client):
    r = client.post("/api/universes", json={"title": "Timeline Universe"})
    universe_id = r.json()["id"]

    # Create event
    r = client.post(
        f"/api/universes/{universe_id}/timeline",
        json={
            "title": "The Great Battle",
            "description": "Epic fight",
            "date_value": "Year 100",
            "universe_year": 100,
            "universe_day": 1,
            "event_type": "battle"
        }
    )
    assert r.status_code == 200
    event_id = r.json()["id"]

    # List
    r = client.get(f"/api/universes/{universe_id}/timeline")
    assert r.status_code == 200
    assert any(e["id"] == event_id for e in r.json())

    # Update
    r = client.put(f"/api/universes/{universe_id}/timeline/{event_id}", json={"title": "The First Great Battle"})
    assert r.json()["title"] == "The First Great Battle"

    # Delete
    r = client.delete(f"/api/universes/{universe_id}/timeline/{event_id}")
    assert r.status_code == 200
