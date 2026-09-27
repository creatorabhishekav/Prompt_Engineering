from typing import Optional
from pydantic import BaseModel
from app.schemas.user import UserRead

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserRead

class UserLogin(BaseModel):
    email: str
    password: str

class UserRegister(BaseModel):
    email: str
    username: str
    full_name: Optional[str] = None
    password: str
