"""
RAG Query Pipeline - Enterprise-Grade Legal Intelligence Implementation.
Combines hybrid vector similarity + BM25 keyword search, reciprocal rank fusion,
strict legal-only domain guardrails, grounded prompt synthesis, and inline citations.
"""
import re
import time
from typing import Optional, List, Dict
import structlog

from app.core.config import settings
from app.core.store import LocalDataStore, store
from app.core.openai_client import create_embeddings, chat_completion
from app.retrieval.retriever import HybridRetriever
from app.prompts.templates import (
    RAG_SYSTEM_PROMPT,
    build_rag_user_prompt,
    NO_ANSWER_RESPONSE,
    NON_LEGAL_REFUSAL_MESSAGE,
)

log = structlog.get_logger()

# Common non-legal / off-topic keywords to guard against casual or abusive non-legal queries
# Grouped by category for easier maintenance
NON_LEGAL_TRIGGERS = [
    # Food / cooking
    "recipe", "how to cook", "how to bake", "bake a", "pasta recipe", "biryani", "pizza",
    "burger recipe", "chicken recipe", "dal recipe", "roti", "cooking tips",
    # Coding / technology (non-legal)
    "write a python", "write python code", "write javascript", "write html", "write css",
    "write code for", "debug this code", "fix my code", "write a function", "write a program",
    "explain this algorithm", "leetcode", "data structure", "machine learning model",
    # Sports / entertainment
    "cricket match", "football match", "ipl score", "world cup score", "who won the match",
    "ipl 2024", "t20 score", "movie review", "latest movies", "box office",
    "hollywood movies", "bollywood movies", "web series", "netflix show", "amazon prime",
    # Jokes / creative writing
    "tell me a joke", "write a poem", "write a song", "sing a song", "tell me a story",
    "write a story", "write an essay", "write a letter to my friend",
    # Weather / travel
    "weather today", "weather forecast", "temperature today", "will it rain",
    "travel tips", "tourist places", "best restaurants",
    # Personal / lifestyle
    "dating advice", "relationship tips", "horoscope", "astrology", "zodiac sign",
    "love advice", "breakup advice", "weight loss tips", "fitness tips", "diet plan",
    # General chat that is clearly non-legal
    "who is the president of", "capital of india", "what is 2+2", "translate this to hindi",
    "make me laugh", "are you gpt", "are you chatgpt", "who made you",
]


def is_non_legal_prompt(text: str) -> bool:
    """Detect queries that are unambiguously non-legal and out of legal scope."""
    cleaned = text.lower().strip()
    return any(trigger in cleaned for trigger in NON_LEGAL_TRIGGERS)


class RAGQueryPipeline:
    def __init__(self, datastore: Optional[LocalDataStore] = None):
        self.store = datastore or store
        self.retriever = HybridRetriever(datastore=self.store, vector_weight=0.70, use_rrf=True)

    async def query(
        self,
        case_id: str,
        question: str,
        session_id: Optional[str] = None,
        document_ids: Optional[List[str]] = None,
    ) -> dict:
        start_time = time.time()

        # -------------------------------------------------------------
        # Guardrail 1: Fast rejection for blatantly non-legal questions
        # -------------------------------------------------------------
        if is_non_legal_prompt(question):
            latency_ms = int((time.time() - start_time) * 1000)
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
                    content=NON_LEGAL_REFUSAL_MESSAGE,
                    citations=[],
                )
            return {
                "answer": NON_LEGAL_REFUSAL_MESSAGE,
                "citations": [],
                "sources_used": 0,
                "latency_ms": latency_ms,
            }

        # -------------------------------------------------------------
        # 1. Embed query
        # -------------------------------------------------------------
        embeddings = await create_embeddings([question])
        query_embedding = embeddings[0] if embeddings else []

        # -------------------------------------------------------------
        # 2. Hybrid Retrieval: Vector Cosine + BM25 Keyword Scoring + RRF
        # -------------------------------------------------------------
        matched_chunks = await self.retriever.retrieve(
            query=question,
            query_embedding=query_embedding,
            case_id=case_id,
            top_k=settings.TOP_K_RERANK,
            min_similarity=settings.SIMILARITY_THRESHOLD,
            doc_ids=document_ids,
        )

        # Fallback to store.search_chunks if retriever returned empty but store has records
        if not matched_chunks:
            keywords = [w for w in re.findall(r"\w+", question.lower()) if len(w) > 2]
            matched_chunks = self.store.search_chunks(
                case_id=case_id,
                query_embedding=query_embedding,
                keywords=keywords,
                doc_ids=document_ids,
                top_k=settings.TOP_K_RERANK,
                min_similarity=settings.SIMILARITY_THRESHOLD,
            )

        if not matched_chunks:
            latency_ms = int((time.time() - start_time) * 1000)
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
                    content=NO_ANSWER_RESPONSE,
                    citations=[],
                )
            return {
                "answer": NO_ANSWER_RESPONSE,
                "citations": [],
                "sources_used": 0,
                "latency_ms": latency_ms,
            }

        # -------------------------------------------------------------
        # 3. Assemble Grounded Context Excerpts & Citations
        # -------------------------------------------------------------
        context_parts = []
        citations_available = []

        for i, chunk in enumerate(matched_chunks):
            doc_id = chunk.get("document_id")
            doc = self.store.get_document(doc_id) if doc_id else None
            doc_name = (
                chunk.get("original_filename")
                or (doc.get("original_filename") if doc else None)
                or "Document"
            )
            page_num = chunk.get("page_number", 1)
            text_snippet = chunk.get("chunk_text", "").strip()

            context_parts.append(
                f"[Source {i+1} | Document: '{doc_name}' | Page {page_num}]\n{text_snippet}\n"
            )
            citations_available.append({
                "source_id": i + 1,
                "document_id": doc_id,
                "document_name": doc_name,
                "page_number": page_num,
                "snippet": text_snippet[:220] + ("..." if len(text_snippet) > 220 else ""),
                "similarity_score": round(chunk.get("similarity_score", 0.0), 3),
            })

        context_str = "\n".join(context_parts)

        # -------------------------------------------------------------
        # 4. Strictly Grounded Legal Prompting
        # -------------------------------------------------------------
        messages = [
            {"role": "system", "content": RAG_SYSTEM_PROMPT},
            {
                "role": "user",
                "content": build_rag_user_prompt(context=context_str, question=question),
            },
        ]

        # Temperature = 0.0 for zero hallucination, strictly factual legal responses
        completion = await chat_completion(
            messages=messages,
            temperature=0.0,
            max_tokens=2500,
        )

        answer = completion.get("content", "").strip()
        latency_ms = int((time.time() - start_time) * 1000)

        # -------------------------------------------------------------
        # 5. Save Q&A to Session History
        # -------------------------------------------------------------
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
