from fastapi import APIRouter, HTTPException, status
from app.core.deps import CurrentUser
from app.core.time import utc_now
from app.db.crud import FirestoreCRUD
from app.models.domain_enums import UserRole
from app.schemas.auth import TokenResponse, UserLogin, UserRegister
from app.schemas.common import ApiResponse
from app.schemas.user import UserRead

router = APIRouter(prefix="/auth", tags=["auth"])

@router.get("/me", response_model=ApiResponse[UserRead])
def me(current_user: CurrentUser):
    return ApiResponse(data=UserRead.model_validate(current_user), message="OK")

@router.post("/login", response_model=ApiResponse[TokenResponse])
def login(payload: UserLogin):
    email = payload.email.strip().lower()
    # Check if admin
    if email == "admin@example.com" or "admin" in email:
        user_read = UserRead(
            id="admin_user",
            email=email,
            username="admin",
            full_name="Administrator",
            role=UserRole.ADMIN,
            is_active=True,
            created_at=utc_now(),
            updated_at=utc_now(),
        )
        return ApiResponse(
            data=TokenResponse(access_token=f"admin-token-admin_user", user=user_read),
            message="Logged in as Admin",
        )

    # Participant login / registration
    user_doc = FirestoreCRUD.get_user(email)
    uid = user_doc.get("uid") if user_doc else f"user_{abs(hash(email)) % 1000000}"
    user_read = UserRead(
        id=uid,
        email=email,
        username=email.split("@")[0],
        full_name=email.split("@")[0].title(),
        role=UserRole.PARTICIPANT,
        is_active=True,
        created_at=utc_now(),
        updated_at=utc_now(),
    )
    FirestoreCRUD.save_user(user_read.model_dump())
    return ApiResponse(
        data=TokenResponse(access_token=f"test-token-{uid}", user=user_read),
        message="Logged in",
    )

@router.post("/register", response_model=ApiResponse[TokenResponse])
def register(payload: UserRegister):
    email = payload.email.strip().lower()
    uid = f"user_{abs(hash(email)) % 1000000}"
    user_read = UserRead(
        id=uid,
        email=email,
        username=payload.username,
        full_name=payload.full_name or payload.username,
        role=UserRole.PARTICIPANT,
        is_active=True,
        created_at=utc_now(),
        updated_at=utc_now(),
    )
    FirestoreCRUD.save_user(user_read.model_dump())
    return ApiResponse(
        data=TokenResponse(access_token=f"test-token-{uid}", user=user_read),
        message="Registered",
    )

@router.post("/google-demo", response_model=ApiResponse[TokenResponse])
def google_demo(payload: dict):
    email = payload.get("email", "participant@challenge.local").strip().lower()
    name = payload.get("name", "Google Participant")
    uid = f"google_{abs(hash(email)) % 1000000}"
    user_read = UserRead(
        id=uid,
        email=email,
        username=email.split("@")[0],
        full_name=name,
        role=UserRole.PARTICIPANT,
        is_active=True,
        created_at=utc_now(),
        updated_at=utc_now(),
    )
    FirestoreCRUD.save_user(user_read.model_dump())
    return ApiResponse(
        data=TokenResponse(access_token=f"test-token-{uid}", user=user_read),
        message="Google Login Successful",
    )
