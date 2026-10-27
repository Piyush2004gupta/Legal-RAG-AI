"""
Prompts module - Centralised repository of all system prompts, few-shot
examples, and prompt-building helpers used across the RAG pipeline.
"""
from app.prompts.templates import (
    RAG_SYSTEM_PROMPT,
    ANALYSIS_SYSTEM_PROMPT,
    DRAFT_SYSTEM_PROMPT,
    TIMELINE_SYSTEM_PROMPT,
    build_rag_user_prompt,
    build_analysis_user_prompt,
    build_draft_user_prompt,
    build_timeline_user_prompt,
)

__all__ = [
    "RAG_SYSTEM_PROMPT",
    "ANALYSIS_SYSTEM_PROMPT",
    "DRAFT_SYSTEM_PROMPT",
    "TIMELINE_SYSTEM_PROMPT",
    "build_rag_user_prompt",
    "build_analysis_user_prompt",
    "build_draft_user_prompt",
    "build_timeline_user_prompt",
]
