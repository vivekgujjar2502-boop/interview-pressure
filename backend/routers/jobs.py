from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

import crud
import schemas
from database import get_db
from deps import get_current_user
from models import User

router = APIRouter()


@router.post("", response_model=schemas.JobOut)
def create_job(
    payload: schemas.JobCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> schemas.JobOut:
    role = payload.role.strip()

    if not role:
        raise HTTPException(
            status_code=400, detail="Job role is required."
        )

    job = crud.create_job(db, payload, user=current_user)
    return job


@router.get("/{job_id}", response_model=schemas.JobOut)
def get_job(
    job_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> schemas.JobOut:
    job = crud.get_job(db, job_id, user_id=current_user.id)

    if job is None:
        raise HTTPException(status_code=404, detail="Job not found.")

    return job
