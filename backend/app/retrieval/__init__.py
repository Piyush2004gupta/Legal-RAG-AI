"""
Retrieval module - Hybrid retrieval combining cosine-similarity vector search
with keyword scoring and cross-encoder reranking.
"""
from app.retrieval.retriever import HybridRetriever

__all__ = ["HybridRetriever"]
