from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

import crud
import schemas
from database import get_db
from deps import get_current_user
from models import User

router = APIRouter()


@router.get("/me/stats", response_model=schemas.StatsOut)
def my_stats(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> schemas.StatsOut:
    return crud.build_user_stats(db, current_user.id)


@router.patch("/me", response_model=schemas.UserOut)
def update_profile(
    payload: schemas.ProfileUpdateIn,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> schemas.UserOut:
    name = payload.name.strip()

    if len(name) < 2:
        raise HTTPException(
            status_code=400, detail="Please enter your full name."
        )

    current_user.name = name
    db.commit()
    db.refresh(current_user)

    return schemas.UserOut.model_validate(current_user)
