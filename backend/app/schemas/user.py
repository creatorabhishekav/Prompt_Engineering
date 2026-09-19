from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.schemas.domain_enums import UserRole


class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    email: str
    username: str
    full_name: str | None = None
    avatar_url: str | None = None
    role: UserRole
    is_active: bool
    created_at: datetime
    updated_at: datetime