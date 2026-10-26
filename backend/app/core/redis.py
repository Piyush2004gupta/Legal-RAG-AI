"""
Redis client for job queue management (with safe fallback when Redis is absent).
"""
import structlog
from app.core.config import settings

log = structlog.get_logger()

_async_redis_client = None
_sync_redis_client = None


async def get_redis():
    global _async_redis_client
    if _async_redis_client is None and settings.REDIS_URL:
        try:
            import redis.asyncio as aioredis
            _async_redis_client = aioredis.from_url(
                settings.REDIS_URL,
                encoding="utf-8",
                decode_responses=True,
            )
        except Exception as e:
            log.warning("Could not connect to Redis", error=str(e))
    return _async_redis_client


def get_sync_redis():
    global _sync_redis_client
    if _sync_redis_client is None and settings.REDIS_URL:
        try:
            from redis import Redis
            _sync_redis_client = Redis.from_url(settings.REDIS_URL)
        except Exception as e:
            log.warning("Could not connect to sync Redis", error=str(e))
    return _sync_redis_client
