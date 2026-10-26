"""
Document Ingestion Pipeline - Zero-Database Implementation.
Extracts text from PDF/DOCX/Images, performs chunking with page number tracking,
generates OpenAI embeddings, and persists to LocalDataStore.
"""
import os
import io
import re
import hashlib
import uuid
from pathlib import Path
from typing import Optional, List, Dict
import structlog
try:
    import fitz
except Exception:
    fitz = None
from pypdf import PdfReader
from docx import Document as DocxDocument

from app.core.config import settings
from app.core.store import LocalDataStore, store, now_iso
from app.core.openai_client import create_embeddings

log = structlog.get_logger()

DOCUMENT_TYPE_KEYWORDS = {
    "FIR": ["first information report", "f.i.r", "fir no", "police station", "section 154"],
    "ChargeSheet": ["charge sheet", "chargesheet", "challan", "charge framed", "accused"],
    "Judgment": ["judgment", "judgement", "order", "court", "bench", "respondent", "appellant", "disposed", "dismissed", "allowed", "held"],
    "Petition": ["petition", "writ", "habeas corpus", "mandamus", "certiorari", "petitioner"],
    "Evidence": ["exhibit", "evidence", "affidavit", "deposition", "witness", "sworn"],
    "Contract": ["agreement", "contract", "parties agree", "consideration", "terms and conditions"],
    "CourtOrder": ["order dated", "in the matter of", "vs", "versus", "interim order", "stay order"],
    "BailApplication": ["bail", "anticipatory bail", "section 437", "section 438"],
    "LegalNotice": ["legal notice", "notice", "demand", "take notice", "advocate"],
}


