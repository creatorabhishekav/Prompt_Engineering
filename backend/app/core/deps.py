from typing import Annotated, Dict, Any, Optional
import logging
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
import firebase_admin
from firebase_admin import auth as firebase_auth

from app.core.config import get_settings
from app.core.security import decode_token
from app.db.crud import FirestoreCRUD
from app.models.domain_enums import UserRole
from app.models.user import User

logger = logging.getLogger("app.core.deps")
settings = get_settings()

from sqlalchemy.orm import Session
from app.db.session import get_db

bearer_scheme = HTTPBearer(auto_error=False)
DbSession = Annotated[Session, Depends(get_db)]
Credentials = Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)]

def get_current_user(credentials: Credentials) -> User:
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    token = credentials.credentials
    uid = None
    email = None
    name = None
    role_from_token = None

    # Ensure Firebase Admin SDK app is initialized if service account exists
    if not firebase_admin._apps:
        from app.db.firestore import get_firestore_db
        get_firestore_db()

    # Try verifying with Firebase Admin SDK
    try:
        decoded = firebase_auth.verify_id_token(token)
        uid = decoded.get("uid")
        email = decoded.get("email")
        name = decoded.get("name")
        aud = decoded.get("aud")
        iss = decoded.get("iss")
        exp = decoded.get("exp")
        auth_time = decoded.get("auth_time")
        logger.info(f"[FIREBASE TOKEN VERIFIED] uid={uid}, email={email}, aud={aud}, iss={iss}, exp={exp}, auth_time={auth_time}")
        if decoded.get("admin") is True:
            role_from_token = UserRole.ADMIN
    except Exception as e:
        logger.warning(f"[FIREBASE VERIFICATION FAILED] Exception type: {type(e).__name__}, Detail: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid or expired Firebase authentication token ({type(e).__name__}).",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not uid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Fetch user from Firestore
    user_doc = FirestoreCRUD.get_user(uid)
    if not user_doc:
        # Auto-create PARTICIPANT for newly authenticated Google users
        user_doc = FirestoreCRUD.save_user({
            "uid": uid,
            "email": email or f"{uid}@firebase.user",
            "username": (name or email or f"user_{uid[:6]}").replace(" ", "_"),
            "full_name": name or "",
            "role": (role_from_token or UserRole.PARTICIPANT).value,
            "is_active": True,
        })
    elif role_from_token == UserRole.ADMIN and user_doc.get("role") != UserRole.ADMIN.value:
        # If token has admin custom claim, sync Firestore user role
        user_doc["role"] = UserRole.ADMIN.value
        FirestoreCRUD.save_user(user_doc)

    if not user_doc.get("is_active", True):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account disabled.")

    from datetime import datetime, timezone
    now_dt = datetime.now(timezone.utc)
    user = User(
        id=user_doc.get("uid") or user_doc.get("id"),
        email=user_doc.get("email", ""),
        username=user_doc.get("username") or (name or email or f"user_{uid[:6]}").replace(" ", "_"),
        full_name=user_doc.get("full_name") or user_doc.get("displayName"),
        avatar_url=user_doc.get("photoURL") or user_doc.get("avatar_url"),
        role=UserRole(user_doc.get("role", UserRole.PARTICIPANT.value)),
        is_active=user_doc.get("is_active", True),
        created_at=now_dt,
        updated_at=now_dt,
    )
    return user

CurrentUser = Annotated[User, Depends(get_current_user)]

def require_roles(*roles: UserRole):
    def dependency(user: CurrentUser) -> User:
        if user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied. You do not have permission to perform this action.",
            )
        return user
    return dependency

AdminUser = Annotated[User, Depends(require_roles(UserRole.ADMIN))]