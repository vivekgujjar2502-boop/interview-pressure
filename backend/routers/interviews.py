import json
import re
import shutil
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session

import access
import crud
import schemas
from database import get_db
from deps import get_current_user
from models import User
from services import ai_service
from services.audio_analysis import analyze_transcript_metrics
from services.transcription import (
    TranscriptionUnavailableError,
    transcribe_audio_detailed,
)

router = APIRouter()

AUDIO_ROOT = Path(__file__).resolve().parent.parent / "media" / "audio"
ALLOWED_AUDIO_EXTENSIONS = {".webm", ".wav", ".mp3", ".m4a", ".ogg"}
MAX_AUDIO_BYTES = 25 * 1024 * 1024

_SAFE_FILENAME_RE = re.compile(r"[^A-Za-z0-9._-]")


def _get_question_or_404(interview, question_id: int):
    question = next(
        (q for q in interview.questions if q.id == question_id), None
    )

    if question is None:
        raise HTTPException(
            status_code=404,
            detail="Question does not belong to this interview.",
        )

    return question


def _to_interview_out(interview) -> schemas.InterviewOut:
    return schemas.InterviewOut(
        id=interview.id,
        status=interview.status,
        score=interview.score,
        job_role=interview.job.role,
        company=interview.job.company,
        experience=interview.job.experience,
        questions=[
            schemas.QuestionOut(
                id=question.id,
                question_number=question.question_number,
                question_text=question.question_text,
                answer_text=(
                    question.answer.answer_text
                    if question.answer is not None
                    else None
                ),
            )
            for question in interview.questions
        ],
    )


def _job_description_text(interview) -> str:
    job = interview.job
    parts = []

    if job.role:
        parts.append(f"Target role: {job.role}")
    if job.company:
        parts.append(f"Company: {job.company}")
    if job.description:
        parts.append(job.description)

    return "\n".join(parts)


