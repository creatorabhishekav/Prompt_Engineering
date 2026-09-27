from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict
from app.models.domain_enums import LifecycleStatus, SubmissionStatus
from app.schemas.submission import ScoreBreakdown

class ActiveCompetitionRead(BaseModel):
    id: str
    title: str
    description: Optional[str] = None
    status: LifecycleStatus
    round_count: int = 0
    open_round_count: int = 0

class ActiveRoundRead(BaseModel):
    id: str
    competition_id: str
    competition_title: str
    round_number: int
    title: str
    description: Optional[str] = None
    time_limit_seconds: int = 600
    status: LifecycleStatus
    server_elapsed_seconds: int = 0
    target_image_url: Optional[str] = None

class ChallengeStatusRead(BaseModel):
    id: str
    round_id: str
    round_title: str
    competition_title: str
    time_limit_seconds: int
    round_status: LifecycleStatus
    target_image_url: Optional[str] = None

    # CRITICAL: SEPARATE TWO-STAGE URLS
    uploaded_image_url: Optional[str] = None
    first_image_url: Optional[str] = None
    final_image_url: Optional[str] = None

    status: str
    prompt: str = ""
    prompt_1: Optional[str] = None
    prompt_2: Optional[str] = None

    started_at_elapsed: Optional[int] = 0
    remaining_seconds: int = 600
    deadline_elapsed: Optional[int] = 600
    submitted_at: Optional[str] = None

    scoring_status: Optional[str] = None
    total_score: Optional[float] = None

    first_scoring_status: Optional[str] = None
    first_score: Optional[float] = None
    first_score_breakdown: Optional[ScoreBreakdown] = None

    final_score: Optional[float] = None
    final_score_breakdown: Optional[ScoreBreakdown] = None
