"""
Local File-Persisted DataStore for LegalDesk AI.
Operates completely without an external database (no PostgreSQL, no pgvector, no Redis required).
Data is stored locally in JSON format with in-memory indexes and vector cosine search.
"""
import os
import json
import uuid
import math
import asyncio
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional, List, Dict, Any
import structlog

from app.core.config import settings

log = structlog.get_logger()


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def cosine_similarity(v1: List[float], v2: List[float]) -> float:
    if not v1 or not v2 or len(v1) != len(v2):
        return 0.0
    dot = 0.0
    norm1 = 0.0
    norm2 = 0.0
    for a, b in zip(v1, v2):
        dot += a * b
        norm1 += a * a
        norm2 += b * b
    if norm1 <= 0.0 or norm2 <= 0.0:
        return 0.0
    return dot / (math.sqrt(norm1) * math.sqrt(norm2))


class LocalDataStore:
    def __init__(self, storage_dir: Optional[str] = None):
        self.storage_dir = Path(storage_dir or settings.STORAGE_PATH)
        self.storage_dir.mkdir(parents=True, exist_ok=True)
        self.db_file = self.storage_dir / "legaldesk_data.json"

        self.workspaces: Dict[str, dict] = {}
        self.cases: Dict[str, dict] = {}
        self.documents: Dict[str, dict] = {}
        self.pages: Dict[str, dict] = {}
        self.chunks: Dict[str, dict] = {}
        self.timeline_events: Dict[str, dict] = {}
        self.analyses: Dict[str, dict] = {}
        self.chat_sessions: Dict[str, dict] = {}
        self.chat_messages: Dict[str, dict] = {}
        self.drafts: Dict[str, dict] = {}
        self.processing_jobs: Dict[str, dict] = {}

        self._lock = asyncio.Lock()
        self._load()

    def _load(self):
        """Load state from local JSON file if exists, otherwise initialize default workspace."""
        if self.db_file.exists():
            try:
                with open(self.db_file, "r", encoding="utf-8") as f:
                    data = json.load(f)
                self.workspaces = data.get("workspaces", {})
                self.cases = data.get("cases", {})
                self.documents = data.get("documents", {})
                self.pages = data.get("pages", {})
                self.chunks = data.get("chunks", {})
                self.timeline_events = data.get("timeline_events", {})
                self.analyses = data.get("analyses", {})
                self.chat_sessions = data.get("chat_sessions", {})
                self.chat_messages = data.get("chat_messages", {})
                self.drafts = data.get("drafts", {})
                self.processing_jobs = data.get("processing_jobs", {})
                log.info("Loaded local database", file=str(self.db_file), cases=len(self.cases), docs=len(self.documents))
            except Exception as e:
                log.error("Failed to read database file, initializing empty", error=str(e))

        # Ensure default workspace
        if settings.DEFAULT_WORKSPACE_ID not in self.workspaces:
            self.workspaces[settings.DEFAULT_WORKSPACE_ID] = {
                "id": settings.DEFAULT_WORKSPACE_ID,
                "name": "My Legal Workspace",
                "slug": "default",
                "created_at": now_iso(),
                "updated_at": now_iso(),
            }
            self.save()

    def save(self):
        """Save state to local JSON file atomically."""
        temp_file = self.db_file.with_suffix(".tmp")
        payload = {
            "workspaces": self.workspaces,
            "cases": self.cases,
            "documents": self.documents,
            "pages": self.pages,
            "chunks": self.chunks,
            "timeline_events": self.timeline_events,
            "analyses": self.analyses,
            "chat_sessions": self.chat_sessions,
            "chat_messages": self.chat_messages,
            "drafts": self.drafts,
            "processing_jobs": self.processing_jobs,
        }
        with open(temp_file, "w", encoding="utf-8") as f:
            json.dump(payload, f, indent=2, ensure_ascii=False)
        temp_file.replace(self.db_file)

    # --- Workspace ---
    def get_workspace(self, workspace_id: str) -> Optional[dict]:
        return self.workspaces.get(workspace_id)

    # --- Cases ---
    def list_cases(self, workspace_id: str, status: Optional[str] = None) -> List[dict]:
        res = [c for c in self.cases.values() if c.get("workspace_id") == workspace_id]
        if status:
            res = [c for c in res if c.get("status") == status]
        res.sort(key=lambda x: x.get("created_at", ""), reverse=True)
        return res

    def get_case(self, case_id: str) -> Optional[dict]:
        return self.cases.get(case_id)

    def create_case(self, case_data: dict) -> dict:
        case_id = str(uuid.uuid4())
        record = {
            "id": case_id,
            "workspace_id": case_data.get("workspace_id", settings.DEFAULT_WORKSPACE_ID),
            "title": case_data["title"],
            "case_number": case_data.get("case_number"),
            "client_name": case_data.get("client_name"),
            "court": case_data.get("court"),
            "case_type": case_data.get("case_type"),
            "opposite_party": case_data.get("opposite_party"),
            "filing_date": case_data.get("filing_date"),
            "status": case_data.get("status", "active"),
            "notes": case_data.get("notes"),
            "metadata": case_data.get("metadata", {}),
            "created_at": now_iso(),
            "updated_at": now_iso(),
        }
        self.cases[case_id] = record
        self.save()
        return record

    def update_case(self, case_id: str, updates: dict) -> Optional[dict]:
        case = self.cases.get(case_id)
        if not case:
            return None
        for k, v in updates.items():
            if v is not None:
                case[k] = v
        case["updated_at"] = now_iso()
        self.save()
        return case

    def delete_case(self, case_id: str) -> bool:
        if case_id not in self.cases:
            return False
        # Delete related
        del self.cases[case_id]
        doc_ids = [k for k, d in self.documents.items() if d.get("case_id") == case_id]
        for did in doc_ids:
            self.delete_document(did)
        self.timeline_events = {k: v for k, v in self.timeline_events.items() if v.get("case_id") != case_id}
        self.analyses = {k: v for k, v in self.analyses.items() if v.get("case_id") != case_id}
        self.chat_sessions = {k: v for k, v in self.chat_sessions.items() if v.get("case_id") != case_id}
        self.chat_messages = {k: v for k, v in self.chat_messages.items() if v.get("case_id") != case_id}
        self.drafts = {k: v for k, v in self.drafts.items() if v.get("case_id") != case_id}
        self.save()
        return True

    # --- Documents ---
    def list_documents(self, case_id: str) -> List[dict]:
        docs = [d for d in self.documents.values() if d.get("case_id") == case_id]
        docs.sort(key=lambda x: x.get("created_at", ""), reverse=True)
        return docs

    def get_document(self, doc_id: str) -> Optional[dict]:
        return self.documents.get(doc_id)

    def find_document_by_hash(self, file_hash: str) -> Optional[dict]:
        for d in self.documents.values():
            if d.get("file_hash") == file_hash:
                return d
        return None

    def create_document(self, doc_data: dict) -> dict:
        doc_id = doc_data.get("id") or str(uuid.uuid4())
        record = {
            "id": doc_id,
            "workspace_id": doc_data.get("workspace_id", settings.DEFAULT_WORKSPACE_ID),
            "case_id": doc_data["case_id"],
            "filename": doc_data["filename"],
            "original_filename": doc_data["original_filename"],
            "file_hash": doc_data["file_hash"],
            "file_path": doc_data["file_path"],
            "file_size": doc_data["file_size"],
            "mime_type": doc_data["mime_type"],
            "document_type": doc_data.get("document_type"),
            "page_count": doc_data.get("page_count", 0),
            "processing_status": doc_data.get("processing_status", "pending"),
            "processing_error": doc_data.get("processing_error"),
            "processing_started_at": doc_data.get("processing_started_at"),
            "processing_completed_at": doc_data.get("processing_completed_at"),
            "metadata": doc_data.get("metadata", {}),
            "created_at": now_iso(),
            "updated_at": now_iso(),
        }
        self.documents[doc_id] = record
        self.save()
        return record

    def update_document(self, doc_id: str, updates: dict) -> Optional[dict]:
        doc = self.documents.get(doc_id)
        if not doc:
            return None
        for k, v in updates.items():
            doc[k] = v
        doc["updated_at"] = now_iso()
        self.save()
        return doc

    def delete_document(self, doc_id: str) -> bool:
        if doc_id not in self.documents:
            return False
        del self.documents[doc_id]
        self.pages = {k: v for k, v in self.pages.items() if v.get("document_id") != doc_id}
        self.chunks = {k: v for k, v in self.chunks.items() if v.get("document_id") != doc_id}
        self.processing_jobs = {k: v for k, v in self.processing_jobs.items() if v.get("document_id") != doc_id}
        self.save()
        return True

    # --- Pages ---
    def add_pages(self, pages_list: List[dict]):
        for p in pages_list:
            pid = p.get("id") or str(uuid.uuid4())
            p["id"] = pid
            self.pages[pid] = p
        self.save()

    def get_pages(self, doc_id: str) -> List[dict]:
        res = [p for p in self.pages.values() if p.get("document_id") == doc_id]
        res.sort(key=lambda x: x.get("page_number", 0))
        return res

    def get_page(self, doc_id: str, page_number: int) -> Optional[dict]:
        for p in self.pages.values():
            if p.get("document_id") == doc_id and p.get("page_number") == page_number:
                return p
        return None

    # --- Chunks ---
    def add_chunks(self, chunks_list: List[dict]):
        for c in chunks_list:
            cid = c.get("id") or str(uuid.uuid4())
            c["id"] = cid
            c["created_at"] = now_iso()
            self.chunks[cid] = c
        self.save()

    def get_chunks_by_case(self, case_id: str, doc_ids: Optional[List[str]] = None) -> List[dict]:
        chunks = [c for c in self.chunks.values() if c.get("case_id") == case_id]
        if doc_ids:
            chunks = [c for c in chunks if c.get("document_id") in doc_ids]
        return chunks

    # --- Vector & Keyword Search ---
    def search_chunks(
        self,
        case_id: str,
        query_embedding: List[float],
        keywords: Optional[List[str]] = None,
        doc_ids: Optional[List[str]] = None,
        top_k: int = 15,
        min_similarity: float = 0.20,
    ) -> List[dict]:
        chunks = self.get_chunks_by_case(case_id, doc_ids)
        if not chunks:
            return []

        scored = []
        for c in chunks:
            sim = 0.0
            emb = c.get("embedding")
            if emb:
                sim = cosine_similarity(query_embedding, emb)

            # Keyword bonus
            kw_score = 0.0
            if keywords:
                text_lower = c.get("chunk_text", "").lower()
                matches = sum(1 for kw in keywords if kw.lower() in text_lower)
                kw_score = matches * 0.05

            total_score = sim + kw_score
            if total_score >= min_similarity:
                item = dict(c)
                item["similarity_score"] = sim
                item["total_score"] = total_score
                # Attach doc original_filename
                doc = self.documents.get(c.get("document_id"))
                item["original_filename"] = doc.get("original_filename") if doc else "Document"
                scored.append(item)

        scored.sort(key=lambda x: x["total_score"], reverse=True)
        return scored[:top_k]

    # --- Timeline ---
    def list_timeline(self, case_id: str) -> List[dict]:
        events = [e for e in self.timeline_events.values() if e.get("case_id") == case_id]
        events.sort(key=lambda x: x.get("event_date", ""))
        return events

    def add_timeline_event(self, event_data: dict) -> dict:
        eid = event_data.get("id") or str(uuid.uuid4())
        record = {
            "id": eid,
            "case_id": event_data["case_id"],
            "event_date": event_data.get("event_date", ""),
            "title": event_data["title"],
            "description": event_data.get("description", ""),
            "event_type": event_data.get("event_type", "factual"),
            "document_id": event_data.get("document_id"),
            "page_number": event_data.get("page_number"),
            "citation_text": event_data.get("citation_text"),
            "is_verified": event_data.get("is_verified", False),
            "created_at": now_iso(),
        }
        self.timeline_events[eid] = record
        self.save()
        return record

    def update_timeline_event(self, event_id: str, updates: dict) -> Optional[dict]:
        e = self.timeline_events.get(event_id)
        if not e:
            return None
        for k, v in updates.items():
            if v is not None:
                e[k] = v
        self.save()
        return e

    def delete_timeline_event(self, event_id: str) -> bool:
        if event_id not in self.timeline_events:
            return False
        del self.timeline_events[event_id]
        self.save()
        return True

    # --- Analysis ---
    def get_analyses(self, case_id: str) -> List[dict]:
        items = [a for a in self.analyses.values() if a.get("case_id") == case_id and a.get("is_current", True)]
        items.sort(key=lambda x: x.get("created_at", ""), reverse=True)
        return items

    def add_analysis(self, case_id: str, analysis_type: str, content: Any, model_used: str) -> dict:
        aid = str(uuid.uuid4())
        # Mark previous current of same type as old
        for a in self.analyses.values():
            if a.get("case_id") == case_id and a.get("analysis_type") == analysis_type:
                a["is_current"] = False

        record = {
            "id": aid,
            "case_id": case_id,
            "analysis_type": analysis_type,
            "content": content,
            "model_used": model_used,
            "is_current": True,
            "created_at": now_iso(),
        }
        self.analyses[aid] = record
        self.save()
        return record

    # --- Chat Sessions & Messages ---
    def list_chat_sessions(self, case_id: str) -> List[dict]:
        sessions = [s for s in self.chat_sessions.values() if s.get("case_id") == case_id]
        sessions.sort(key=lambda x: x.get("created_at", ""), reverse=True)
        return sessions

    def create_chat_session(self, case_id: str, title: Optional[str] = None) -> dict:
        sid = str(uuid.uuid4())
        record = {
            "id": sid,
            "workspace_id": settings.DEFAULT_WORKSPACE_ID,
            "case_id": case_id,
            "title": title or "Legal Query",
            "created_at": now_iso(),
        }
        self.chat_sessions[sid] = record
        self.save()
        return record

    def get_chat_session(self, session_id: str) -> Optional[dict]:
        return self.chat_sessions.get(session_id)

    def list_chat_messages(self, session_id: str) -> List[dict]:
        msgs = [m for m in self.chat_messages.values() if m.get("session_id") == session_id]
        msgs.sort(key=lambda x: x.get("created_at", ""))
        return msgs

    def add_chat_message(self, session_id: str, case_id: str, role: str, content: str, citations: Optional[List[dict]] = None) -> dict:
        mid = str(uuid.uuid4())
        record = {
            "id": mid,
            "session_id": session_id,
            "case_id": case_id,
            "role": role,
            "content": content,
            "citations": citations or [],
            "created_at": now_iso(),
        }
        self.chat_messages[mid] = record
        self.save()
        return record

    # --- Drafts ---
    def list_drafts(self, case_id: str) -> List[dict]:
        items = [d for d in self.drafts.values() if d.get("case_id") == case_id]
        items.sort(key=lambda x: x.get("created_at", ""), reverse=True)
        return items

    def get_draft(self, draft_id: str) -> Optional[dict]:
        return self.drafts.get(draft_id)

    def create_draft(self, draft_data: dict) -> dict:
        did = str(uuid.uuid4())
        record = {
            "id": did,
            "case_id": draft_data["case_id"],
            "draft_type": draft_data.get("draft_type", "Notice"),
            "title": draft_data.get("title", "Legal Draft"),
            "content": draft_data.get("content", ""),
            "court_name": draft_data.get("court_name"),
            "petitioner_name": draft_data.get("petitioner_name"),
            "respondent_name": draft_data.get("respondent_name"),
            "prayer": draft_data.get("prayer"),
            "sections_invoked": draft_data.get("sections_invoked", []),
            "version": 1,
            "created_at": now_iso(),
            "updated_at": now_iso(),
        }
        self.drafts[did] = record
        self.save()
        return record

    def update_draft(self, draft_id: str, updates: dict) -> Optional[dict]:
        draft = self.drafts.get(draft_id)
        if not draft:
            return None
        for k, v in updates.items():
            if v is not None:
                draft[k] = v
        draft["version"] = draft.get("version", 1) + 1
        draft["updated_at"] = now_iso()
        self.save()
        return draft

    def delete_draft(self, draft_id: str) -> bool:
        if draft_id not in self.drafts:
            return False
        del self.drafts[draft_id]
        self.save()
        return True

    # --- Processing Jobs ---
    def create_job(self, document_id: str, case_id: str, job_type: str = "ingest") -> dict:
        jid = str(uuid.uuid4())
        record = {
            "id": jid,
            "document_id": document_id,
            "case_id": case_id,
            "job_type": job_type,
            "status": "queued",
            "priority": 5,
            "created_at": now_iso(),
        }
        self.processing_jobs[jid] = record
        self.save()
        return record

    def update_job(self, job_id: str, updates: dict) -> Optional[dict]:
        j = self.processing_jobs.get(job_id)
        if not j:
            return None
        for k, v in updates.items():
            j[k] = v
        self.save()
        return j

    # --- Real Workspace Stats & Activity ---
    def get_workspace_stats(self) -> dict:
        total_cases = len(self.cases)
        total_docs = len(self.documents)
        total_drafts = len(self.drafts)
        hearings = [
            e for e in self.timeline_events.values()
            if e.get("event_type") in ("hearing", "procedural") or "hearing" in e.get("title", "").lower()
        ]
        total_bytes = sum(d.get("file_size", 0) for d in self.documents.values())
        if total_bytes < 1024:
            size_str = f"{total_bytes} B"
        elif total_bytes < 1024 * 1024:
            size_str = f"{(total_bytes / 1024):.1f} KB"
        elif total_bytes < 1024 * 1024 * 1024:
            size_str = f"{(total_bytes / (1024 * 1024)):.1f} MB"
        else:
            size_str = f"{(total_bytes / (1024 * 1024 * 1024)):.2f} GB"

        limit_bytes = 10 * 1024 * 1024 * 1024  # 10 GB limit
        pct = min(round((total_bytes / limit_bytes) * 100, 1), 100.0)

        return {
            "total_cases": total_cases,
            "total_documents": total_docs,
            "total_drafts": total_drafts,
            "upcoming_hearings": len(hearings),
            "storage_used_bytes": total_bytes,
            "storage_used_str": size_str,
            "storage_limit_str": "10 GB",
            "storage_pct": pct,
        }

    def get_recent_activity(self, limit: int = 10) -> list:
        activities = []
        for c in self.cases.values():
            activities.append({
                "type": "case",
                "title": f"Matter '{c.get('title')}' created",
                "timestamp": c.get("created_at"),
                "icon": "briefcase",
            })
        for d in self.documents.values():
            activities.append({
                "type": "document",
                "title": f"Document '{d.get('original_filename')}' indexed with vector embeddings",
                "timestamp": d.get("created_at"),
                "icon": "file-check",
            })
        for a in self.analyses.values():
            case = self.cases.get(a.get("case_id"))
            c_name = case.get("title") if case else "Case"
            activities.append({
                "type": "analysis",
                "title": f"Legal analysis generated for '{c_name}'",
                "timestamp": a.get("created_at"),
                "icon": "sparkles",
            })
        for dr in self.drafts.values():
            activities.append({
                "type": "draft",
                "title": f"Legal draft '{dr.get('title')}' created",
                "timestamp": dr.get("created_at"),
                "icon": "file-text",
            })
        for t in self.timeline_events.values():
            activities.append({
                "type": "timeline",
                "title": f"Timeline event '{t.get('title')}' recorded ({t.get('event_date')})",
                "timestamp": t.get("created_at"),
                "icon": "history",
            })

        activities.sort(key=lambda x: x.get("timestamp") or "", reverse=True)
        return activities[:limit]


# Global singleton instance
store = LocalDataStore()


def get_store() -> LocalDataStore:
    return store
