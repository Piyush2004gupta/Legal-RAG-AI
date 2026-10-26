"""
Documents API - Upload, list, view, and process legal documents.
Uses FastAPI BackgroundTasks for background ingestion (no Redis required).
"""
import hashlib
import uuid
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, BackgroundTasks
from fastapi.responses import FileResponse
from pathlib import Path

from app.core.store import LocalDataStore, get_store
from app.core.config import settings
from app.ingestion.pipeline import DocumentIngestionPipeline

router = APIRouter()


@router.get("")
async def list_documents(case_id: str, store: LocalDataStore = Depends(get_store)):
    docs = store.list_documents(case_id)
    return docs


@router.post("", status_code=202)
async def upload_document(
    case_id: str,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    document_type: Optional[str] = Form(None),
    store: LocalDataStore = Depends(get_store),
):
    case = store.get_case(case_id)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    content = await file.read()
    if len(content) > settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024:
        raise HTTPException(status_code=413, detail=f"File exceeds max size of {settings.MAX_UPLOAD_SIZE_MB}MB")

    file_hash = hashlib.sha256(content).hexdigest()
    doc_id = str(uuid.uuid4())

    pipeline = DocumentIngestionPipeline(store)
    file_path = await pipeline.save_file(
        case_id=case_id,
        document_id=doc_id,
        original_filename=file.filename or "document.pdf",
        content=content,
    )

    doc = store.create_document({
        "id": doc_id,
        "case_id": case_id,
        "filename": file_path.name,
        "original_filename": file.filename or "document.pdf",
        "file_hash": file_hash,
        "file_path": str(file_path),
        "file_size": len(content),
        "mime_type": file.content_type or "application/pdf",
        "document_type": document_type,
        "processing_status": "processing",
    })

    # Trigger async processing immediately in FastAPI background task
    background_tasks.add_task(pipeline.process_document, doc_id)

    return {
        "id": doc_id,
        "filename": doc["filename"],
        "original_filename": doc["original_filename"],
        "processing_status": "processing",
        "message": "Document uploaded successfully and processing started.",
    }


@router.get("/{document_id}")
async def get_document(case_id: str, document_id: str, store: LocalDataStore = Depends(get_store)):
    doc = store.get_document(document_id)
    if not doc or doc.get("case_id") != case_id:
        raise HTTPException(status_code=404, detail="Document not found")
    return doc


@router.get("/{document_id}/pages/{page_number}")
async def get_document_page(
    case_id: str, document_id: str, page_number: int, store: LocalDataStore = Depends(get_store)
):
    page = store.get_page(document_id, page_number)
    if not page:
        raise HTTPException(status_code=404, detail=f"Page {page_number} not found")
    return page


@router.get("/{document_id}/file")
async def download_document_file(
    case_id: str, document_id: str, store: LocalDataStore = Depends(get_store)
):
    doc = store.get_document(document_id)
    if not doc or doc.get("case_id") != case_id:
        raise HTTPException(status_code=404, detail="Document not found")

    file_path = Path(doc["file_path"])
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File on disk not found")

    return FileResponse(
        path=str(file_path),
        filename=doc["original_filename"],
        media_type=doc.get("mime_type", "application/octet-stream"),
    )


@router.delete("/{document_id}", status_code=204)
async def delete_document(
    case_id: str, document_id: str, store: LocalDataStore = Depends(get_store)
):
    doc = store.get_document(document_id)
    if not doc or doc.get("case_id") != case_id:
        raise HTTPException(status_code=404, detail="Document not found")
    store.delete_document(document_id)
