from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload

import models
import schemas

DEFAULT_USER_EMAIL = "guest@interviewpressure.local"
DEFAULT_USER_NAME = "Guest"

COMMON_SKILLS = [
    "JavaScript",
    "TypeScript",
    "React",
    "Next.js",
    "Node.js",
    "Python",
    "Java",
    "C++",
    "SQL",
    "MongoDB",
    "AWS",
    "Docker",
    "Git",
    "HTML",
    "CSS",
    "Tailwind",
    "REST API",
    "Machine Learning",
    "Data Analysis",
    "Figma",
]


def get_or_create_default_user(db: Session) -> models.User:
    user = db.scalar(
        select(models.User).where(models.User.email == DEFAULT_USER_EMAIL)
    )
    if user is None:
        user = models.User(name=DEFAULT_USER_NAME, email=DEFAULT_USER_EMAIL)
        db.add(user)
        db.commit()
        db.refresh(user)
    return user


def get_user_by_email(db: Session, email: str) -> models.User | None:
    return db.scalar(
        select(models.User).where(
            func.lower(models.User.email) == email.strip().lower()
        )
    )


def create_user(
    db: Session, *, name: str, email: str, password_hash: str
) -> models.User:
    user = models.User(
        name=name.strip(), email=email.strip().lower(),
        password_hash=password_hash,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def get_user_by_id(db: Session, user_id: int) -> models.User | None:
    return db.get(models.User, user_id)


def create_resume(
    db: Session,
    *,
    user: models.User,
    filename: str,
    extracted_text: str,
    pages: int = 0,
    file_path: str | None = None,
) -> models.Resume:
    resume = models.Resume(
        user_id=user.id,
        filename=filename,
        extracted_text=extracted_text,
        pages=pages,
        file_path=file_path,
    )
    db.add(resume)
    db.commit()
    db.refresh(resume)
    return resume


def list_resumes(db: Session, user_id: int) -> list[models.Resume]:
    return list(
        db.scalars(
            select(models.Resume)
            .where(models.Resume.user_id == user_id)
            .order_by(models.Resume.uploaded_at.desc())
        )
    )


def get_resume_scoped(
    db: Session, resume_id: int, user_id: int
) -> models.Resume | None:
    return db.scalar(
        select(models.Resume).where(
            models.Resume.id == resume_id,
            models.Resume.user_id == user_id,
        )
    )


def get_job(db: Session, job_id: int, *, user_id: int | None = None) -> models.Job | None:
    statement = select(models.Job).where(models.Job.id == job_id)

    if user_id is not None:
        statement = statement.where(models.Job.user_id == user_id)

    return db.scalar(statement)


def create_job(
    db: Session, payload: schemas.JobCreate, *, user: models.User
) -> models.Job:
    job = models.Job(
        user_id=user.id,
        role=payload.role.strip(),
        company=payload.company.strip(),
        experience=payload.experience,
        description=payload.description.strip(),
    )
    db.add(job)
    db.commit()
    db.refresh(job)
    return job


def get_interview_scoped(
    db: Session, interview_id: int, user_id: int
) -> models.Interview | None:
    """Fetch an interview owned by the given user (404-equivalent otherwise)."""
    return db.scalar(
        select(models.Interview)
        .where(
            models.Interview.id == interview_id,
            models.Interview.user_id == user_id,
        )
        .options(
            joinedload(models.Interview.job),
            joinedload(models.Interview.questions).joinedload(
                models.Question.answer
            ),
        )
    )


def extract_skills(resume_text: str) -> list[str]:
    lower_case_resume = resume_text.lower()
    matches = [
        skill
        for skill in COMMON_SKILLS
        if skill.lower() in lower_case_resume
    ]
    return matches[:3]


def format_skill_list(skills: list[str]) -> str:
    if len(skills) == 1:
        return skills[0]
    return ", ".join(skills[:-1]) + f" and {skills[-1]}"


def build_questions(
    role: str,
    company: str,
    experience: str,
    skills: list[str],
) -> list[str]:
    at_company = f" at {company}" if company else ""

    experience_question = (
        "What has been the biggest challenge in your professional journey "
        "so far, and what did you learn from it?"
    )

    match experience:
        case "Fresher":
            experience_question = (
                "You are at the very start of your career. What project or "
                "coursework are you most proud of, and what did it teach you "
                "about working like a professional?"
            )
        case "0–1 Years":
            experience_question = (
                "You have recently started working professionally. What is "
                "the biggest difference between academic projects and "
                "real-world work for you?"
            )
        case "1–2 Years":
            experience_question = (
                "With one to two years of experience, which part of your "
                "craft have you improved the most, and how did that "
                "improvement show in your work?"
            )
        case "2–5 Years":
            experience_question = (
                "At your level, teams expect ownership. Tell me about a "
                "feature or project you drove end to end and the impact it "
                "had."
            )
        case "5+ Years":
            experience_question = (
                "As a senior candidate, tell me about a time you influenced "
                "an architectural decision or mentored other engineers. What "
                "was the outcome?"
            )

    if skills:
        skill_question = (
            f"I noticed {format_skill_list(skills)} on your resume. Describe "
            f"a specific situation where you used {skills[0]} to solve a "
            "real problem."
        )
    else:
        skill_question = (
            f"What technical strengths would you bring to this {role} "
            "position, and how have you applied them so far?"
        )

    company_clause = (
        f" — you are interviewing with {company}" if company else ""
    )

    return [
        (
            f"Tell me about yourself and why you are interested in the "
            f"{role} role{at_company}."
        ),
        experience_question,
        skill_question,
        (
            f"Walk me through the most challenging technical problem you "
            f"have solved so far, and how it prepared you to work as a "
            f"{role}."
        ),
        (
            f"Last one{company_clause}: imagine a deadline is at risk and "
            "your lead is unavailable. What exactly do you do, and how do "
            "you communicate it?"
        ),
    ]


def create_interview_with_questions(
    db: Session,
    resume: models.Resume,
    job: models.Job,
    question_texts: list[str],
) -> models.Interview:
    interview = models.Interview(
        user_id=job.user_id,
        resume_id=resume.id,
        job_id=job.id,
        status="in_progress",
    )
    db.add(interview)
    db.flush()

    for number, text in enumerate(question_texts, start=1):
        db.add(
            models.Question(
                interview_id=interview.id,
                question_text=text,
                question_number=number,
            )
        )

    db.commit()
    db.refresh(interview)
    return interview


def list_interviews_scoped(
    db: Session, user_id: int
) -> list[models.Interview]:
    return list(
        db.scalars(
            select(models.Interview)
            .where(models.Interview.user_id == user_id)
            .options(joinedload(models.Interview.job))
            .order_by(models.Interview.created_at.desc())
        )
    )


def build_interview_summary(
    interview: models.Interview,
) -> schemas.InterviewSummaryOut:
    total = len(interview.questions)
    answered = sum(
        1
        for question in interview.questions
        if question.answer is not None
        and question.answer.answer_text.strip()
    )

    return schemas.InterviewSummaryOut(
        id=interview.id,
        role=interview.job.role,
        company=interview.job.company,
        experience=interview.job.experience,
        status=interview.status,
        score=interview.score,
        created_at=interview.created_at,
        completed_at=interview.completed_at,
        total_questions=total,
        answered_questions=answered,
    )


def build_user_stats(db: Session, user_id: int) -> schemas.StatsOut:
    completed_scores = list(
        db.scalars(
            select(models.Interview.score).where(
                models.Interview.user_id == user_id,
                models.Interview.status == "completed",
                models.Interview.score.is_not(None),
            )
        )
    )

    questions_answered = (
        db.scalar(
            select(func.count(models.Answer.id))
            .select_from(models.Answer)
            .join(models.Question)
            .join(models.Interview)
            .where(
                models.Interview.user_id == user_id,
                func.length(models.Answer.answer_text) > 0,
            )
        )
        or 0
    )

    completed_count = (
        db.scalar(
            select(func.count(models.Interview.id)).where(
                models.Interview.user_id == user_id,
                models.Interview.status == "completed",
            )
        )
        or 0
    )

    return schemas.StatsOut(
        interviews_completed=completed_count,
        average_score=(
            round(sum(completed_scores) / len(completed_scores), 1)
            if completed_scores
            else None
        ),
        best_score=max(completed_scores) if completed_scores else None,
        questions_answered=questions_answered,
    )


def delete_interview(db: Session, interview: models.Interview) -> None:
    db.delete(interview)
    db.commit()


def placeholder_score(answer_text: str) -> float:
    word_count = len(answer_text.split())
    return round(min(9.0, 5.0 + word_count * 0.05), 1)


def encode_str_list(items: list[str]) -> str:
    import json

    return json.dumps(items, ensure_ascii=False)


def decode_str_list(raw: str | None) -> list[str]:
    import json

    if not raw:
        return []
    try:
        data = json.loads(raw)
    except (json.JSONDecodeError, TypeError):
        return []
    if not isinstance(data, list):
        return []
    return [str(item) for item in data]


def decode_dict(raw: str | None) -> dict:
    import json

    if not raw:
        return {}
    try:
        data = json.loads(raw)
    except (json.JSONDecodeError, TypeError):
        return {}
    return data if isinstance(data, dict) else {}


AI_UNAVAILABLE_FEEDBACK = (
    "Answer saved. Local AI evaluation is unavailable right now, "
    "so a placeholder score was used."
)


def upsert_answer(
    db: Session,
    question: models.Question,
    answer_text: str,
    *,
    transcript: str | None = None,
    audio_path: str | None = None,
) -> models.Answer:
    """Create/update the answer row for a question.

    Applies a placeholder score; callers can then apply_evaluation()
    with real AI results.
    """
    answer = question.answer

    if answer is None:
        answer = models.Answer(question_id=question.id, answer_text="")
        db.add(answer)

    answer.answer_text = answer_text
    if transcript is not None:
        answer.transcript = transcript
    if audio_path is not None:
        answer.audio_path = audio_path
    answer.score = placeholder_score(answer_text)
    answer.feedback = "Placeholder feedback: AI evaluation will be added soon."
    answer.strengths = ""
    answer.weaknesses = ""
    answer.improvement = ""
    answer.communication_notes = ""

    db.commit()
    db.refresh(answer)
    return answer


def apply_evaluation(
    db: Session,
    answer: models.Answer,
    evaluation: dict,
) -> models.Answer:
    answer.score = float(evaluation["score"])
    answer.feedback = evaluation.get("feedback", "")
    answer.strengths = encode_str_list(evaluation.get("strengths", []))
    answer.weaknesses = encode_str_list(evaluation.get("weaknesses", []))
    answer.improvement = evaluation.get("improvement", "")
    answer.communication_notes = evaluation.get("communication_notes", "")
    answer.ai_error = ""

    db.commit()
    db.refresh(answer)
    return answer


def apply_ai_error(
    db: Session,
    answer: models.Answer,
    message: str,
) -> models.Answer:
    """Keep transcript + placeholder score when AI evaluation fails."""
    answer.feedback = AI_UNAVAILABLE_FEEDBACK
    answer.ai_error = message

    db.commit()
    db.refresh(answer)
    return answer


def finish_interview(db: Session, interview: models.Interview) -> dict:
    scores = [
        question.answer.score
        for question in interview.questions
        if question.answer is not None and question.answer.score is not None
    ]
    overall_score = round(sum(scores) / len(scores), 2) if scores else 0.0

    interview.status = "completed"
    interview.score = overall_score
    interview.completed_at = datetime.now(timezone.utc)
    db.commit()

    answered = sum(
        1
        for question in interview.questions
        if question.answer is not None
        and question.answer.answer_text.strip()
    )

    return {
        "interview_id": interview.id,
        "status": interview.status,
        "overall_score": overall_score,
        "total_questions": len(interview.questions),
        "answered_questions": answered,
    }


def build_results(interview: models.Interview) -> dict:
    result_questions = []
    for question in interview.questions:
        answer = question.answer
        result_questions.append(
            {
                "question_number": question.question_number,
                "question_text": question.question_text,
                "answer_text": (
                    answer.answer_text if answer is not None else None
                ),
                "score": answer.score if answer is not None else None,
                "feedback": (
                    answer.feedback if answer is not None else None
                ),
                "audio_path": (
                    answer.audio_path if answer is not None else None
                ),
                "transcript": (
                    answer.transcript if answer is not None else None
                ),
                "strengths": (
                    decode_str_list(answer.strengths)
                    if answer is not None
                    else []
                ),
                "weaknesses": (
                    decode_str_list(answer.weaknesses)
                    if answer is not None
                    else []
                ),
                "improvement": (
                    answer.improvement if answer is not None else ""
                ),
                "communication_notes": (
                    answer.communication_notes
                    if answer is not None
                    else ""
                ),
                "ai_error": (
                    answer.ai_error if answer is not None else ""
                ),
                "audio_metrics": (
                    decode_dict(answer.audio_metrics)
                    if answer is not None
                    else {}
                ),
            }
        )

    return {
        "interview_id": interview.id,
        "status": interview.status,
        "overall_score": interview.score,
        "total_questions": len(interview.questions),
        "questions": result_questions,
    }
