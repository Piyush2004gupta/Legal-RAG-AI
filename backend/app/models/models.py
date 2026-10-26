"""
Domain Models for LegalDesk AI - Database-free implementation.
Clean Python dataclasses/objects representing legal entities.
"""
import uuid
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any


def now_utc():
    return datetime.now(timezone.utc)


class ModelBase:
    def __init__(self, **kwargs):
        for k, v in kwargs.items():
            setattr(self, k, v)

    def to_dict(self) -> Dict[str, Any]:
        return {
            k: v.isoformat() if isinstance(v, datetime) else v
            for k, v in self.__dict__.items()
            if not k.startswith("_")
        }


class Workspace(ModelBase):
    def __init__(
        self,
        id: Optional[str] = None,
        name: str = "My Legal Workspace",
        slug: str = "default",
        owner_id: Optional[str] = None,
        settings: Optional[dict] = None,
        **kwargs
    ):
        self.id = id or "00000000-0000-0000-0000-000000000001"
        self.name = name
        self.slug = slug
        self.owner_id = owner_id
        self.settings = settings or {}
        self.created_at = kwargs.get("created_at", now_utc())
        self.updated_at = kwargs.get("updated_at", now_utc())
        super().__init__(**kwargs)


class Case(ModelBase):
    def __init__(
        self,
        id: Optional[str] = None,
        workspace_id: Optional[str] = None,
        title: str = "",
        case_number: Optional[str] = None,
        client_name: Optional[str] = None,
        court: Optional[str] = None,
        case_type: Optional[str] = None,
        opposite_party: Optional[str] = None,
        filing_date: Optional[Any] = None,
        status: str = "active",
        notes: Optional[str] = None,
        metadata: Optional[dict] = None,
        **kwargs
    ):
        self.id = id or str(uuid.uuid4())
        self.workspace_id = workspace_id or "00000000-0000-0000-0000-000000000001"
        self.title = title
        self.case_number = case_number
        self.client_name = client_name
        self.court = court
        self.case_type = case_type
        self.opposite_party = opposite_party
        self.filing_date = filing_date
        self.status = status
        self.notes = notes
        self.metadata = metadata or {}
        self.created_at = kwargs.get("created_at", now_utc())
        self.updated_at = kwargs.get("updated_at", now_utc())
        super().__init__(**kwargs)


class Document(ModelBase):
    def __init__(
        self,
        id: Optional[str] = None,
        workspace_id: Optional[str] = None,
        case_id: Optional[str] = None,
        filename: str = "",
        original_filename: str = "",
        file_hash: str = "",
        file_path: str = "",
        file_size: int = 0,
        mime_type: str = "application/pdf",
        document_type: Optional[str] = None,
        page_count: Optional[int] = 0,
        processing_status: str = "pending",
        processing_error: Optional[str] = None,
        processing_started_at: Optional[Any] = None,
        processing_completed_at: Optional[Any] = None,
        metadata: Optional[dict] = None,
        **kwargs
    ):
        self.id = id or str(uuid.uuid4())
        self.workspace_id = workspace_id or "00000000-0000-0000-0000-000000000001"
        self.case_id = case_id
        self.filename = filename
        self.original_filename = original_filename
        self.file_hash = file_hash
        self.file_path = file_path
        self.file_size = file_size
        self.mime_type = mime_type
        self.document_type = document_type
        self.page_count = page_count or 0
        self.processing_status = processing_status
        self.processing_error = processing_error
        self.processing_started_at = processing_started_at
        self.processing_completed_at = processing_completed_at
        self.metadata = metadata or {}
        self.created_at = kwargs.get("created_at", now_utc())
        self.updated_at = kwargs.get("updated_at", now_utc())
        super().__init__(**kwargs)


class DocumentPage(ModelBase):
    def __init__(
        self,
        id: Optional[str] = None,
        document_id: Optional[str] = None,
        case_id: Optional[str] = None,
        page_number: int = 1,
        raw_text: str = "",
        clean_text: str = "",
        word_count: int = 0,
        has_images: bool = False,
        ocr_applied: bool = False,
        **kwargs
    ):
        self.id = id or str(uuid.uuid4())
        self.document_id = document_id
        self.case_id = case_id
        self.page_number = page_number
        self.raw_text = raw_text
        self.clean_text = clean_text
        self.word_count = word_count
        self.has_images = has_images
        self.ocr_applied = ocr_applied
        super().__init__(**kwargs)


class DocumentChunk(ModelBase):
    def __init__(
        self,
        id: Optional[str] = None,
        document_id: Optional[str] = None,
        case_id: Optional[str] = None,
        chunk_index: int = 0,
        page_number: int = 1,
        chunk_text: str = "",
        token_count: int = 0,
        embedding: Optional[List[float]] = None,
        document_type: Optional[str] = None,
        **kwargs
    ):
        self.id = id or str(uuid.uuid4())
        self.document_id = document_id
        self.case_id = case_id
        self.chunk_index = chunk_index
        self.page_number = page_number
        self.chunk_text = chunk_text
        self.token_count = token_count
        self.embedding = embedding or []
        self.document_type = document_type
        self.created_at = kwargs.get("created_at", now_utc())
        super().__init__(**kwargs)


