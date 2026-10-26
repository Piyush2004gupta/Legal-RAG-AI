"""
Database layer - routes all persistence to the local DataStore.
No PostgreSQL, pgvector, or external database required.
"""
from typing import AsyncGenerator
from app.core.store import store, LocalDataStore


class DummyBase:
    metadata = None


Base = DummyBase


async def get_db() -> LocalDataStore:
    """Dependency injection returning the embedded local DataStore."""
    return store
