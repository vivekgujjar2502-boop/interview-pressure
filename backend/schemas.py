from datetime import datetime
import json
from typing import Optional

from pydantic import BaseModel, ConfigDict, field_validator


def _decode_str_list(value) -> list:
    if value is None:
        return []
    if isinstance(value, list):
        return [str(item) for item in value]
    try:
        parsed = json.loads(value)
    except (json.JSONDecodeError, TypeError):
        return []
    return [str(item) for item in parsed] if isinstance(parsed, list) else []


class ResumeUploadOut(BaseModel):
    id: int
    filename: str
    text: str
    pages: int


class JobCreate(BaseModel):
    role: str
    company: str = ""
    experience: str = "Fresher"
    description: str = ""
    user_id: Optional[int] = None


class JobOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    role: str
    company: str
    experience: str
    description: str
    created_at: datetime


class InterviewCreate(BaseModel):
    resume_id: int
    job_id: int


class QuestionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    question_number: int
    question_text: str
    answer_text: Optional[str] = None


class InterviewOut(BaseModel):
    id: int
    status: str
    score: Optional[float]
    job_role: str
    company: str
    experience: str
    questions: list[QuestionOut]


class AnswerCreate(BaseModel):
    question_id: int
    answer_text: str


class AnswerOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    question_id: int
    answer_text: str
    score: Optional[float]
    feedback: str
    audio_path: Optional[str] = None
    transcript: Optional[str] = None
    strengths: list[str] = []
    weaknesses: list[str] = []
    improvement: str = ""
    communication_notes: str = ""
    ai_error: str = ""

    @field_validator("strengths", "weaknesses", mode="before")
    @classmethod
    def _decode_lists(cls, value):
        return _decode_str_list(value)


class FinishOut(BaseModel):
    interview_id: int
    status: str
    overall_score: float
    total_questions: int
    answered_questions: int


class ResultQuestionOut(BaseModel):
    question_number: int
    question_text: str
    answer_text: Optional[str] = None
    score: Optional[float] = None
    feedback: Optional[str] = None
    audio_path: Optional[str] = None
    transcript: Optional[str] = None
    strengths: list[str] = []
    weaknesses: list[str] = []
    improvement: str = ""
    communication_notes: str = ""
    ai_error: str = ""
    audio_metrics: dict = {}

    @field_validator("strengths", "weaknesses", mode="before")
    @classmethod
    def _decode_lists(cls, value):
        return _decode_str_list(value)

    @field_validator("audio_metrics", mode="before")
    @classmethod
    def _decode_metrics(cls, value):
        if isinstance(value, dict) or value in (None, ""):
            return value or {}
        try:
            parsed = json.loads(value)
        except (json.JSONDecodeError, TypeError):
            return {}
        return parsed if isinstance(parsed, dict) else {}


class TranscribeOut(BaseModel):
    question_id: int
    transcript: str
    audio_path: str
    audio_metrics: dict = {}


class EvaluateIn(BaseModel):
    answer_text: str


class ResultsOut(BaseModel):
    interview_id: int
    status: str
    overall_score: Optional[float] = None
    total_questions: int
    questions: list[ResultQuestionOut]


# ---------------------------------------------------------------------------
# Auth & profile
# ---------------------------------------------------------------------------

class SignupIn(BaseModel):
    name: str
    email: str
    password: str
    confirm_password: str


class LoginIn(BaseModel):
    email: str
    password: str


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    email: str
    created_at: datetime


class AuthOut(BaseModel):
    token: str
    user: UserOut


class ChangePasswordIn(BaseModel):
    current_password: str
    new_password: str
    confirm_new_password: str


class ForgotPasswordIn(BaseModel):
    email: str


class ResetPasswordIn(BaseModel):
    token: str
    new_password: str
    confirm_new_password: str


class ProfileUpdateIn(BaseModel):
    name: str


class MessageOut(BaseModel):
    message: str
    dev_reset_token: Optional[str] = None


# ---------------------------------------------------------------------------
# Resume library, history, dashboard stats
# ---------------------------------------------------------------------------

class ResumeOut(BaseModel):
    id: int
    filename: str
    pages: int = 0
    text_preview: str = ""
    uploaded_at: datetime


class InterviewSummaryOut(BaseModel):
    id: int
    role: str
    company: str
    experience: str
    status: str
    score: Optional[float] = None
    created_at: datetime
    completed_at: Optional[datetime] = None
    total_questions: int = 0
    answered_questions: int = 0


class StatsOut(BaseModel):
    interviews_completed: int
    average_score: Optional[float] = None
    best_score: Optional[float] = None
    questions_answered: int
