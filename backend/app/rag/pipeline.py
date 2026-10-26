"""
RAG Query Pipeline - Zero-Database Implementation.
Combines vector cosine similarity search over LocalDataStore embeddings,
keyword search, grounded prompt synthesis, and citation extraction.
"""
import re
import time
from typing import Optional, List, Dict
import structlog

from app.core.config import settings
from app.core.store import LocalDataStore, store
from app.core.openai_client import create_embeddings, chat_completion

log = structlog.get_logger()

NO_ANSWER_RESPONSE = (
    "I could not find reliable support for this answer in the available case documents. "
    "Please upload relevant case documents or consult a qualified advocate."
)

SYSTEM_PROMPT = """You are LegalDesk AI, a specialized AI legal research assistant for Indian advocates and courts.

CRITICAL INSTRUCTIONS:
1. Base your answer STRICTLY on the retrieved case document excerpts provided below.
2. For EVERY claim, fact, or legal provision mentioned, cite the exact source using format: [DocName, Page N].
3. If the documents do not contain the answer, state clearly: "Based on the uploaded documents, this information is not available."
4. Never invent or hallucinate judgments, section numbers, parties, dates, or case citations.
5. Emphasize Indian law provisions (IPC/BNS, CrPC/BNSS, Evidence Act/BSA, Constitution of India) accurately as found in the text.
6. Provide clear, professional legal analysis formatted with structured headings and bullet points.
7. Conclude with a brief reminder that this analysis requires professional legal verification.
"""


class RAGQueryPipeline:
    def __init__(self, datastore: Optional[LocalDataStore] = None):
        self.store = datastore or store

    async def query(
        self,
        case_id: str,
        question: str,
        session_id: Optional[str] = None,
        document_ids: Optional[List[str]] = None,
    ) -> dict:
        start_time = time.time()

        # 1. Embed query
        embeddings = await create_embeddings([question])
        query_embedding = embeddings[0] if embeddings else []

        # 2. Extract keywords for hybrid ranking
        keywords = [w for w in re.findall(r"\w+", question.lower()) if len(w) > 2]

        # 3. Retrieve relevant chunks from local store
        matched_chunks = self.store.search_chunks(
            case_id=case_id,
            query_embedding=query_embedding,
            keywords=keywords,
            doc_ids=document_ids,
            top_k=settings.TOP_K_RERANK,
            min_similarity=settings.SIMILARITY_THRESHOLD,
        )

        if not matched_chunks:
            return {
                "answer": NO_ANSWER_RESPONSE,
                "citations": [],
                "sources_used": 0,
                "latency_ms": int((time.time() - start_time) * 1000),
            }

        # 4. Build prompt context with page numbers and document names
        context_parts = []
        citations_available = []

        for i, chunk in enumerate(matched_chunks):
            doc_name = chunk.get("original_filename", "Document")
            page_num = chunk.get("page_number", 1)
            text_snippet = chunk.get("chunk_text", "")
            context_parts.append(
                f"[Source {i+1} | Document: '{doc_name}' | Page {page_num}]\n{text_snippet}\n"
            )
            citations_available.append({
                "source_id": i + 1,
                "document_id": chunk.get("document_id"),
                "document_name": doc_name,
                "page_number": page_num,
                "snippet": text_snippet[:200] + "...",
                "similarity_score": round(chunk.get("similarity_score", 0.0), 3),
            })

        context_str = "\n".join(context_parts)

        # 5. Call OpenAI Chat Completion
        messages = [
            {"role": "system", "content": SYSTEM_PROMPT},
            {
                "role": "user",
                "content": f"CASE CONTEXT:\n{context_str}\n\nADVOCATE'S QUESTION:\n{question}\n\nPlease provide a detailed, verified legal answer with citations [DocName, Page N].",
            },
        ]

        completion = await chat_completion(
            messages=messages,
            temperature=0.1,
            max_tokens=2048,
        )

        answer = completion.get("content", "")
        latency_ms = int((time.time() - start_time) * 1000)

        # 6. Save messages if session_id provided
        if session_id:
            self.store.add_chat_message(
                session_id=session_id,
                case_id=case_id,
                role="user",
                content=question,
            )
            self.store.add_chat_message(
                session_id=session_id,
                case_id=case_id,
                role="assistant",
                content=answer,
                citations=citations_available,
            )

        return {
            "answer": answer,
            "citations": citations_available,
            "sources_used": len(matched_chunks),
            "latency_ms": latency_ms,
        }
