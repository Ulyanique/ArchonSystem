import chromadb
from chromadb.config import Settings
from typing import Any, Dict, List, Optional
import os
from app.config import VECTOR_STORE_PATH

# Порог длины главы для разбиения на чанки (символов)
CHAPTER_CHUNK_SIZE = 1500
CHAPTER_CHUNK_OVERLAP = 300


# Модель эмбеддингов по умолчанию (мультиязычная, хорошо работает с русским).
# Можно переопределить через RAG_EMBEDDING_MODEL в .env. Пустое значение = отключить свои эмбеддинги (ChromaDB использует встроенные, хуже для русского).
DEFAULT_RAG_EMBEDDING_MODEL = "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"


def _get_embedding_function():
    """Эмбеддинги через sentence-transformers (русский/мультиязычный). По умолчанию — мультиязычная модель."""
    raw = (os.environ.get("RAG_EMBEDDING_MODEL") or "").strip()
    # Явное отключение: оставить встроенные эмбеддинги ChromaDB (хуже для русского)
    if raw.lower() in ("0", "none", "chromadb", "off"):
        return None
    model_name = raw or DEFAULT_RAG_EMBEDDING_MODEL
    try:
        from sentence_transformers import SentenceTransformer
        model = SentenceTransformer(model_name)

        class _EmbeddingFn:
            def name(self) -> str:
                return "sentence_transformers"
            def __call__(self, input: List[str]) -> List[List[float]]:
                return model.encode(input, show_progress_bar=False).tolist()
            def embed_query(self, input: Any, **kwargs: Any) -> List[List[float]]:
                text = input[0] if isinstance(input, (list, tuple)) and input else (input if isinstance(input, str) else str(input or ""))
                emb = model.encode([text], show_progress_bar=False)[0].tolist()
                return [emb]
        return _EmbeddingFn()
    except Exception:
        return None