class DocumentIngestionPipeline:
    def __init__(self, datastore: Optional[LocalDataStore] = None):
        self.store = datastore or store
        self.storage_root = Path(settings.STORAGE_PATH)
        self.storage_root.mkdir(parents=True, exist_ok=True)

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
        """Main document processing entry point."""
        doc = self.store.get_document(document_id)
        if not doc:
            raise ValueError(f"Document {document_id} not found")

        self.store.update_document(document_id, {
            "processing_status": "processing",
            "processing_started_at": now_iso(),
            "processing_error": None,
        })

        try:
            file_path = Path(doc["file_path"])
            mime_type = doc.get("mime_type", "application/pdf")

            # 1. Extract pages
            pages = await self._extract_pages(file_path, mime_type, doc)
            self.store.add_pages(pages)

            # 2. Classify document type if not provided
            doc_type = doc.get("document_type")
            if not doc_type or doc_type == "Unknown":
                full_text = " ".join(p["clean_text"] for p in pages[:3])
                doc_type = self._classify_document(full_text)

            # 3. Create chunks
            chunks = self._chunk_pages(pages, doc, doc_type)

            # 4. Generate embeddings via OpenAI
            if chunks:
                chunk_texts = [c["chunk_text"] for c in chunks]
                embeddings = await create_embeddings(chunk_texts)
                for c, emb in zip(chunks, embeddings):
                    c["embedding"] = emb

                self.store.add_chunks(chunks)

            # 5. Update document status
            self.store.update_document(document_id, {
                "processing_status": "completed",
                "page_count": len(pages),
                "document_type": doc_type,
                "processing_completed_at": now_iso(),
            })

            log.info("Document processing completed", doc_id=document_id, pages=len(pages), chunks=len(chunks))
            return {"status": "completed", "pages": len(pages), "chunks": len(chunks)}

        except Exception as e:
            log.error("Document processing failed", doc_id=document_id, error=str(e), exc_info=True)
            self.store.update_document(document_id, {
                "processing_status": "failed",
                "processing_error": str(e),
                "processing_completed_at": now_iso(),
            })
            raise

    async def _extract_pages(self, file_path: Path, mime_type: str, doc: dict) -> List[dict]:
        pages = []
        if mime_type == "application/pdf" or file_path.suffix.lower() == ".pdf":
            try:
                reader = PdfReader(str(file_path))
                for page_idx, page in enumerate(reader.pages):
                    text = page.extract_text() or ""
                    clean = re.sub(r"\s+", " ", text).strip()
                    pages.append({
                        "id": str(uuid.uuid4()),
                        "document_id": doc["id"],
                        "case_id": doc["case_id"],
                        "page_number": page_idx + 1,
                        "raw_text": text,
                        "clean_text": clean or f"[Page {page_idx + 1} - Image or scanned content]",
                        "word_count": len(clean.split()) if clean else 0,
                        "has_images": len(page.images) > 0 if hasattr(page, "images") else False,
                        "ocr_applied": False,
                    })
            except Exception as e:
                log.warning("PDF extraction error", error=str(e))
                pages.append({
                    "id": str(uuid.uuid4()),
                    "document_id": doc["id"],
                    "case_id": doc["case_id"],
                    "page_number": 1,
                    "raw_text": f"[Error reading PDF: {str(e)}]",
                    "clean_text": f"[Error reading PDF: {str(e)}]",
                    "word_count": 0,
                    "has_images": False,
                    "ocr_applied": False,
                })
        elif "wordprocessingml" in mime_type or file_path.suffix.lower() == ".docx":
            docx = DocxDocument(str(file_path))
            full_text = "\n\n".join(p.text for p in docx.paragraphs if p.text.strip())
            pages.append({
                "id": str(uuid.uuid4()),
                "document_id": doc["id"],
                "case_id": doc["case_id"],
                "page_number": 1,
                "raw_text": full_text,
                "clean_text": full_text,
                "word_count": len(full_text.split()),
                "has_images": False,
                "ocr_applied": False,
            })
        else:
            # Fallback text read
            try:
                with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                    content = f.read()
            except Exception:
                content = "[Binary or unreadable content]"
            pages.append({
                "id": str(uuid.uuid4()),
                "document_id": doc["id"],
                "case_id": doc["case_id"],
                "page_number": 1,
                "raw_text": content,
                "clean_text": content,
                "word_count": len(content.split()),
                "has_images": False,
                "ocr_applied": False,
            })

        return pages

    def _classify_document(self, text: str) -> str:
        text_lower = text.lower()
        for doc_type, keywords in DOCUMENT_TYPE_KEYWORDS.items():
            for kw in keywords:
                if kw in text_lower:
                    return doc_type
        return "LegalDocument"

    def _chunk_pages(self, pages: List[dict], doc: dict, doc_type: str) -> List[dict]:
        chunks = []
        chunk_idx = 0

        for p in pages:
            text = p["clean_text"]
            if not text:
                continue

            # Split into legal paragraphs/sections
            paragraphs = [p.strip() for p in text.split("\n") if p.strip()]
            if not paragraphs:
                paragraphs = [text]

            current_chunk = []
            current_words = 0

            for para in paragraphs:
                para_words = len(para.split())
                if current_words + para_words > 400 and current_chunk:
                    chunk_text = " ".join(current_chunk)
                    chunks.append({
                        "id": str(uuid.uuid4()),
                        "document_id": doc["id"],
                        "case_id": doc["case_id"],
                        "chunk_index": chunk_idx,
                        "page_number": p["page_number"],
                        "chunk_text": chunk_text,
                        "token_count": len(chunk_text.split()),
                        "document_type": doc_type,
                    })
                    chunk_idx += 1
                    current_chunk = [para]
                    current_words = para_words
                else:
                    current_chunk.append(para)
                    current_words += para_words

            if current_chunk:
                chunk_text = " ".join(current_chunk)
                chunks.append({
                    "id": str(uuid.uuid4()),
                    "document_id": doc["id"],
                    "case_id": doc["case_id"],
                    "chunk_index": chunk_idx,
                    "page_number": p["page_number"],
                    "chunk_text": chunk_text,
                    "token_count": len(chunk_text.split()),
                    "document_type": doc_type,
                })
                chunk_idx += 1

        return chunks
