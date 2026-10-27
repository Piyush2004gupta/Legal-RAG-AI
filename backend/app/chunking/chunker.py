"""
LegalDocumentChunker
====================
Splits a list of extracted document pages into overlapping text chunks that
respect natural legal-document boundaries (paragraphs, numbered sections,
headings) so that embedding & retrieval produce coherent snippets.

Key features
------------
- Paragraph / section-boundary aware splitting (avoids cutting mid-sentence).
- Sliding-window overlap so context is not lost at chunk boundaries.
- Configurable chunk_size (words) and overlap (words) pulled from settings.
- Returns plain dicts ready to be stored in LocalDataStore / VectorStore.
"""
import re
import uuid
from typing import List, Dict, Optional

import structlog

from app.core.config import settings

log = structlog.get_logger()

# Regex patterns that mark the start of a new logical section in Indian legal docs
_SECTION_BREAK_RE = re.compile(
    r"""
    (?:^|\n)                          # line start
    (?:
        \d{1,3}\.[\s\t]              |  # "12. Heading"
        [A-Z]{2,}[\s\t]             |  # "WHEREAS"
        (?:Section|Clause|Article|Para|Order|Rule)\s+\d  # "Section 3"
    )
    """,
    re.VERBOSE,
)


class LegalDocumentChunker:
    """
    Splits extracted pages into overlapping word-window chunks.

    Parameters
    ----------
    chunk_size   : maximum words per chunk (default: settings.CHUNK_SIZE)
    chunk_overlap: words shared between consecutive chunks (default: settings.CHUNK_OVERLAP)
    """

    def __init__(
        self,
        chunk_size: Optional[int] = None,
        chunk_overlap: Optional[int] = None,
    ):
        self.chunk_size = chunk_size or settings.CHUNK_SIZE
        self.chunk_overlap = chunk_overlap or settings.CHUNK_OVERLAP

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def chunk_pages(
        self,
        pages: List[dict],
        document_id: str,
        case_id: str,
        document_type: str = "LegalDocument",
    ) -> List[dict]:
        """
        Convert a list of page dicts (each with 'clean_text' and 'page_number')
        into a flat list of chunk dicts ready for embedding.

        Returns
        -------
        List of chunk dicts with keys:
            id, document_id, case_id, chunk_index, page_number,
            chunk_text, token_count, document_type
        """
        chunks: List[dict] = []
        chunk_idx = 0

        for page in pages:
            text = (page.get("clean_text") or "").strip()
            page_num = page.get("page_number", 1)
            if not text:
                continue

            page_chunks = self._split_text(text)
            for chunk_text in page_chunks:
                if not chunk_text.strip():
                    continue
                chunks.append(
                    {
                        "id": str(uuid.uuid4()),
                        "document_id": document_id,
                        "case_id": case_id,
                        "chunk_index": chunk_idx,
                        "page_number": page_num,
                        "chunk_text": chunk_text.strip(),
                        "token_count": len(chunk_text.split()),
                        "document_type": document_type,
                        "embedding": [],          # filled in by EmbeddingService
                    }
                )
                chunk_idx += 1

        log.debug(
            "Chunking complete",
            document_id=document_id,
            pages=len(pages),
            chunks=len(chunks),
            chunk_size=self.chunk_size,
            overlap=self.chunk_overlap,
        )
        return chunks

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _split_text(self, text: str) -> List[str]:
        """
        Split *text* into overlapping word-window chunks.

        Strategy
        --------
        1. First try to split on natural section breaks (numbered headings etc.)
        2. Within each section, apply a sliding word window with *chunk_overlap*.
        3. If a paragraph fits inside one chunk, keep it whole to preserve coherence.
        """
        paragraphs = self._split_paragraphs(text)
        windows: List[str] = []
        current_words: List[str] = []

        for para in paragraphs:
            para_words = para.split()
            if not para_words:
                continue

            # If adding this paragraph would exceed the limit, emit current buffer
            if current_words and (len(current_words) + len(para_words) > self.chunk_size):
                windows.append(" ".join(current_words))
                # Slide: keep the last *chunk_overlap* words as prefix for next chunk
                current_words = current_words[-self.chunk_overlap:] if self.chunk_overlap else []

            current_words.extend(para_words)

            # Hard split for very long single paragraphs
            while len(current_words) >= self.chunk_size:
                windows.append(" ".join(current_words[: self.chunk_size]))
                current_words = current_words[self.chunk_size - self.chunk_overlap:]

        if current_words:
            windows.append(" ".join(current_words))

        return windows

    def _split_paragraphs(self, text: str) -> List[str]:
        """
        Split on blank lines OR legal section-break patterns.
        Falls back to single-sentence splitting for very dense text.
        """
        # Try blank-line split first
        paras = [p.strip() for p in re.split(r"\n{2,}", text) if p.strip()]
        if len(paras) > 1:
            return paras

        # Try section-break patterns
        parts = _SECTION_BREAK_RE.split(text)
        paras = [p.strip() for p in parts if p.strip()]
        if len(paras) > 1:
            return paras

        # Fall back to newline split
        paras = [p.strip() for p in text.split("\n") if p.strip()]
        return paras if paras else [text]
