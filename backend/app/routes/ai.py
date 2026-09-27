from fastapi import APIRouter
from pydantic import BaseModel, Field
from app.core.config import get_settings
from app.schemas.common import ApiResponse

router = APIRouter(prefix="/ai", tags=["ai"])

class GenerateRequest(BaseModel):
    prompt: str = Field(min_length=1, max_length=4000)

class GenerateResponse(BaseModel):
    url: str
    provider: str
    demo: bool
    prompt: str

class AiStatusResponse(BaseModel):
    mode: str
    model: str = "openai/clip-vit-base-patch32"
    device: str = "cpu"
    loaded: bool = True
    provider: str
    configured: bool

@router.get("/status", response_model=ApiResponse[AiStatusResponse])
def ai_status():
    settings = get_settings()
    return ApiResponse(
        data=AiStatusResponse(
            mode=settings.IMAGE_EVALUATOR,
            model="openai/clip-vit-base-patch32",
            device="cpu",
            loaded=True,
            provider="Hybrid ML Evaluator",
            configured=True,
        ),
        message="OK",
    )

@router.post("/generate", response_model=ApiResponse[GenerateResponse])
def generate_image(payload: GenerateRequest):
    return ApiResponse(
        data=GenerateResponse(
            url="https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80",
            provider="Gemini Demo Provider",
            demo=True,
            prompt=payload.prompt,
        ),
        message="Image generated.",
    )
