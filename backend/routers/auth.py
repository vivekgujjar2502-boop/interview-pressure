import os
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

import crud
import schemas
import security
from database import get_db
from deps import (
    create_session,
    get_current_user,
    revoke_session,
    revoke_user_sessions,
)
from models import PasswordResetToken, User

RESET_DEV_MODE = os.getenv("RESET_DEV_MODE", "true").lower() == "true"
RESET_TOKEN_LIFETIME_MINUTES = 30
EMAIL_PATTERN_MESSAGE = "Please enter a valid email address."

router = APIRouter()
_bearer = HTTPBearer(auto_error=False)


def _validate_signup(payload: schemas.SignupIn) -> str:
    """Return the normalized email or raise a 400 with a clear message."""
    name = payload.name.strip()
    email = payload.email.strip().lower()

    if len(name) < 2:
        raise HTTPException(
            status_code=400, detail="Please enter your full name."
        )

    if "@" not in email or "." not in email.split("@")[-1]:
        raise HTTPException(status_code=400, detail=EMAIL_PATTERN_MESSAGE)

    reason = security.validate_password(payload.password)

    if reason is not None:
        raise HTTPException(status_code=400, detail=reason)

    if payload.password != payload.confirm_password:
        raise HTTPException(
            status_code=400, detail="Passwords do not match."
        )

    return email


@router.post("/signup", response_model=schemas.AuthOut)
def signup(
    payload: schemas.SignupIn,
    db: Session = Depends(get_db),
) -> schemas.AuthOut:
    email = _validate_signup(payload)

    if crud.get_user_by_email(db, email) is not None:
        raise HTTPException(
            status_code=409,
            detail="An account with this email already exists. Try signing in instead.",
        )

    user = crud.create_user(
        db,
        name=payload.name,
        email=email,
        password_hash=security.hash_password(payload.password),
    )
    token, _session = create_session(db, user)

    return schemas.AuthOut(
        token=token, user=schemas.UserOut.model_validate(user)
    )


@router.post("/login", response_model=schemas.AuthOut)
def login(
    payload: schemas.LoginIn,
    db: Session = Depends(get_db),
) -> schemas.AuthOut:
    user = crud.get_user_by_email(db, payload.email)

    if user is None or not security.verify_password(
        payload.password, user.password_hash
    ):
        raise HTTPException(
            status_code=401, detail="Invalid email or password."
        )

    token, _session = create_session(db, user)

    return schemas.AuthOut(
        token=token, user=schemas.UserOut.model_validate(user)
    )


@router.get("/me", response_model=schemas.UserOut)
def me(current_user: User = Depends(get_current_user)) -> schemas.UserOut:
    return schemas.UserOut.model_validate(current_user)


@router.post("/logout")
def logout(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    if credentials is not None:
        revoke_session(db, credentials.credentials)

    return {"message": "Signed out."}


@router.post("/change-password")
def change_password(
    payload: schemas.ChangePasswordIn,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    if not security.verify_password(
        payload.current_password, current_user.password_hash
    ):
        raise HTTPException(
            status_code=400,
            detail="Your current password is incorrect.",
        )

    reason = security.validate_password(payload.new_password)

    if reason is not None:
        raise HTTPException(status_code=400, detail=reason)

    if payload.new_password != payload.confirm_new_password:
        raise HTTPException(
            status_code=400, detail="New passwords do not match."
        )

    current_user.password_hash = security.hash_password(payload.new_password)
    db.commit()

    # Security: invalidate every existing session after a password change.
    revoke_user_sessions(db, current_user.id)
    token, _session = create_session(db, current_user)

    return {"message": "Password updated.", "token": token}


def _issue_reset_token(db: Session, user: User) -> str:
    token = security.generate_token()
    db.add(
        PasswordResetToken(
            user_id=user.id,
            token_hash=security.hash_token(token),
            expires_at=datetime.now(timezone.utc)
            + timedelta(minutes=RESET_TOKEN_LIFETIME_MINUTES),
        )
    )
    db.commit()
    return token


GENERIC_RESET_MESSAGE = (
    "If this account exists, a password reset has been created. "
    "Email delivery is not configured on this server."
)


@router.post("/forgot-password", response_model=schemas.MessageOut)
def forgot_password(
    payload: schemas.ForgotPasswordIn,
    db: Session = Depends(get_db),
) -> schemas.MessageOut:
    """No email provider is configured, so no email is sent and none is
    pretended. In local development mode (RESET_DEV_MODE=true) the reset
    token is returned directly so the flow stays testable."""
    user = crud.get_user_by_email(db, payload.email)

    dev_token = None
    if user is not None:
        dev_token = _issue_reset_token(db, user)

    if RESET_DEV_MODE and dev_token is not None:
        return schemas.MessageOut(
            message=(
                "Email delivery is not configured. Development mode: "
                "use the reset token below within 30 minutes."
            ),
            dev_reset_token=dev_token,
        )

    return schemas.MessageOut(message=GENERIC_RESET_MESSAGE)


@router.post("/reset-password")
def reset_password(
    payload: schemas.ResetPasswordIn,
    db: Session = Depends(get_db),
) -> dict:
    reason = security.validate_password(payload.new_password)

    if reason is not None:
        raise HTTPException(status_code=400, detail=reason)

    if payload.new_password != payload.confirm_new_password:
        raise HTTPException(
            status_code=400, detail="New passwords do not match."
        )

    token_hash = security.hash_token(payload.token.strip())
    record = (
        db.query(PasswordResetToken).filter_by(token_hash=token_hash).first()
    )

    invalid = HTTPException(
        status_code=400,
        detail="This reset link is invalid or has expired. Request a new one.",
    )

    if record is None or record.used:
        raise invalid

    expires_at = record.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)

    if expires_at < datetime.now(timezone.utc):
        raise invalid

    user = db.get(User, record.user_id)

    if user is None:
        raise invalid

    user.password_hash = security.hash_password(payload.new_password)
    record.used = True
    db.commit()
    revoke_user_sessions(db, user.id)

    return {"message": "Password has been reset. You can sign in now."}
