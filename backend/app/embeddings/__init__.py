"""
Embeddings module - Wraps OpenAI embedding generation with batching,
caching, and retry logic.
"""
from app.embeddings.embedder import EmbeddingService

__all__ = ["EmbeddingService"]
