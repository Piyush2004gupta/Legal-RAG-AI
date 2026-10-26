"""
Timeline API - Chronological legal timeline extraction and management.
"""
import json
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.core.store import LocalDataStore, get_store
from app.core.openai_client import chat_completion

router = APIRouter()


class EventCreate(BaseModel):
    event_date: str
    title: str
    description: Optional[str] = None
    event_type: str = "factual"
    document_id: Optional[str] = None
    page_number: Optional[int] = None
    citation_text: Optional[str] = None


class EventUpdate(BaseModel):
    event_date: Optional[str] = None
    title: Optional[str] = None
    description: Optional[str] = None
    event_type: Optional[str] = None
    document_id: Optional[str] = None
    page_number: Optional[int] = None
    citation_text: Optional[str] = None
    is_verified: Optional[bool] = None


TIMELINE_SYSTEM_PROMPT = """You are an Indian legal expert analyzing case documents to build a strict chronological timeline.
Extract every key date and factual event from the text.
Return ONLY valid JSON matching this schema:
{
  "events": [
    {
      "event_date": "YYYY-MM-DD or DD Month YYYY",
      "title": "Concise summary of event",
      "description": "Details of the event",
      "event_type": "factual | procedural | legal | incident | filing",
      "citation_text": "Exact quote or reference from document",
      "page_number": 1
    }
  ]
}
If date is approximate, format clearly (e.g., "June 2023"). Do not fabricate events.
"""


@router.get("")
async def get_timeline(case_id: str, store: LocalDataStore = Depends(get_store)):
    events = store.list_timeline(case_id)
    return events


@router.post("/extract")
async def extract_timeline(case_id: str, store: LocalDataStore = Depends(get_store)):
    """Extract chronological timeline from uploaded case documents."""
    chunks = store.get_chunks_by_case(case_id)
    if not chunks:
        raise HTTPException(
            status_code=400,
            detail="No processed documents found for this case. Upload documents first.",
        )

    # Compile context snippets with document name and page number
    snippets = []
    for c in chunks[:25]:  # Up to first 25 chunks for comprehensive timeline
        doc = store.get_document(c.get("document_id"))
        doc_name = doc.get("original_filename", "Document") if doc else "Document"
        snippets.append(
            f"[{doc_name}, Page {c.get('page_number', 1)}]: {c.get('chunk_text', '')}"
        )

    context = "\n\n".join(snippets)

    messages = [
        {"role": "system", "content": TIMELINE_SYSTEM_PROMPT},
        {"role": "user", "content": f"Extract the case timeline from these documents:\n\n{context}"},
    ]

    try:
        response = await chat_completion(
            messages=messages,
            temperature=0.1,
            max_tokens=4096,
            response_format={"type": "json_object"},
        )
        content_json = json.loads(response["content"])
        raw_events = content_json.get("events", [])
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI extraction failed: {str(e)}")

    created_events = []
    for ev in raw_events:
        item = store.add_timeline_event({
            "case_id": case_id,
            "event_date": ev.get("event_date", ""),
            "title": ev.get("title", "Event"),
            "description": ev.get("description", ""),
            "event_type": ev.get("event_type", "factual"),
            "document_id": None,
            "page_number": ev.get("page_number"),
            "citation_text": ev.get("citation_text"),
            "is_verified": True,
        })
        created_events.append(item)

    return created_events


@router.post("", status_code=201)
async def add_event(
    case_id: str, body: EventCreate, store: LocalDataStore = Depends(get_store)
):
    data = body.model_dump(exclude_none=True)
    data["case_id"] = case_id
    item = store.add_timeline_event(data)
    return item


@router.patch("/{event_id}")
async def update_event(
    case_id: str,
    event_id: str,
    body: EventUpdate,
    store: LocalDataStore = Depends(get_store),
):
    updates = body.model_dump(exclude_none=True)
    item = store.update_timeline_event(event_id, updates)
    if not item or item.get("case_id") != case_id:
        raise HTTPException(status_code=404, detail="Timeline event not found")
    return item


@router.delete("/{event_id}", status_code=204)
async def delete_event(
    case_id: str, event_id: str, store: LocalDataStore = Depends(get_store)
):
    success = store.delete_timeline_event(event_id)
    if not success:
        raise HTTPException(status_code=404, detail="Timeline event not found")
