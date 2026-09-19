from fastapi import APIRouter
from pydantic import BaseModel, Field

from app.core.config import get_settings
from app.schemas.common import ApiResponse
from app.services.ai.factory import get_ai_provider

router = APIRouter(prefix="/ai", tags=["ai"])


class GenerateRequest(BaseModel):
    prompt: str = Field(min_length=1, max_length=4000)


class GenerateResponse(BaseModel):
    url: str
    provider: str
    demo: bool


class AiStatusResponse(BaseModel):
    mode: str
    provider: str
    configured: bool


@router.get("/status", response_model=ApiResponse[AiStatusResponse])
def ai_status():
    settings = get_settings()
    provider = get_ai_provider()
    return ApiResponse(
        data=AiStatusResponse(
            mode=settings.AI_MODE,
            provider=provider.name,
            configured=provider.is_configured(),
        ),
        message="OK",
    )


@router.post("/generate", response_model=ApiResponse[GenerateResponse])
def generate_image(payload: GenerateRequest):
    provider = get_ai_provider()
    result = provider.generate(payload.prompt)
    return ApiResponse(
        data=GenerateResponse(
            url=result.url,
            provider=result.provider,
            demo=result.demo,
        ),
        message="Image generated.",
    )