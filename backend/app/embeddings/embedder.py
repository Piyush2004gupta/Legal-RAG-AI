"""
EmbeddingService
================
Thin, reusable wrapper around the OpenAI embeddings API that adds:
  - Automatic batching (≤ 100 texts per API call)
  - In-process LRU cache keyed on text content (avoids re-embedding duplicate
    chunks across documents in the same process lifetime)
  - Retry with exponential back-off (via tenacity, consistent with openai_client)
  - Sanitisation of null bytes and truncation to 8 000 chars per chunk

The service is stateless — instantiate once and call embed_texts() / embed_query()
from anywhere in the pipeline.
"""
import hashlib
from functools import lru_cache
from typing import List, Dict, Tuple
import structlog

from app.core.config import settings
from app.core.openai_client import create_embeddings

log = structlog.get_logger()

# ---------------------------------------------------------------------------
# Simple in-process text → embedding cache (hash → embedding vector)
# ---------------------------------------------------------------------------
_CACHE: Dict[str, List[float]] = {}
_MAX_CACHE_SIZE = 10_000


def _cache_key(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8", errors="replace")).hexdigest()


class EmbeddingService:
    """
    Generates OpenAI embeddings for document chunks and queries.

    Usage
    -----
    service = EmbeddingService()
    vectors = await service.embed_texts(["text a", "text b"])
    query_vec = await service.embed_query("what is the bail condition?")
    """

    def __init__(self, use_cache: bool = True):
        self.use_cache = use_cache
        self.model = settings.OPENAI_EMBEDDING_MODEL
        self.dimensions = settings.OPENAI_EMBEDDING_DIMENSIONS

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    async def embed_texts(self, texts: List[str]) -> List[List[float]]:
        """
        Embed a list of text strings, returning one vector per string.
        Hits the local cache first; only sends uncached texts to OpenAI.
        """
        if not texts:
            return []

        hits: Dict[int, List[float]] = {}
        misses: List[Tuple[int, str]] = []  # (original_index, text)

        if self.use_cache:
            for idx, text in enumerate(texts):
                key = _cache_key(text)
                if key in _CACHE:
                    hits[idx] = _CACHE[key]
                else:
                    misses.append((idx, text))
        else:
            misses = list(enumerate(texts))

        # Fetch missing embeddings from OpenAI
        if misses:
            miss_texts = [t for _, t in misses]
            new_vectors = await create_embeddings(miss_texts)

            # Populate cache
            for (orig_idx, text), vec in zip(misses, new_vectors):
                key = _cache_key(text)
                if self.use_cache and len(_CACHE) < _MAX_CACHE_SIZE:
                    _CACHE[key] = vec
                hits[orig_idx] = vec

        # Rebuild in original order
        result = [hits[i] for i in range(len(texts))]
        log.debug(
            "Embeddings generated",
            total=len(texts),
            cache_hits=len(texts) - len(misses),
            api_calls=len(misses),
        )
        return result

    async def embed_query(self, query: str) -> List[float]:
        """Embed a single query string and return its vector."""
        vectors = await self.embed_texts([query])
        return vectors[0] if vectors else []

    async def embed_chunks(self, chunks: List[dict]) -> List[dict]:
        """
        Attach embeddings directly to a list of chunk dicts (in-place).

        Expects each chunk to have a 'chunk_text' key.
        Sets the 'embedding' key on every chunk.
        Returns the same list for chaining.
        """
        texts = [c.get("chunk_text", "") for c in chunks]
        vectors = await self.embed_texts(texts)
        for chunk, vec in zip(chunks, vectors):
            chunk["embedding"] = vec
        return chunks

    # ------------------------------------------------------------------
    # Cache management
    # ------------------------------------------------------------------

    @staticmethod
    def clear_cache() -> None:
        """Purge the in-process embedding cache."""
        _CACHE.clear()
        log.info("Embedding cache cleared")

    @staticmethod
    def cache_size() -> int:
        return len(_CACHE)
