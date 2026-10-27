"""
VectorStore module - In-memory FAISS-like cosine similarity index built on top
of the LocalDataStore.  Provides a clean add / search interface that can be
swapped for a production vector DB without touching the rest of the pipeline.
"""
from app.vectorstore.store import VectorStore

__all__ = ["VectorStore"]
