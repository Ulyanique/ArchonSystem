import pytest
from datetime import datetime, timezone, timedelta
from app.models import Universe
from app.services.time_service import time_service

def test_time_service_basic():
    u = Universe(
        clock_enabled=True,
        universe_start_year=1000,
        universe_start_day=1,
        universe_start_hour=12,
        universe_hours_per_day=24,
        universe_days_per_year=365,
        universe_time_scale=1.0,
        universe_reference_real_date=datetime.now(timezone.utc)
    )

    t = time_service.get_current_universe_time(u)
    assert t["year"] == 1000
    assert t["day"] == 1
    assert t["hour"] == 12

def test_time_service_scaled():
    # 1 real second = 3600 universe seconds (1 hour)
    ref = datetime.now(timezone.utc) - timedelta(seconds=1)
    u = Universe(
        clock_enabled=True,
        universe_start_year=1000,
        universe_start_day=1,
        universe_start_hour=0,
        universe_hours_per_day=24,
        universe_days_per_year=365,
        universe_time_scale=3600.0,
        universe_reference_real_date=ref
    )

    t = time_service.get_current_universe_time(u)
    # After 1 real second, 1 hour should have passed in universe
    assert t["year"] == 1000
    assert t["day"] == 1
    assert t["hour"] == 1

def test_rag_service_mock(monkeypatch):
    # Testing RAG service might be heavy due to ChromaDB.
    # We can at least test its existence and basic methods if we mock the client.
    from app.services.rag import RAGService
    import chromadb

    # Mock chromadb.PersistentClient
    class MockClient:
        def get_collection(self, name):
            return MockCollection()
        def create_collection(self, name, **kwargs):
            return MockCollection()

    class MockCollection:
        def add(self, **kwargs): pass
        def query(self, **kwargs):
            return {'documents': [[]], 'ids': [[]], 'metadatas': [[]], 'distances': [[]]}
        def delete(self, **kwargs): pass
        def get(self, **kwargs):
            return {'ids': []}

    monkeypatch.setattr(chromadb, "PersistentClient", lambda path: MockClient())

    rag = RAGService()
    rag.add_document(1, "doc1", "content")
    res = rag.search(1, "query")
    assert res == []
