"""
API v1 Router - aggregates all route modules.
"""
from fastapi import APIRouter
from app.api.v1 import cases, documents, chat, analysis, drafts, timeline, workspace

api_router = APIRouter()

api_router.include_router(workspace.router, prefix="/workspace", tags=["Workspace"])
api_router.include_router(cases.router, prefix="/cases", tags=["Cases"])
api_router.include_router(documents.router, prefix="/cases/{case_id}/documents", tags=["Documents"])
api_router.include_router(chat.router, prefix="/cases/{case_id}/chat", tags=["AI Chat"])
api_router.include_router(analysis.router, prefix="/cases/{case_id}/analysis", tags=["Legal Analysis"])
api_router.include_router(timeline.router, prefix="/cases/{case_id}/timeline", tags=["Timeline"])
api_router.include_router(drafts.router, prefix="/cases/{case_id}/drafts", tags=["Drafts"])
