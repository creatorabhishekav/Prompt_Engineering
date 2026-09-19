from fastapi import HTTPException, status
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.security import create_access_token, hash_password, verify_password
from app.models.user import User
from app.models.domain_enums import UserRole

settings = get_settings()


class AuthError(Exception):
    def __init__(self, message: str, status_code: int = status.HTTP_400_BAD_REQUEST):
        self.message = message
        self.status_code = status_code
        super().__init__(message)


def get_user_by_identifier(db: Session, identifier: str) -> User | None:
    stmt = select(User).where(
        or_(User.email == identifier.lower(), User.username == identifier)
    )
    return db.scalar(stmt)


def register_user(
    db: Session,
    *,
    email: str,
    username: str,
    password: str,
    full_name: str | None = None,
    role: UserRole = UserRole.PARTICIPANT,
) -> User:
    if get_user_by_identifier(db, email):
        raise AuthError("An account with that email already exists.", status.HTTP_409_CONFLICT)
    if get_user_by_identifier(db, username):
        raise AuthError("That username is already taken.", status.HTTP_409_CONFLICT)

    user = User(
        email=email.lower(),
        username=username,
        full_name=full_name,
        hashed_password=hash_password(password),
        role=role,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def authenticate_user(db: Session, *, email: str, password: str) -> User:
    user = get_user_by_identifier(db, email)
    if not user or not verify_password(password, user.hashed_password):
        raise AuthError("Incorrect email or password.", status.HTTP_401_UNAUTHORIZED)
    if not user.is_active:
        raise AuthError("This account is disabled.", status.HTTP_403_FORBIDDEN)
    return user


def build_token_response(user: User) -> dict:
    token = create_access_token(subject=user.id, role=user.role.value)
    return {
        "access_token": token,
        "token_type": "bearer",
        "expires_in": settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        "user": user,
    }


def handle_auth_error(exc: AuthError) -> HTTPException:
    return HTTPException(status_code=exc.status_code, detail=exc.message)