"""
Background worker - processes document ingestion jobs from Redis queue.
"""
import asyncio
import sys
import os
import uuid
from datetime import datetime

import structlog
from rq import Queue, Worker
from rq.job import Job
from sqlalchemy import select, update

# Adjust path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.config import settings
from app.core.logging import configure_logging
from app.core.redis import get_sync_redis

configure_logging()
log = structlog.get_logger()


def process_document_job(document_id: str, job_id: str):
    """
    Synchronous entry point called by RQ worker.
    Runs the async ingestion pipeline in an event loop.
    """
    log.info("Worker: processing document", document_id=document_id, job_id=job_id)
    asyncio.run(_async_process(document_id, job_id))
    log.info("Worker: document done", document_id=document_id)


async def _async_process(document_id: str, job_id: str):
    from app.core.database import AsyncSessionLocal
    from app.ingestion.pipeline import DocumentIngestionPipeline

    async with AsyncSessionLocal() as db:
        pipeline = DocumentIngestionPipeline(db)
        await pipeline.process_document(document_id, job_id)


if __name__ == "__main__":
    log.info("Starting LegalDesk AI background worker")
    redis = get_sync_redis()
    queue = Queue("document_processing", connection=redis)

    worker = Worker([queue], connection=redis)
    worker.work(with_scheduler=True)
