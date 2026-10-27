"""
Chunking module - Splits extracted document pages into overlapping chunks
suitable for embedding and retrieval.
"""
from app.chunking.chunker import LegalDocumentChunker

__all__ = ["LegalDocumentChunker"]
