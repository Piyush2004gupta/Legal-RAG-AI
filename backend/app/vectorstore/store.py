"""
VectorStore
===========
A lightweight, zero-dependency in-memory vector store built on top of the
existing LocalDataStore.  It provides a clean add / search interface that
mirrors what you'd expect from a production vector database (Pinecone, Qdrant,
Weaviate, etc.) so the rest of the pipeline doesn't have to know about the
underlying data structure.

Similarity search
-----------------
Uses normalised cosine similarity computed in pure Python — suitable for
thousands of chunks per case (typical for Indian legal documents).  If you
later want to swap in FAISS or another ANN library, only this file changes.

Thread safety
-------------
All mutations go through LocalDataStore which uses a threading.RLock, so this
class is safe to use from multiple async worker tasks.
"""
import math
from typing import List, Optional, Dict, Any
import structlog

from app.core.store import LocalDataStore, store as _default_store
from app.core.config import settings

log = structlog.get_logger()


def _dot(a: List[float], b: List[float]) -> float:
    return sum(x * y for x, y in zip(a, b))


def _norm(v: List[float]) -> float:
    return math.sqrt(sum(x * x for x in v)) or 1e-9


def _cosine(a: List[float], b: List[float]) -> float:
    if not a or not b:
        return 0.0
    return _dot(a, b) / (_norm(a) * _norm(b))


class VectorStore:
    """
    Wraps LocalDataStore with a clean vector-search interface.

    Parameters
    ----------
    datastore : optional LocalDataStore instance; uses the global singleton
                by default so no separate state is maintained.
    """

    def __init__(self, datastore: Optional[LocalDataStore] = None):
        self._store = datastore or _default_store

    # ------------------------------------------------------------------
    # Write path
    # ------------------------------------------------------------------

    def add_chunks(self, chunks: List[dict]) -> None:
        """
        Persist a list of chunk dicts (must already contain 'embedding' vectors).
        Delegates to LocalDataStore so the single source of truth is unchanged.
        """
        if not chunks:
            return
        self._store.add_chunks(chunks)
        log.debug("VectorStore: added chunks", count=len(chunks))

    def upsert_chunk(self, chunk: dict) -> None:
        """Add or replace a single chunk (identified by its 'id')."""
        self._store.add_chunks([chunk])

    # ------------------------------------------------------------------
    # Read / search path
    # ------------------------------------------------------------------

    def search(
        self,
        query_embedding: List[float],
        case_id: str,
        top_k: int = 10,
        min_similarity: float = 0.0,
        doc_ids: Optional[List[str]] = None,
        document_type: Optional[str] = None,
    ) -> List[dict]:
        """
        Pure cosine-similarity vector search over all chunks for *case_id*.

        Parameters
        ----------
        query_embedding : embedding vector for the query
        case_id         : restrict search to this case's chunks
        top_k           : return at most this many results
        min_similarity  : discard results below this score (0–1)
        doc_ids         : optional allowlist of document IDs
        document_type   : optional filter by document type string

        Returns
        -------
        List of chunk dicts sorted by similarity (highest first), each
        augmented with a 'similarity_score' key.
        """
        all_chunks: List[dict] = self._store.get_chunks_by_case(case_id=case_id)

        scored: List[tuple] = []
        for chunk in all_chunks:
            # Optional filters
            if doc_ids and chunk.get("document_id") not in doc_ids:
                continue
            if document_type and chunk.get("document_type") != document_type:
                continue

            emb = chunk.get("embedding") or []
            if not emb:
                continue

            score = _cosine(query_embedding, emb)
            if score >= min_similarity:
                scored.append((score, chunk))

        scored.sort(key=lambda t: t[0], reverse=True)
        results = []
        for score, chunk in scored[:top_k]:
            results.append({**chunk, "similarity_score": round(score, 4)})

        log.debug(
            "VectorStore search",
            case_id=case_id,
            candidates=len(all_chunks),
            results=len(results),
            top_score=round(scored[0][0], 4) if scored else 0,
        )
        return results

    def delete_document(self, document_id: str) -> bool:
        """
        Remove a document and all its associated chunks (delegates to LocalDataStore).
        Returns True if the document existed.
        """
        return self._store.delete_document(document_id)

    # ------------------------------------------------------------------
    # Stats
    # ------------------------------------------------------------------

    def stats(self, case_id: str) -> Dict[str, Any]:
        """Return basic statistics about the vector index for a case."""
        chunks = self._store.get_chunks_by_case(case_id=case_id)
        embedded = [c for c in chunks if c.get("embedding")]
        return {
            "case_id": case_id,
            "total_chunks": len(chunks),
            "embedded_chunks": len(embedded),
            "coverage_pct": round(len(embedded) / max(len(chunks), 1) * 100, 1),
        }
