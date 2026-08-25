from contextlib import asynccontextmanager

import os

from dotenv import load_dotenv
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import inspect, text

load_dotenv()

import logging  # noqa: E402

import models  # noqa: E402
from database import engine  # noqa: E402
from routers import auth, interviews, jobs, resumes, results, users  # noqa: E402

logger = logging.getLogger("interviewpressure")


def _ensure_sqlite_columns() -> None:
    """Add columns introduced after the first release to an existing DB."""
    expected = {
        "users": {
            "password_hash": "VARCHAR(255)",
            "updated_at": "DATETIME",
        },
        "resumes": {
            "file_path": "VARCHAR(500)",
            "pages": "INTEGER",
        },
        "interviews": {
            "completed_at": "DATETIME",
        },
        "answers": {
            "audio_path": "VARCHAR(500)",
            "transcript": "TEXT",
            "strengths": "TEXT",
            "weaknesses": "TEXT",
            "improvement": "TEXT",
            "communication_notes": "TEXT",
            "ai_error": "TEXT",
            "audio_metrics": "TEXT",
            "created_at": "DATETIME",
        },
    }

    inspector = inspect(engine)

    for table_name, columns in expected.items():
        if table_name not in inspector.get_table_names():
            continue
        existing = {
            column["name"] for column in inspector.get_columns(table_name)
        }
        with engine.begin() as connection:
            for column_name, column_type in columns.items():
                if column_name not in existing:
                    connection.execute(
                        text(
                            f"ALTER TABLE {table_name} "
                            f"ADD COLUMN {column_name} {column_type}"
                        )
                    )


@asynccontextmanager
async def lifespan(app: FastAPI):
    models.Base.metadata.create_all(bind=engine)
    _ensure_sqlite_columns()
    yield


app = FastAPI(title="InterviewPressure API", lifespan=lifespan)

_frontend_origins = [
    origin.strip()
    for origin in os.getenv("FRONTEND_ORIGINS", "").split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        *_frontend_origins,
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(users.router, prefix="/api/users", tags=["users"])
app.include_router(resumes.router, prefix="/api/resumes", tags=["resumes"])
app.include_router(jobs.router, prefix="/api/jobs", tags=["jobs"])
app.include_router(
    interviews.router, prefix="/api/interviews", tags=["interviews"]
)
app.include_router(results.router, prefix="/api/interviews", tags=["results"])


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    """Never leak stack traces to clients; log them server-side instead."""
    logger.exception("Unhandled error on %s %s", request.method, request.url.path)
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error. Please try again."},
    )


@app.get("/api/health")
def health() -> dict:
    return {"status": "ok"}
