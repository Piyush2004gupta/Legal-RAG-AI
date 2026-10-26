"""
Legal Analysis API - AI-generated case analysis grounded in documents.
Generates Case Summary, Important Facts, Applicable Sections, Strong/Weak Arguments, and Precedents.
"""
import json
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.core.store import LocalDataStore, get_store
from app.core.openai_client import chat_completion

router = APIRouter()

ANALYSIS_DISCLAIMER = (
    "\n\n---\n**⚠️ AI-assisted legal analysis. Verification by a qualified advocate is required. "
    "This output does not constitute legal advice or formal representation.**"
)

ANALYSIS_SYSTEM_PROMPT = """You are a senior Indian legal advocate and analyst.
Analyze the provided case document excerpts thoroughly and objectively.
Return ONLY valid JSON matching this schema:
{
  "summary": "Comprehensive 2-3 paragraph overview of the case background and present status",
  "key_facts": [
    {
      "fact": "Specific factual event or statement from document",
      "citation": "[DocName, Page N]"
    }
  ],
  "applicable_sections": [
    {
      "act": "Indian Penal Code / Bharatiya Nyaya Sanhita / CrPC / Contract Act / etc.",
      "section": "Section number with title",
      "relevance": "Why this provision applies to the case facts",
      "citation": "[DocName, Page N]"
    }
  ],
  "strong_arguments": [
    {
      "point": "Strong legal or factual argument favorable to client",
      "supporting_evidence": "Document or statute basis"
    }
  ],
  "weak_arguments": [
    {
      "point": "Vulnerability or counter-argument opposite party will raise",
      "mitigation": "Recommended legal counter-strategy"
    }
  ],
  "similar_judgments": [
    {
      "case_name": "Landmark Supreme Court / High Court precedent",
      "citation": "AIR / SCC citation if standard",
      "principle": "Legal ratio decidendi relevant to this case"
    }
  ]
}
Ground every statement in the provided text. Do not invent facts or judgments.
"""


@router.get("")
async def get_analyses(case_id: str, store: LocalDataStore = Depends(get_store)):
    analyses = store.get_analyses(case_id)
    return analyses


@router.post("/generate")
async def generate_analysis(
    case_id: str,
    analysis_type: str = "full",
    store: LocalDataStore = Depends(get_store),
):
    case = store.get_case(case_id)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    chunks = store.get_chunks_by_case(case_id)
    if not chunks:
        raise HTTPException(
            status_code=400,
            detail="No processed documents found for this case. Please upload case documents first.",
        )

    context_snippets = []
    for c in chunks[:30]:
        doc = store.get_document(c.get("document_id"))
        doc_name = doc.get("original_filename", "Document") if doc else "Document"
        context_snippets.append(
            f"[{doc_name}, Page {c.get('page_number', 1)}]: {c.get('chunk_text', '')}"
        )

    context = "\n\n".join(context_snippets)

    messages = [
        {"role": "system", "content": ANALYSIS_SYSTEM_PROMPT},
        {
            "role": "user",
            "content": f"CASE: {case.get('title')} ({case.get('case_type', 'General')})\n\nDOCUMENTS:\n{context}\n\nPerform full structured Indian legal analysis.",
        },
    ]

    try:
        response = await chat_completion(
            messages=messages,
            temperature=0.1,
            max_tokens=4096,
            response_format={"type": "json_object"},
        )
        content_json = json.loads(response["content"])
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI analysis generation failed: {str(e)}")

    analysis = store.add_analysis(
        case_id=case_id,
        analysis_type=analysis_type,
        content=content_json,
        model_used=response.get("model", "gpt-4o"),
    )

    return analysis
