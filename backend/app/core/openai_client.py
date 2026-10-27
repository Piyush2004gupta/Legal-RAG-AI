"""
OpenAI client - singleton with retry logic.
Never exposes API key to frontend.
"""
from openai import AsyncOpenAI
from tenacity import retry, stop_after_attempt, wait_exponential
import structlog

from app.core.config import settings

log = structlog.get_logger()

_client: AsyncOpenAI | None = None


def get_openai_client() -> AsyncOpenAI:
    global _client
    if _client is None:
        _client = AsyncOpenAI(
            api_key=settings.OPENAI_API_KEY,
            timeout=120.0,
            max_retries=3,
        )
    return _client


@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=2, max=10),
)
async def create_embeddings(texts: list[str]) -> list[list[float]]:
    """Generate embeddings for a list of texts. Handles batching, pacing, and rate limit avoidance for massive 5000+ page datasets."""
    if not texts:
        return []

    client = get_openai_client()
    all_embeddings = []
    # Use smaller batch size (64) with slight sleep to avoid OpenAI 429 rate limit errors on thousands of chunks
    batch_size = 64

    for i in range(0, len(texts), batch_size):
        batch = texts[i : i + batch_size]
        # Sanitize: strip null bytes and clamp length to avoid token limit overflow
        cleaned = [t.replace("\x00", "").strip()[:6000] for t in batch]
        
        # Async call with retry
        response = await client.embeddings.create(
            model=settings.OPENAI_EMBEDDING_MODEL,
            input=cleaned,
            dimensions=settings.OPENAI_EMBEDDING_DIMENSIONS,
        )
        all_embeddings.extend([item.embedding for item in response.data])
        log.info("Embedding batch created", batch_start=i, batch_size=len(batch), total_done=len(all_embeddings), total=len(texts))
        
        # Yield to event loop and avoid hammering OpenAI API on massive page sets
        if i + batch_size < len(texts):
            import asyncio
            await asyncio.sleep(0.15)

    return all_embeddings


@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=2, max=10),
)
async def chat_completion(
    messages: list[dict],
    temperature: float = 0.1,
    max_tokens: int = 4096,
    response_format: dict | None = None,
) -> dict:
    """Call OpenAI chat completion with retry."""
    client = get_openai_client()
    kwargs = dict(
        model=settings.OPENAI_CHAT_MODEL,
        messages=messages,
        temperature=temperature,
        max_tokens=max_tokens,
    )
    if response_format:
        kwargs["response_format"] = response_format

    response = await client.chat.completions.create(**kwargs)
    return {
        "content": response.choices[0].message.content,
        "prompt_tokens": response.usage.prompt_tokens,
        "completion_tokens": response.usage.completion_tokens,
        "model": response.model,
    }
