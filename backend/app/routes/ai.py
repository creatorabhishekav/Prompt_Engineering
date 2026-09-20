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
    model: str = "openai/clip-vit-base-patch32"
    device: str = "cpu"
    loaded: bool = False
    provider: str
    configured: bool


@router.get("/status", response_model=ApiResponse[AiStatusResponse])
def ai_status():
    settings = get_settings()
    provider = get_ai_provider()
    
    ml_mode = settings.IMAGE_EVALUATOR
    ml_model = "openai/clip-vit-base-patch32"
    ml_device = "cpu"
    ml_loaded = False

    try:
        from app.services.ml_image_similarity import MLImageSimilarityService
        service = MLImageSimilarityService.get_instance()
        status_info = service.get_status()
        ml_mode = status_info.get("mode", ml_mode)
        ml_model = status_info.get("model", ml_model)
        ml_device = status_info.get("device", ml_device)
        ml_loaded = status_info.get("loaded", False)
    except Exception:
        pass

    return ApiResponse(
        data=AiStatusResponse(
            mode=ml_mode,
            model=ml_model,
            device=ml_device,
            loaded=ml_loaded,
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