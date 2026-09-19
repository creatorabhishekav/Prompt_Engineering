from typing import Generic, TypeVar

from pydantic import BaseModel

T = TypeVar("T")


class ApiResponse(BaseModel, Generic[T]):
    """Consistent success envelope for API responses."""

    status: str = "success"
    data: T | None = None
    message: str | None = None


class MessageResponse(BaseModel):
    status: str = "success"
    message: str

    @classmethod
    def ok(cls, message: str) -> "MessageResponse":
        return cls(message=message)