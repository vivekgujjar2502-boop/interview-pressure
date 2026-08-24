import io
import re
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from pypdf import PdfReader
from sqlalchemy.orm import Session

import crud
import schemas
from database import get_db
from models import Resume, User
from deps import get_current_user

router = APIRouter()

UPLOAD_ROOT = Path(__file__).resolve().parent.parent / "media" / "resumes"
MAX_PDF_BYTES = 10 * 1024 * 1024

_SAFE_NAME_RE = re.compile(r"[^A-Za-z0-9._-]")


def _safe_filename(original: str) -> str:
    stem = Path(original).stem[:80]
    safe_stem = _SAFE_NAME_RE.sub("_", stem) or "resume"
    return f"{safe_stem}.pdf"


@router.post("/upload", response_model=schemas.ResumeUploadOut)
async def upload_resume(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> schemas.ResumeUploadOut:
    filename = file.filename or "resume.pdf"

    if not filename.lower().endswith(".pdf"):
        raise HTTPException(
            status_code=400,
            detail="Only PDF files are supported.",
        )

    pdf_bytes = await file.read()

    if len(pdf_bytes) > MAX_PDF_BYTES:
        raise HTTPException(
            status_code=413,
            detail="Resume is too large. Maximum size is 10 MB.",
        )

    try:
        reader = PdfReader(io.BytesIO(pdf_bytes))
        pages_text = [page.extract_text() or "" for page in reader.pages]
    except Exception:
        raise HTTPException(
            status_code=400,
            detail=(
                "This PDF could not be processed. It may be corrupted or "
                "password protected."
            ),
        )

    extracted_text = "\n".join(pages_text).strip()
    page_count = len(reader.pages)

    if not extracted_text:
        extracted_text = ""

    stored_path: str | None = None

    user_dir = UPLOAD_ROOT / f"user_{current_user.id}"
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S")
    target = user_dir / f"{timestamp}_{_safe_filename(filename)}"

    try:
        user_dir.mkdir(parents=True, exist_ok=True)
        target.write_bytes(pdf_bytes)
        stored_path = str(target)
    except OSError:
        # Text extraction still succeeded; storing the file is a bonus.
        stored_path = None

    resume = crud.create_resume(
        db,
        user=current_user,
        filename=filename,
        extracted_text=extracted_text,
        pages=page_count,
        file_path=stored_path,
    )

    return schemas.ResumeUploadOut(
        id=resume.id,
        filename=resume.filename,
        text=extracted_text,
        pages=page_count,
    )


@router.get("", response_model=list[schemas.ResumeOut])
def list_resumes(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[schemas.ResumeOut]:
    resumes = crud.list_resumes(db, current_user.id)

    return [
        schemas.ResumeOut(
            id=resume.id,
            filename=resume.filename,
            pages=resume.pages,
            text_preview=(resume.extracted_text or "")[:300],
            uploaded_at=resume.uploaded_at,
        )
        for resume in resumes
    ]


@router.get("/{resume_id}", response_model=schemas.ResumeUploadOut)
def get_resume(
    resume_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> schemas.ResumeUploadOut:
    resume = crud.get_resume_scoped(db, resume_id, current_user.id)

    if resume is None:
        raise HTTPException(status_code=404, detail="Resume not found.")

    return schemas.ResumeUploadOut(
        id=resume.id,
        filename=resume.filename,
        text=resume.extracted_text,
        pages=resume.pages,
    )


@router.delete("/{resume_id}")
def delete_resume(
    resume_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    resume = crud.get_resume_scoped(db, resume_id, current_user.id)

    if resume is None:
        raise HTTPException(status_code=404, detail="Resume not found.")

    if resume.interviews:
        raise HTTPException(
            status_code=409,
            detail=(
                "This resume is used by existing interviews and cannot be "
                "deleted. Delete those interviews first."
            ),
        )

    if resume.file_path:
        try:
            Path(resume.file_path).unlink(missing_ok=True)
        except OSError:
            pass  # DB cleanup must succeed even if the file is locked.

    db.delete(resume)
    db.commit()

    return {"message": "Resume deleted."}
