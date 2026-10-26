"""
LegalDesk AI - Application Launcher.
Starts the FastAPI application and serves the complete advocate workspace.
Runs 100% locally with zero external database dependencies (no PostgreSQL, no Docker, no Redis).
"""
import sys
import os
from pathlib import Path

# Add backend directory to sys.path
backend_dir = Path(__file__).parent / "backend"
sys.path.insert(0, str(backend_dir))

import uvicorn

if __name__ == "__main__":
    print("\n=======================================================")
    print("  ⚖  Starting LegalDesk AI - Indian Advocate Workspace")
    print("  URL: http://localhost:8000")
    print("  API Docs: http://localhost:8000/api/docs")
    print("  Database: Embedded Local Store (Zero external DB)")
    print("=======================================================\n")
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
