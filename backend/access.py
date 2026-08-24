"""Shared access-control helpers for routers."""

from fastapi import HTTPException
from sqlalchemy.orm import Session

import crud


def get_interview_or_404(db: Session, interview_id: int, user_id: int):
    """Return the interview only when it belongs to user_id."""
    interview = crud.get_interview_scoped(db, interview_id, user_id)

    if interview is None:
        raise HTTPException(status_code=404, detail="Interview not found.")

    return interview