class RAGService:
    """Сервис для RAG (Retrieval Augmented Generation)"""
    
    def __init__(self):
        # Глобальный клиент (для обратной совместимости или общих данных)
        VECTOR_STORE_PATH.mkdir(parents=True, exist_ok=True)
        self.global_client = chromadb.PersistentClient(path=str(VECTOR_STORE_PATH))
        
        # Кэш клиентов и коллекций по вселенным
        self.clients: Dict[int, chromadb.PersistentClient] = {}
        self.collections: Dict[int, chromadb.Collection] = {}
        
        # Эмбеддинги загружаются при первом обращении к коллекции (не при старте приложения)
        self._embedding_fn: Optional[Any] = None
        self._embedding_fn_loaded = False
    
    def _get_embedding_fn(self):
        """Ленивая загрузка модели эмбеддингов, чтобы не блокировать старт сервера."""
        if not self._embedding_fn_loaded:
            self._embedding_fn_loaded = True
            self._embedding_fn = _get_embedding_function()
        return self._embedding_fn
    
    def get_client(self, universe_id: int) -> chromadb.PersistentClient:
        if universe_id not in self.clients:
            from app.config import DATA_DIR
            universe_vector_path = DATA_DIR / "universes" / str(universe_id) / "vector_store"
            universe_vector_path.mkdir(parents=True, exist_ok=True)
            self.clients[universe_id] = chromadb.PersistentClient(path=str(universe_vector_path))
        return self.clients[universe_id]

    def get_collection(self, universe_id: int) -> chromadb.Collection:
        """Получить или создать коллекцию для вселенной в её собственной папке.
        Если коллекция была создана с другой функцией эмбеддингов (например default),
        удаляем её и создаём заново с текущей (sentence_transformers).
        """
        if universe_id not in self.collections:
            client = self.get_client(universe_id)
            collection_name = f"universe_{universe_id}"
            kwargs: Dict[str, Any] = {}
            emb_fn = self._get_embedding_fn()
            if emb_fn is not None:
                kwargs["embedding_function"] = emb_fn
            try:
                self.collections[universe_id] = client.get_or_create_collection(
                    name=collection_name, **kwargs
                )
            except Exception as e:
                err_msg = str(e).lower()
                if "embedding function" in err_msg and ("conflict" in err_msg or "already exists" in err_msg):
                    self._invalidate_collection_cache(universe_id)
                    try:
                        client.delete_collection(name=collection_name)
                    except Exception:
                        pass
                    self.collections[universe_id] = client.get_or_create_collection(
                        name=collection_name, **kwargs
                    )
                else:
                    raise
        return self.collections[universe_id]

    def _invalidate_collection_cache(self, universe_id: int) -> None:
        """Сбросить кэш коллекции (например, после ошибки «collection does not exist»)."""
        self.collections.pop(universe_id, None)
    
    def _chunk_text(self, text: str) -> List[str]:
        """Разбить текст на чанки с перекрытием."""
        if not text or len(text) <= CHAPTER_CHUNK_SIZE:
            return [text] if text else []
        chunks = []
        start = 0
        while start < len(text):
            end = start + CHAPTER_CHUNK_SIZE
            chunk = text[start:end]
            # По возможности обрезать по границе абзаца
            if end < len(text):
                last_para = chunk.rfind("\n\n")
                if last_para > CHAPTER_CHUNK_SIZE // 3: # Если абзац хотя бы на треть чанка
                    chunk = chunk[: last_para + 2] # Включаем переносы строк
                    end = start + len(chunk)
                else:
                    # Если нет абзаца, ищем хотя бы точку
                    last_sentence = chunk.rfind(". ")
                    if last_sentence > CHAPTER_CHUNK_SIZE // 2:
                        chunk = chunk[: last_sentence + 2]
                        end = start + len(chunk)
            chunks.append(chunk)
            start = end - CHAPTER_CHUNK_OVERLAP
            if start < 0: start = 0
            if start >= len(text): break
        return chunks
    
    def add_chapter_content(
        self,
        universe_id: int,
        chapter_id: int,
        title: str,
        content: str
    ) -> None:
        """Добавить содержание главы (одним документом или чанками)."""
        collection = self.get_collection(universe_id)
        # Удалить старые документы этой главы по метаданным
        try:
            existing = collection.get(where={"chapter_id": chapter_id})
            if existing and existing["ids"]:
                collection.delete(ids=existing["ids"])
        except Exception:
            pass
        # Удалить старый единый документ главы по id (обратная совместимость)
        try:
            collection.delete(ids=[f"chapter_{chapter_id}"])
        except Exception:
            pass
        
        content = (content or "").strip()
        if not content:
            return
        
        chunks = self._chunk_text(content)
        if not chunks:
            return
        
        for i, chunk_content in enumerate(chunks):
            doc_id = f"chapter_{chapter_id}_chunk_{i}"
            metadata = {
                "type": "chapter",
                "title": title,
                "chapter_id": chapter_id,
                "chunk_index": i,
                "entity_type": "chapter",
                "entity_id": chapter_id,
            }
            collection.add(
                documents=[chunk_content],
                ids=[doc_id],
                metadatas=[metadata]
            )
    
    def remove_chapter_documents(self, universe_id: int, chapter_id: int) -> None:
        """Удалить все документы главы из векторной базы."""
        collection = self.get_collection(universe_id)
        try:
            existing = collection.get(where={"chapter_id": chapter_id})
            if existing and existing["ids"]:
                collection.delete(ids=existing["ids"])
        except Exception:
            pass
        try:
            collection.delete(ids=[f"chapter_{chapter_id}"])
        except Exception:
            pass

    def add_note_content(
        self,
        universe_id: int,
        note_id: int,
        title: str,
        content: str,
        note_type: str = "note",
    ) -> None:
        """Добавить заметку/черновик чанками, чтобы в контекст попадали только релевантные фрагменты."""
        collection = self.get_collection(universe_id)
        try:
            existing = collection.get(where={"note_id": note_id})
            if existing and existing["ids"]:
                collection.delete(ids=existing["ids"])
        except Exception:
            pass
        try:
            collection.delete(ids=[f"note_{note_id}"])
        except Exception:
            pass
        content = (content or "").strip()
        if not content:
            return
        chunks = self._chunk_text(content)
        if not chunks:
            return
        for i, chunk_content in enumerate(chunks):
            doc_id = f"note_{note_id}_chunk_{i}"
            metadata = {
                "type": note_type,
                "title": title,
                "note_id": note_id,
                "chunk_index": i,
                "entity_type": "note",
                "entity_id": note_id,
            }
            collection.add(
                documents=[chunk_content],
                ids=[doc_id],
                metadatas=[metadata],
            )

    def remove_note_documents(self, universe_id: int, note_id: int) -> None:
        """Удалить все чанки заметки из векторной базы."""
        collection = self.get_collection(universe_id)
        try:
            existing = collection.get(where={"note_id": note_id})
            if existing and existing["ids"]:
                collection.delete(ids=existing["ids"])
        except Exception:
            pass
        try:
            collection.delete(ids=[f"note_{note_id}"])
        except Exception:
            pass

    def add_document(
        self,
        universe_id: int,
        doc_id: str,
        content: str,
        metadata: Optional[Dict] = None
    ):
        """Добавить документ в векторную базу"""
        collection = self.get_collection(universe_id)
        
        # Удаляем старый документ с таким же ID если существует
        try:
            collection.delete(ids=[doc_id])
        except Exception:
            pass
        
        # Добавляем новый документ
        collection.add(
            documents=[content],
            ids=[doc_id],
            metadatas=[metadata or {}]
        )
    
    def remove_document(self, universe_id: int, doc_id: str):
        """Удалить документ из векторной базы"""
        collection = self.get_collection(universe_id)
        try:
            collection.delete(ids=[doc_id])
        except Exception:
            pass
    
    def search(
        self,
        universe_id: int,
        query: str,
        n_results: int = 5
    ) -> List[Dict]:
        """Найти релевантные документы. При ошибке «collection does not exist» сбрасывает кэш и повторяет."""
        try:
            return self._search_impl(universe_id, query, n_results)
        except Exception as e:
            if "does not exist" in str(e).lower():
                self._invalidate_collection_cache(universe_id)
                return self._search_impl(universe_id, query, n_results)
            raise

    def _search_impl(
        self,
        universe_id: int,
        query: str,
        n_results: int = 5
    ) -> List[Dict]:
        """Внутренняя реализация поиска по коллекции."""
        collection = self.get_collection(universe_id)

        results = collection.query(
            query_texts=[query],
            n_results=n_results
        )

        documents = []
        if results.get("documents") and results["documents"][0]:
            for i, doc in enumerate(results["documents"][0]):
                doc_info = {
                    "content": doc,
                    "id": results["ids"][0][i] if results.get("ids") else "",
                    "metadata": results["metadatas"][0][i] if results.get("metadatas") else {},
                    "distance": results["distances"][0][i] if results.get("distances") else 0,
                }
                documents.append(doc_info)

        return documents
    
    async def search_with_context_async(
        self,
        universe_id: int,
        query: str,
        n_results: int = 5,
        character_id: Optional[int] = None,
        db: Optional[Any] = None,
        before_universe_year: Optional[int] = None,
        before_universe_day: Optional[int] = None,
    ) -> str:
        """Найти и вернуть контекст для ИИ (асинхронная обёртка)."""
        # ChromaDB запросы пока синхронные
        results = self.search(universe_id, query, n_results)
        if not results:
            return ""

        if character_id is not None and db is not None:
            try:
                from app.services.character_context import get_character_accessible_entity_set
                # get_character_accessible_entity_set теперь асинхронный
                allowed = await get_character_accessible_entity_set(
                    db, character_id, universe_id, before_universe_year, before_universe_day
                )
                filtered = []
                for result in results:
                    meta = result.get("metadata") or {}
                    etype = meta.get("entity_type")
                    eid = meta.get("entity_id")
                    if etype is None and eid is None:
                        filtered.append(result)
                    elif etype == "book":
                        filtered.append(result)
                    elif etype is not None and eid is not None and (etype, int(eid)) in allowed:
                        filtered.append(result)
                results = filtered
            except Exception as e:
                print(f"[RAG] Error filtering results: {e}")
                pass

        if not results:
            return ""

        context_parts = []
        for result in results:
            meta = result["metadata"]
            context_parts.append(
                f"[{meta.get('type', 'unknown')}: {meta.get('title', 'unnamed')}]\n{result['content']}"
            )
        return "\n\n".join(context_parts)
    
    def clear_universe(self, universe_id: int):
        """Очистить все документы вселенной"""
        client = self.get_client(universe_id)
        try:
            client.delete_collection(name=f"universe_{universe_id}")
        except Exception:
            pass
        if universe_id in self.collections:
            del self.collections[universe_id]
        if universe_id in self.clients:
            del self.clients[universe_id]

# Глобальный экземпляр
rag_service = RAGService()