@router.post("", response_model=schemas.InterviewOut)
def create_interview(
    payload: schemas.InterviewCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> schemas.InterviewOut:
    resume = crud.get_resume_scoped(db, payload.resume_id, current_user.id)

    if resume is None:
        raise HTTPException(status_code=404, detail="Resume not found.")

    job = crud.get_job(db, payload.job_id, user_id=current_user.id)

    if job is None:
        raise HTTPException(status_code=404, detail="Job not found.")

    skills = crud.extract_skills(resume.extracted_text or "")
    fallback_questions = crud.build_questions(
        job.role, job.company, job.experience, skills
    )

    try:
        questions = ai_service.generate_questions(
            resume_text=resume.extracted_text or "",
            role=job.role,
            company=job.company,
            experience=job.experience,
            job_description=job.description or "",
        )
    except (ai_service.OllamaSetupError, ai_service.AiResponseError):
        # Deterministic fallback keeps the app fully usable without Ollama.
        questions = fallback_questions

    interview = crud.create_interview_with_questions(
        db, resume, job, questions
    )
    return _to_interview_out(interview)


@router.get("", response_model=list[schemas.InterviewSummaryOut])
def list_interviews(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[schemas.InterviewSummaryOut]:
    return [
        crud.build_interview_summary(interview)
        for interview in crud.list_interviews_scoped(db, current_user.id)
    ]


@router.get("/{interview_id}", response_model=schemas.InterviewOut)
def get_interview(
    interview_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> schemas.InterviewOut:
    interview = access.get_interview_or_404(db, interview_id, current_user.id)
    return _to_interview_out(interview)


@router.delete("/{interview_id}")
def delete_interview(
    interview_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    interview = access.get_interview_or_404(db, interview_id, current_user.id)

    audio_dir = AUDIO_ROOT / f"interview_{interview.id}"
    if audio_dir.exists():
        shutil.rmtree(audio_dir, ignore_errors=True)

    crud.delete_interview(db, interview)

    return {"message": "Interview deleted."}


# ---------------------------------------------------------------------------
# Voice flow stage 1: store recording + transcribe locally
# ---------------------------------------------------------------------------


def _save_audio_file(
    interview_id: int, question_number: int, file: UploadFile
) -> Path:
    extension = Path(file.filename or "").suffix.lower()

    if not extension:
        content_type = file.content_type or ""
        guessed = {
            "audio/webm": ".webm",
            "audio/wav": ".wav",
            "audio/x-wav": ".wav",
            "audio/mpeg": ".mp3",
            "audio/mp4": ".m4a",
            "audio/ogg": ".ogg",
        }.get(content_type, ".webm")
        extension = guessed

    if extension not in ALLOWED_AUDIO_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Unsupported audio type '{extension}'. "
                "Use webm, wav, mp3, m4a or ogg."
            ),
        )

    interview_dir = AUDIO_ROOT / f"interview_{interview_id}"

    try:
        interview_dir.mkdir(parents=True, exist_ok=True)
        timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S")
        safe_stem = _SAFE_FILENAME_RE.sub("", str(question_number)) or "q"
        target = interview_dir / f"question_{safe_stem}_{timestamp}{extension}"
        size = 0

        with open(target, "wb") as out_file:
            while chunk := file.file.read(1024 * 1024):
                size += len(chunk)

                if size > MAX_AUDIO_BYTES:
                    raise HTTPException(
                        status_code=413,
                        detail="Audio file is too large (max 25 MB).",
                    )

                out_file.write(chunk)
    except OSError as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Could not store the uploaded audio: {exc}",
        )

    return target


@router.post(
    "/{interview_id}/questions/{question_id}/audio",
    response_model=schemas.TranscribeOut,
)
async def transcribe_question_audio(
    interview_id: int,
    question_id: int,
    audio: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> schemas.TranscribeOut:
    """Stage 1 of the voice flow: upload the recording and transcribe it
    locally. Nothing is evaluated yet â€” the client shows a Transcribingâ€¦
    state during this call."""
    interview = access.get_interview_or_404(db, interview_id, current_user.id)
    question = _get_question_or_404(interview, question_id)

    audio_path = _save_audio_file(
        interview.id, question.question_number, audio
    )

    try:
        transcript, segments = transcribe_audio_detailed(str(audio_path))
    except TranscriptionUnavailableError as exc:
        raise HTTPException(status_code=503, detail=str(exc))

    metrics = analyze_transcript_metrics(transcript, segments)

    # Create/update the answer row early so the transcript and audio are
    # persisted even if evaluation fails later.
    answer = question.answer

    if answer is None:
        answer = crud.upsert_answer(
            db,
            question,
            "",
            transcript=transcript,
            audio_path=str(audio_path),
        )
        answer.audio_metrics = json.dumps(metrics)
    else:
        answer.transcript = transcript
        answer.audio_path = str(audio_path)
        answer.audio_metrics = json.dumps(metrics)

    db.commit()
    db.refresh(answer)

    return schemas.TranscribeOut(
        question_id=question.id,
        transcript=transcript,
        audio_path=str(audio_path),
        audio_metrics=metrics,
    )


# ---------------------------------------------------------------------------
# Stage 2: evaluate an answer (voice transcript or typed text)
# ---------------------------------------------------------------------------


def _evaluate_or_fallback(
    db: Session,
    answer,
    question,
    interview,
) -> schemas.AnswerOut:
    """Run local AI evaluation; on failure keep everything saved and
    report a clear setup message instead of crashing."""
    resume = interview.resume
    resume_text = resume.extracted_text if resume else ""

    try:
        evaluation = ai_service.evaluate_answer(
            question=question.question_text,
            transcript=answer.answer_text,
            resume_text=resume_text or "",
            job_description=_job_description_text(interview),
        )
    except (
        ai_service.OllamaSetupError,
        ai_service.AiResponseError,
    ) as exc:
        answer = crud.apply_ai_error(db, answer, str(exc))
        return answer

    return crud.apply_evaluation(db, answer, evaluation)


@router.post(
    "/{interview_id}/questions/{question_id}/evaluate",
    response_model=schemas.AnswerOut,
)
def evaluate_question_answer(
    interview_id: int,
    question_id: int,
    payload: schemas.EvaluateIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> schemas.AnswerOut:
    """Stage 2: save the final answer text (typed text, possibly edited
    voice transcript) and run local AI evaluation."""
    interview = access.get_interview_or_404(db, interview_id, current_user.id)
    question = _get_question_or_404(interview, question_id)

    answer_text = payload.answer_text.strip()

    if not answer_text:
        raise HTTPException(status_code=400, detail="Answer is empty.")

    existing = question.answer

    answer = crud.upsert_answer(
        db,
        question,
        answer_text,
        transcript=(
            existing.transcript if existing is not None else None
        ),
        audio_path=(
            existing.audio_path if existing is not None else None
        ),
    )

    return _evaluate_or_fallback(db, answer, question, interview)


@router.post("/{interview_id}/finish", response_model=schemas.FinishOut)
def finish_interview(
    interview_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> schemas.FinishOut:
    interview = access.get_interview_or_404(db, interview_id, current_user.id)

    if interview.status == "completed":
        raise HTTPException(
            status_code=400, detail="Interview already finished."
        )

    return crud.finish_interview(db, interview)