class ProcessingJob(ModelBase):
    def __init__(
        self,
        id: Optional[str] = None,
        document_id: Optional[str] = None,
        case_id: Optional[str] = None,
        job_type: str = "ingest",
        status: str = "queued",
        priority: int = 5,
        **kwargs
    ):
        self.id = id or str(uuid.uuid4())
        self.document_id = document_id
        self.case_id = case_id
        self.job_type = job_type
        self.status = status
        self.priority = priority
        self.created_at = kwargs.get("created_at", now_utc())
        super().__init__(**kwargs)


class TimelineEvent(ModelBase):
    def __init__(
        self,
        id: Optional[str] = None,
        case_id: Optional[str] = None,
        event_date: str = "",
        title: str = "",
        description: str = "",
        event_type: str = "factual",
        document_id: Optional[str] = None,
        page_number: Optional[int] = None,
        citation_text: Optional[str] = None,
        is_verified: bool = False,
        **kwargs
    ):
        self.id = id or str(uuid.uuid4())
        self.case_id = case_id
        self.event_date = event_date
        self.title = title
        self.description = description
        self.event_type = event_type
        self.document_id = document_id
        self.page_number = page_number
        self.citation_text = citation_text
        self.is_verified = is_verified
        self.created_at = kwargs.get("created_at", now_utc())
        super().__init__(**kwargs)


class LegalAnalysis(ModelBase):
    def __init__(
        self,
        id: Optional[str] = None,
        case_id: Optional[str] = None,
        analysis_type: str = "full",
        content: Optional[dict] = None,
        model_used: str = "gpt-4o",
        is_current: bool = True,
        **kwargs
    ):
        self.id = id or str(uuid.uuid4())
        self.case_id = case_id
        self.analysis_type = analysis_type
        self.content = content or {}
        self.model_used = model_used
        self.is_current = is_current
        self.created_at = kwargs.get("created_at", now_utc())
        super().__init__(**kwargs)


class ChatSession(ModelBase):
    def __init__(
        self,
        id: Optional[str] = None,
        workspace_id: Optional[str] = None,
        case_id: Optional[str] = None,
        title: str = "New Chat",
        **kwargs
    ):
        self.id = id or str(uuid.uuid4())
        self.workspace_id = workspace_id or "00000000-0000-0000-0000-000000000001"
        self.case_id = case_id
        self.title = title
        self.created_at = kwargs.get("created_at", now_utc())
        super().__init__(**kwargs)


class ChatMessage(ModelBase):
    def __init__(
        self,
        id: Optional[str] = None,
        session_id: Optional[str] = None,
        case_id: Optional[str] = None,
        role: str = "user",
        content: str = "",
        citations: Optional[List[dict]] = None,
        **kwargs
    ):
        self.id = id or str(uuid.uuid4())
        self.session_id = session_id
        self.case_id = case_id
        self.role = role
        self.content = content
        self.citations = citations or []
        self.created_at = kwargs.get("created_at", now_utc())
        super().__init__(**kwargs)


class Citation(ModelBase):
    def __init__(
        self,
        id: Optional[str] = None,
        document_id: Optional[str] = None,
        page_number: int = 1,
        quote: str = "",
        **kwargs
    ):
        self.id = id or str(uuid.uuid4())
        self.document_id = document_id
        self.page_number = page_number
        self.quote = quote
        super().__init__(**kwargs)


class Draft(ModelBase):
    def __init__(
        self,
        id: Optional[str] = None,
        case_id: Optional[str] = None,
        draft_type: str = "LegalNotice",
        title: str = "Legal Draft",
        content: str = "",
        court_name: Optional[str] = None,
        petitioner_name: Optional[str] = None,
        respondent_name: Optional[str] = None,
        prayer: Optional[str] = None,
        sections_invoked: Optional[List[str]] = None,
        version: int = 1,
        **kwargs
    ):
        self.id = id or str(uuid.uuid4())
        self.case_id = case_id
        self.draft_type = draft_type
        self.title = title
        self.content = content
        self.court_name = court_name
        self.petitioner_name = petitioner_name
        self.respondent_name = respondent_name
        self.prayer = prayer
        self.sections_invoked = sections_invoked or []
        self.version = version
        self.created_at = kwargs.get("created_at", now_utc())
        self.updated_at = kwargs.get("updated_at", now_utc())
        super().__init__(**kwargs)


class AuditLog(ModelBase):
    def __init__(self, action: str = "", details: Optional[dict] = None, **kwargs):
        self.id = str(uuid.uuid4())
        self.action = action
        self.details = details or {}
        self.created_at = now_utc()
        super().__init__(**kwargs)
