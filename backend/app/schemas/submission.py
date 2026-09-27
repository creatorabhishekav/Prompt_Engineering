from datetime import datetime
from typing import Optional, Dict, Any
from pydantic import BaseModel, ConfigDict
from app.models.domain_enums import SubmissionStatus

class ScoreBreakdown(BaseModel):
    semantic_score: float = 0.0      # max 32
    composition_score: float = 0.0   # max 20
    objects_score: float = 0.0       # max 16
    color_score: float = 0.0         # max 8
    details_score: float = 0.0       # max 4
    total_score: float = 0.0         # max 80
    clip_similarity: Optional[float] = None
    evaluation_method: Optional[str] = "CLIP + computer vision"

class SubmissionUpdate(BaseModel):
    prompt: Optional[str] = None
    prompt_1: Optional[str] = None
    prompt_2: Optional[str] = None

class AdminSubmissionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    user_id: str
    username: str
    full_name: Optional[str] = None
    round_id: str
    round_title: str
    prompt_used: str = ""
    prompt_1: Optional[str] = None
    prompt_2: Optional[str] = None
    image_url: Optional[str] = None
    first_image_url: Optional[str] = None
    final_image_url: Optional[str] = None
    status: SubmissionStatus
    started_at_elapsed: Optional[int] = None
    deadline_elapsed: Optional[int] = None
    submitted_at: Optional[datetime] = None
    created_at: Optional[datetime] = None
    scoring_status: Optional[str] = "scored"
    semantic_score: Optional[float] = None
    composition_score: Optional[float] = None
    objects_score: Optional[float] = None
    color_score: Optional[float] = None
    details_score: Optional[float] = None
    total_score: Optional[float] = None
    clip_similarity: Optional[float] = None
    evaluation_method: Optional[str] = None
    first_score_breakdown: Optional[ScoreBreakdown] = None
    final_score_breakdown: Optional[ScoreBreakdown] = None
    first_score: Optional[float] = None
    final_score: Optional[float] = None
