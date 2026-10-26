"""
Cases API - CRUD for legal cases using LocalDataStore.
"""
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.core.store import LocalDataStore, get_store
from app.core.config import settings

router = APIRouter()


class CaseCreate(BaseModel):
    title: str
    case_number: Optional[str] = None
    client_name: Optional[str] = None
    court: Optional[str] = None
    case_type: Optional[str] = None
    opposite_party: Optional[str] = None
    filing_date: Optional[str] = None
    notes: Optional[str] = None


class CaseUpdate(BaseModel):
    title: Optional[str] = None
    case_number: Optional[str] = None
    client_name: Optional[str] = None
    court: Optional[str] = None
    case_type: Optional[str] = None
    opposite_party: Optional[str] = None
    filing_date: Optional[str] = None
    status: Optional[str] = None
    notes: Optional[str] = None


def format_case(case: dict, doc_count: int = 0) -> dict:
    return {
        "id": case["id"],
        "workspace_id": case.get("workspace_id", settings.DEFAULT_WORKSPACE_ID),
        "title": case["title"],
        "case_number": case.get("case_number"),
        "client_name": case.get("client_name"),
        "court": case.get("court"),
        "case_type": case.get("case_type"),
        "opposite_party": case.get("opposite_party"),
        "filing_date": case.get("filing_date"),
        "status": case.get("status", "active"),
        "notes": case.get("notes"),
        "document_count": doc_count,
        "created_at": case.get("created_at"),
        "updated_at": case.get("updated_at"),
    }


@router.get("")
async def list_cases(
    status: Optional[str] = None,
    store: LocalDataStore = Depends(get_store),
):
    cases = store.list_cases(settings.DEFAULT_WORKSPACE_ID, status=status)
    output = []
    for c in cases:
        doc_count = len(store.list_documents(c["id"]))
        output.append(format_case(c, doc_count))
    return output


@router.post("", status_code=201)
async def create_case(body: CaseCreate, store: LocalDataStore = Depends(get_store)):
    data = body.model_dump(exclude_none=True)
    data["workspace_id"] = settings.DEFAULT_WORKSPACE_ID
    case = store.create_case(data)
    return format_case(case, 0)


@router.get("/{case_id}")
async def get_case(case_id: str, store: LocalDataStore = Depends(get_store)):
    case = store.get_case(case_id)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    doc_count = len(store.list_documents(case_id))
    return format_case(case, doc_count)


@router.patch("/{case_id}")
async def update_case(
    case_id: str, body: CaseUpdate, store: LocalDataStore = Depends(get_store)
):
    updates = body.model_dump(exclude_none=True)
    updated = store.update_case(case_id, updates)
    if not updated:
        raise HTTPException(status_code=404, detail="Case not found")
    doc_count = len(store.list_documents(case_id))
    return format_case(updated, doc_count)


@router.delete("/{case_id}", status_code=204)
async def delete_case(case_id: str, store: LocalDataStore = Depends(get_store)):
    success = store.delete_case(case_id)
    if not success:
        raise HTTPException(status_code=404, detail="Case not found")
