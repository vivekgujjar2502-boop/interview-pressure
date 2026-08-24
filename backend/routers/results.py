from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

import access
import crud
import schemas
from database import get_db
from deps import get_current_user
from models import User

router = APIRouter()


@router.get("/{interview_id}/results", response_model=schemas.ResultsOut)
def get_results(
    interview_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> schemas.ResultsOut:
    interview = access.get_interview_or_404(
        db, interview_id, current_user.id
    )
    return crud.build_results(interview)
