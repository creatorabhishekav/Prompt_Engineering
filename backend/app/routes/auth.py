from fastapi import APIRouter

from app.core.deps import CurrentUser, DbSession
from app.schemas.auth import TokenResponse, UserLogin, UserRegister
from app.schemas.common import ApiResponse
from app.schemas.user import UserRead
from app.services.auth_service import (
    AuthError,
    authenticate_user,
    build_token_response,
    handle_auth_error,
    register_user,
)

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=ApiResponse[TokenResponse], status_code=201)
def register(payload: UserRegister, db: DbSession):
    try:
        user = register_user(
            db,
            email=payload.email,
            username=payload.username,
            password=payload.password,
            full_name=payload.full_name,
        )
    except AuthError as exc:
        raise handle_auth_error(exc) from exc
    return ApiResponse(data=build_token_response(user), message="Registration successful.")


@router.post("/login", response_model=ApiResponse[TokenResponse])
def login(payload: UserLogin, db: DbSession):
    try:
        user = authenticate_user(db, email=payload.email, password=payload.password)
    except AuthError as exc:
        raise handle_auth_error(exc) from exc
    return ApiResponse(data=build_token_response(user), message="Login successful.")


@router.get("/me", response_model=ApiResponse[UserRead])
def me(current_user: CurrentUser):
    return ApiResponse(data=UserRead.model_validate(current_user), message="OK")