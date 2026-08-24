import os
from datetime import datetime, timedelta, timezone

from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

import security
from database import get_db
from models import SessionToken, User

SESSION_LIFETIME_DAYS = int(os.getenv("SESSION_LIFETIME_DAYS", "30"))

bearer_scheme = HTTPBearer(auto_error=False)


def create_session(db: Session, user: User) -> tuple[str, SessionToken]:
    token = security.generate_token()
    session = SessionToken(
        user_id=user.id,
        token_hash=security.hash_token(token),
        expires_at=datetime.now(timezone.utc)
        + timedelta(days=SESSION_LIFETIME_DAYS),
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return token, session


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    if credentials is None:
        raise HTTPException(
            status_code=401,
            detail="You need to sign in to continue.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token_hash = security.hash_token(credentials.credentials)
    session = db.query(SessionToken).filter_by(token_hash=token_hash).first()

    if session is None:
        raise HTTPException(
            status_code=401,
            detail="Your session is no longer valid. Please sign in again.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    expires_at = session.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)

    if expires_at < datetime.now(timezone.utc):
        db.delete(session)
        db.commit()
        raise HTTPException(
            status_code=401,
            detail="Your session has expired. Please sign in again.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user = db.get(User, session.user_id)

    if user is None:
        raise HTTPException(
            status_code=401,
            detail="Account not found. Please sign in again.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return user


def revoke_session(db: Session, token: str) -> None:
    token_hash = security.hash_token(token)
    session = db.query(SessionToken).filter_by(token_hash=token_hash).first()
    if session is not None:
        db.delete(session)
        db.commit()


def revoke_user_sessions(db: Session, user_id: int) -> None:
    db.query(SessionToken).filter_by(user_id=user_id).delete()
    db.commit()
