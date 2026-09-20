from fastapi import APIRouter
from app.core.deps import CurrentUser
from app.schemas.auth import TokenResponse, UserLogin, UserRegister
from app.schemas.common import ApiResponse
from app.schemas.user import UserRead

router = APIRouter(prefix="/auth", tags=["auth"])

@router.get("/me", response_model=ApiResponse[UserRead])
def me(current_user: CurrentUser):
    return ApiResponse(data=UserRead.model_validate(current_user), message="OK")