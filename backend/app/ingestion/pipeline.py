"""
High-Capacity Document Ingestion Pipeline for LegalDesk AI
==========================================================
Engineered specifically for massive legal files (5000+ pages, trial bundles,
voluminous chargesheets, and extensive court proceedings).

Architecture Highlights:
1. Streaming Extraction:
   - Reads page-by-page from disk without accumulating all raw page objects in memory.
   - Saves intermediate progress so user sees exact status ("Page 1400 / 5200 indexed").

2. Chunk-Batch Pacing:
   - Chunks are extracted per batch of pages (50 pages at a time).
   - Embeddings are generated in micro-batches with rate-limit backoff.
   - Chunks and pages are committed progressively to disk store.

3. Low Memory Footprint:
   - Does not store megabytes of redundant text copies in memory.
   - Cleans up garbage collection cycles during massive document runs.
"""
import os
import io
import re
import gc
import uuid
import asyncio
from pathlib import Path
from typing import Optional, List, Dict
import structlog
from pypdf import PdfReader
from docx import Document as DocxDocument

from app.core.config import settings
from app.core.store import LocalDataStore, store, now_iso
from app.core.openai_client import create_embeddings
from app.chunking.chunker import LegalDocumentChunker

log = structlog.get_logger()

DOCUMENT_TYPE_KEYWORDS = {
    "FIR": ["first information report", "f.i.r", "fir no", "police station", "section 154"],
    "ChargeSheet": ["charge sheet", "chargesheet", "challan", "charge framed", "accused", "final report"],
    "Judgment": ["judgment", "judgement", "order", "court", "bench", "respondent", "appellant", "disposed", "dismissed", "allowed", "held"],
    "Petition": ["petition", "writ", "habeas corpus", "mandamus", "certiorari", "petitioner", "special leave"],
    "Evidence": ["exhibit", "evidence", "affidavit", "deposition", "witness", "sworn", "cross-examination"],
    "Contract": ["agreement", "contract", "parties agree", "consideration", "terms and conditions", "indemnity"],
    "CourtOrder": ["order dated", "in the matter of", "vs", "versus", "interim order", "stay order"],
    "BailApplication": ["bail", "anticipatory bail", "section 437", "section 438", "section 439", "regular bail"],
    "LegalNotice": ["legal notice", "notice", "demand", "take notice", "advocate", "under section 138"],
}


