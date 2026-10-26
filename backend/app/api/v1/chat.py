"""
AI Chat API - RAG-powered Q&A with exact document and page citations.
"""
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.core.store import LocalDataStore, get_store
from app.rag.pipeline import RAGQueryPipeline

router = APIRouter()


class QueryRequest(BaseModel):
    question: str
    session_id: Optional[str] = None
    document_ids: Optional[List[str]] = None


class SessionCreate(BaseModel):
    title: Optional[str] = None


@router.post("/sessions", status_code=201)
async def create_session(
    case_id: str, body: SessionCreate, store: LocalDataStore = Depends(get_store)
):
    case = store.get_case(case_id)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    session = store.create_chat_session(case_id, title=body.title)
    return session


@router.get("/sessions")
async def list_sessions(case_id: str, store: LocalDataStore = Depends(get_store)):
    sessions = store.list_chat_sessions(case_id)
    return sessions


@router.get("/sessions/{session_id}/messages")
async def get_messages(
    case_id: str, session_id: str, store: LocalDataStore = Depends(get_store)
):
    session = store.get_chat_session(session_id)
    if not session or session.get("case_id") != case_id:
        raise HTTPException(status_code=404, detail="Session not found")
    messages = store.list_chat_messages(session_id)
    return messages


@router.post("/query")
async def query_chat(
    case_id: str, body: QueryRequest, store: LocalDataStore = Depends(get_store)
):
    case = store.get_case(case_id)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    session_id = body.session_id
    if not session_id:
        # Create a session automatically if none provided
        short_title = body.question[:40] + ("..." if len(body.question) > 40 else "")
        session = store.create_chat_session(case_id, title=short_title)
        session_id = session["id"]

    pipeline = RAGQueryPipeline(store)
    result = await pipeline.query(
        case_id=case_id,
        question=body.question,
        session_id=session_id,
        document_ids=body.document_ids,
    )
    result["session_id"] = session_id
    return result
