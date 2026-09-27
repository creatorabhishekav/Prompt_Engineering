from typing import Generic, Optional, TypeVar
from pydantic import BaseModel

T = TypeVar("T")

class ApiResponse(BaseModel, Generic[T]):
    status: str = "success"
    data: T
    message: str = "OK"

class ErrorResponse(BaseModel):
    status: str = "error"
    detail: str
