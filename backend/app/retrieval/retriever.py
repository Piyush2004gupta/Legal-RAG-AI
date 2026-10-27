"""
HybridRetriever
===============
Combines vector similarity search (via VectorStore) with BM25-style keyword
scoring to produce a ranked list of the most relevant document chunks for a
legal query.

Ranking strategy
----------------
  final_score = α × cosine_similarity + (1 - α) × keyword_score

where α (vector_weight) defaults to 0.7.  The blend ensures:
  • Semantic matches surface even when exact terms differ.
  • Exact Indian Penal Code section numbers / party names still boost results.

Post-retrieval reranking
------------------------
After the hybrid scores are computed, an optional reciprocal-rank-fusion step
combines the cosine rank and keyword rank lists before returning top-k.

All results include a 'similarity_score' and a 'keyword_score' for debugging.
"""
import re
import math
from typing import List, Optional, Dict
import structlog

from app.core.config import settings
from app.core.store import LocalDataStore, store as _default_store
from app.vectorstore.store import VectorStore

log = structlog.get_logger()

# ---------------------------------------------------------------------------
# Keyword scoring helpers
# ---------------------------------------------------------------------------

def _tokenize(text: str) -> List[str]:
    """Lower-case word tokens, length ≥ 2."""
    return [w for w in re.findall(r"\w+", text.lower()) if len(w) >= 2]


def _keyword_score(chunk_text: str, query_tokens: List[str]) -> float:
    """
    Normalised keyword-overlap score in [0, 1].
    Uses term frequency (not IDF) — lightweight and fast for in-memory use.
    """
    if not query_tokens:
        return 0.0
    chunk_tokens = set(_tokenize(chunk_text))
    hits = sum(1 for t in query_tokens if t in chunk_tokens)
    return hits / len(query_tokens)


# ---------------------------------------------------------------------------
# Reciprocal Rank Fusion
# ---------------------------------------------------------------------------

def _rrf(rankings: List[List[str]], k: int = 60) -> Dict[str, float]:
    """
    Combine multiple ranked lists of chunk IDs using Reciprocal Rank Fusion.
    Returns a dict {chunk_id: rrf_score}.
    """
    scores: Dict[str, float] = {}
    for ranking in rankings:
        for rank, chunk_id in enumerate(ranking, start=1):
            scores[chunk_id] = scores.get(chunk_id, 0.0) + 1.0 / (k + rank)
    return scores


# ---------------------------------------------------------------------------
# Main retriever class
# ---------------------------------------------------------------------------

class HybridRetriever:
    """
    Hybrid vector + keyword retriever for legal document chunks.

    Parameters
    ----------
    datastore     : optional LocalDataStore; uses global singleton by default
    vector_weight : weight given to cosine similarity vs keyword score (0–1)
    use_rrf       : if True, apply Reciprocal Rank Fusion on top of hybrid scores
    """

    def __init__(
        self,
        datastore: Optional[LocalDataStore] = None,
        vector_weight: float = 0.70,
        use_rrf: bool = True,
    ):
        self._store = datastore or _default_store
        self._vector_store = VectorStore(datastore=self._store)
        self.vector_weight = vector_weight
        self.keyword_weight = 1.0 - vector_weight
        self.use_rrf = use_rrf

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    async def retrieve(
        self,
        query: str,
        query_embedding: List[float],
        case_id: str,
        top_k: int = None,
        min_similarity: float = None,
        doc_ids: Optional[List[str]] = None,
    ) -> List[dict]:
        """
        Retrieve the top-k most relevant chunks for *query* within *case_id*.

        Parameters
        ----------
        query           : raw text of the user's question
        query_embedding : pre-computed embedding for *query*
        case_id         : restrict retrieval to this case
        top_k           : number of chunks to return (default: settings.TOP_K_RERANK)
        min_similarity  : discard chunks below this cosine score
        doc_ids         : optional allowlist of document IDs

        Returns
        -------
        Ranked list of chunk dicts, each with 'similarity_score',
        'keyword_score', and 'hybrid_score' keys.
        """
        top_k = top_k or settings.TOP_K_RERANK
        min_sim = min_similarity if min_similarity is not None else settings.SIMILARITY_THRESHOLD
        retrieval_k = max(top_k * 3, settings.TOP_K_RETRIEVAL)  # over-retrieve then rerank

        query_tokens = _tokenize(query)

        # 1. Vector search
        vector_hits = self._vector_store.search(
            query_embedding=query_embedding,
            case_id=case_id,
            top_k=retrieval_k,
            min_similarity=min_sim,
            doc_ids=doc_ids,
        )

        if not vector_hits:
            log.info("HybridRetriever: no vector hits", case_id=case_id, query=query[:80])
            return []

        # 2. Hybrid scoring
        for chunk in vector_hits:
            kw_score = _keyword_score(chunk.get("chunk_text", ""), query_tokens)
            vec_score = chunk.get("similarity_score", 0.0)
            chunk["keyword_score"] = round(kw_score, 4)
            chunk["hybrid_score"] = round(
                self.vector_weight * vec_score + self.keyword_weight * kw_score, 4
            )

        # 3. Optional RRF reranking
        if self.use_rrf:
            vector_rank = [c["id"] for c in vector_hits]
            keyword_rank = sorted(
                [c["id"] for c in vector_hits],
                key=lambda cid: next(
                    (c["keyword_score"] for c in vector_hits if c["id"] == cid), 0
                ),
                reverse=True,
            )
            rrf_scores = _rrf([vector_rank, keyword_rank])
            chunk_map = {c["id"]: c for c in vector_hits}
            results = sorted(
                vector_hits,
                key=lambda c: rrf_scores.get(c["id"], 0),
                reverse=True,
            )
        else:
            results = sorted(vector_hits, key=lambda c: c["hybrid_score"], reverse=True)

        final = results[:top_k]
        log.info(
            "HybridRetriever: retrieval complete",
            case_id=case_id,
            candidates=len(vector_hits),
            returned=len(final),
            top_hybrid=final[0]["hybrid_score"] if final else 0,
        )
        return final

    # ------------------------------------------------------------------
    # Convenience: keyword-only search (no embedding required)
    # ------------------------------------------------------------------

    def keyword_search(
        self,
        query: str,
        case_id: str,
        top_k: int = 10,
        doc_ids: Optional[List[str]] = None,
    ) -> List[dict]:
        """
        Pure keyword search — useful when embeddings are unavailable (e.g.,
        during ingestion before the embedding step completes).
        """
        query_tokens = _tokenize(query)
        chunks = self._store.get_chunks_by_case(case_id=case_id)
        scored = []
        for chunk in chunks:
            if doc_ids and chunk.get("document_id") not in doc_ids:
                continue
            score = _keyword_score(chunk.get("chunk_text", ""), query_tokens)
            if score > 0:
                scored.append({**chunk, "keyword_score": round(score, 4), "similarity_score": 0.0})
        scored.sort(key=lambda c: c["keyword_score"], reverse=True)
        return scored[:top_k]
