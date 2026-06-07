"""Ricettario backend — minimal FastAPI app.

Responsibilities (see CLAUDE.md §3):
  1. Serve the frontend (static files).
  2. (future) Expose a deterministic recipe-generation API.

The backend is STATELESS with respect to user data: recipes and ingredients
live in the browser (IndexedDB). Nothing is persisted server-side.
"""

from pathlib import Path

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

app = FastAPI(title="Ricettario")

# Path to the frontend folder (sibling of the backend folder).
FRONTEND_DIR = Path(__file__).resolve().parent.parent / "frontend"


# --- API placeholder (NOT implemented yet) -----------------------------------
# Future deterministic recipe generator (CLAUDE.md §6). It will receive
# ingredients/parameters from the browser, run pure arithmetic/rule-based
# calculations, and return one or more recipes — no AI at runtime.
#
# @app.post("/api/genera")
# def genera_ricetta(payload: ...):
#     ...
# -----------------------------------------------------------------------------


# Serve the frontend. `html=True` makes "/" return index.html.
# Mounted last so it does not shadow future /api routes.
app.mount("/", StaticFiles(directory=FRONTEND_DIR, html=True), name="frontend")