class DocumentIngestionPipeline:
    def __init__(self, datastore: Optional[LocalDataStore] = None):
        self.store = datastore or store
        self.storage_root = Path(settings.STORAGE_PATH)
        self.storage_root.mkdir(parents=True, exist_ok=True)
        self.chunker = LegalDocumentChunker(
            chunk_size=settings.CHUNK_SIZE,
            chunk_overlap=settings.CHUNK_OVERLAP,
        )

    async def save_file(
        self,
        case_id: str,
        document_id: str,
        original_filename: str,
        content: bytes,
    ) -> Path:
        case_dir = self.storage_root / "documents" / case_id
        case_dir.mkdir(parents=True, exist_ok=True)
        safe_name = re.sub(r"[^\w\.-]", "_", original_filename)
        file_path = case_dir / f"{document_id}_{safe_name}"
        with open(file_path, "wb") as f:
            f.write(content)
        return file_path

    async def process_document(self, document_id: str) -> dict:
        """
        High-scale document processing entry point.
        Processes documents in streaming batches of 50 pages at a time to effortlessly
        support 5000+ page legal files without memory exhaustion or timeouts.
        """
        doc = self.store.get_document(document_id)
        if not doc:
            raise ValueError(f"Document {document_id} not found")

        self.store.update_document(document_id, {
            "processing_status": "processing",
            "processing_started_at": now_iso(),
            "processing_error": None,
            "processed_pages": 0,
            "total_pages": 0,
        })

        try:
            file_path = Path(doc["file_path"])
            mime_type = doc.get("mime_type", "application/pdf")
            is_pdf = mime_type == "application/pdf" or file_path.suffix.lower() == ".pdf"

            total_pages = 0
            total_chunks = 0
            doc_type = doc.get("document_type") or "Unknown"

            if is_pdf:
                # Streaming PDF extraction with pypdf
                reader = PdfReader(str(file_path))
                total_pages = len(reader.pages)
                self.store.update_document(document_id, {
                    "total_pages": total_pages,
                    "processing_progress": f"0 / {total_pages} pages (0%)",
                })
                log.info("Starting large PDF ingestion", doc_id=document_id, total_pages=total_pages)

                PAGE_BATCH_SIZE = 50
                first_pages_text = []

                for start_idx in range(0, total_pages, PAGE_BATCH_SIZE):
                    end_idx = min(start_idx + PAGE_BATCH_SIZE, total_pages)
                    batch_pages = []

                    for page_idx in range(start_idx, end_idx):
                        try:
                            page_obj = reader.pages[page_idx]
                            raw_text = page_obj.extract_text() or ""
                            clean = re.sub(r"\s+", " ", raw_text).strip()
                            clean_text = clean or f"[Page {page_idx + 1} - Scanned or tabular content]"
                            
                            if len(first_pages_text) < 3 and clean:
                                first_pages_text.append(clean)

                            batch_pages.append({
                                "id": str(uuid.uuid4()),
                                "document_id": doc["id"],
                                "case_id": doc["case_id"],
                                "page_number": page_idx + 1,
                                "raw_text": raw_text[:4000],  # trim raw text to save RAM
                                "clean_text": clean_text,
                                "word_count": len(clean.split()) if clean else 0,
                                "has_images": False,
                                "ocr_applied": False,
                            })
                        except Exception as page_err:
                            log.warning("Page extraction minor error", page_idx=page_idx, err=str(page_err))
                            batch_pages.append({
                                "id": str(uuid.uuid4()),
                                "document_id": doc["id"],
                                "case_id": doc["case_id"],
                                "page_number": page_idx + 1,
                                "raw_text": f"[Page {page_idx + 1} extraction error]",
                                "clean_text": f"[Page {page_idx + 1} extraction error]",
                                "word_count": 0,
                                "has_images": False,
                                "ocr_applied": False,
                            })

                    # If document_type was Unknown, classify using initial pages
                    if doc_type in ["Unknown", "Other", None] and first_pages_text:
                        doc_type = self._classify_document(" ".join(first_pages_text))

                    # 1. Store pages for this batch
                    self.store.add_pages(batch_pages)

                    # 2. Chunk this batch of pages
                    batch_chunks = self.chunker.chunk_pages(
                        pages=batch_pages,
                        document_id=doc["id"],
                        case_id=doc["case_id"],
                        document_type=doc_type,
                    )

                    # 3. Embed batch chunks
                    if batch_chunks:
                        chunk_texts = [c["chunk_text"] for c in batch_chunks]
                        embeddings = await create_embeddings(chunk_texts)
                        for c, emb in zip(batch_chunks, embeddings):
                            c["embedding"] = emb

                        self.store.add_chunks(batch_chunks)
                        total_chunks += len(batch_chunks)

                    # Update live progress
                    pct = int((end_idx / total_pages) * 100)
                    self.store.update_document(document_id, {
                        "processed_pages": end_idx,
                        "document_type": doc_type,
                        "processing_progress": f"{end_idx} / {total_pages} pages ({pct}%)",
                    })
                    log.info("Ingestion batch completed", doc_id=document_id, progress=f"{end_idx}/{total_pages}", chunks=total_chunks)

                    # Force memory cleanup on large runs
                    del batch_pages
                    del batch_chunks
                    gc.collect()
                    await asyncio.sleep(0.05)

            elif "wordprocessingml" in mime_type or file_path.suffix.lower() == ".docx":
                docx = DocxDocument(str(file_path))
                paragraphs = [p.text for p in docx.paragraphs if p.text.strip()]
                full_text = "\n\n".join(paragraphs)
                total_pages = max(1, len(paragraphs) // 10)

                doc_type = self._classify_document(full_text[:2000]) if doc_type in ["Unknown", "Other", None] else doc_type

                page_obj = {
                    "id": str(uuid.uuid4()),
                    "document_id": doc["id"],
                    "case_id": doc["case_id"],
                    "page_number": 1,
                    "raw_text": full_text[:20000],
                    "clean_text": full_text,
                    "word_count": len(full_text.split()),
                    "has_images": False,
                    "ocr_applied": False,
                }
                self.store.add_pages([page_obj])
                chunks = self.chunker.chunk_pages([page_obj], doc["id"], doc["case_id"], doc_type)
                if chunks:
                    chunk_texts = [c["chunk_text"] for c in chunks]
                    embeddings = await create_embeddings(chunk_texts)
                    for c, emb in zip(chunks, embeddings):
                        c["embedding"] = emb
                    self.store.add_chunks(chunks)
                    total_chunks = len(chunks)

            else:
                # Fallback text read
                try:
                    with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                        content = f.read()
                except Exception:
                    content = "[Binary or unreadable content]"

                total_pages = 1
                doc_type = self._classify_document(content[:2000]) if doc_type in ["Unknown", "Other", None] else doc_type
                page_obj = {
                    "id": str(uuid.uuid4()),
                    "document_id": doc["id"],
                    "case_id": doc["case_id"],
                    "page_number": 1,
                    "raw_text": content[:20000],
                    "clean_text": content,
                    "word_count": len(content.split()),
                    "has_images": False,
                    "ocr_applied": False,
                }
                self.store.add_pages([page_obj])
                chunks = self.chunker.chunk_pages([page_obj], doc["id"], doc["case_id"], doc_type)
                if chunks:
                    chunk_texts = [c["chunk_text"] for c in chunks]
                    embeddings = await create_embeddings(chunk_texts)
                    for c, emb in zip(chunks, embeddings):
                        c["embedding"] = emb
                    self.store.add_chunks(chunks)
                    total_chunks = len(chunks)

            # Finalize Document Status
            self.store.update_document(document_id, {
                "processing_status": "completed",
                "page_count": total_pages,
                "total_pages": total_pages,
                "processed_pages": total_pages,
                "chunk_count": total_chunks,
                "document_type": doc_type,
                "processing_progress": f"{total_pages} / {total_pages} pages (100%)",
                "processing_completed_at": now_iso(),
            })

            log.info("Document processing fully completed", doc_id=document_id, pages=total_pages, total_chunks=total_chunks)
            return {"status": "completed", "pages": total_pages, "chunks": total_chunks}

        except Exception as e:
            log.error("Document processing failed", doc_id=document_id, error=str(e), exc_info=True)
            self.store.update_document(document_id, {
                "processing_status": "failed",
                "processing_error": str(e),
                "processing_completed_at": now_iso(),
            })
            raise

    def _classify_document(self, text: str) -> str:
        text_lower = text.lower()
        for doc_type, keywords in DOCUMENT_TYPE_KEYWORDS.items():
            for kw in keywords:
                if kw in text_lower:
                    return doc_type
        return "LegalDocument"
