"""
Workspace API - returns workspace details, real dynamic stats, and activity.
"""
from fastapi import APIRouter, Depends
from app.core.store import LocalDataStore, get_store
from app.core.config import settings

router = APIRouter()


@router.get("")
async def get_workspace(store: LocalDataStore = Depends(get_store)):
    workspace = store.get_workspace(settings.DEFAULT_WORKSPACE_ID)
    if not workspace:
        return {"id": settings.DEFAULT_WORKSPACE_ID, "name": "My Legal Practice", "slug": "default"}

    return {
        "id": workspace["id"],
        "name": workspace.get("name", "My Legal Practice"),
        "slug": workspace.get("slug", "default"),
    }


@router.get("/stats")
async def get_stats(store: LocalDataStore = Depends(get_store)):
    return store.get_workspace_stats()


@router.get("/activity")
async def get_activity(store: LocalDataStore = Depends(get_store)):
    return store.get_recent_activity(limit=10)
