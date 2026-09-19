from datetime import datetime

from pydantic import BaseModel

from app.schemas.domain_enums import LifecycleStatus


class ActiveCompetitionRead(BaseModel):
    id: str
    title: str
    description: str | None = None
    status: LifecycleStatus
    round_count: int
    open_round_count: int


class ActiveRoundRead(BaseModel):
    id: str
    competition_id: str
    competition_title: str
    round_number: int
    title: str
    description: str | None = None
    time_limit_seconds: int
    status: LifecycleStatus
    server_elapsed_seconds: int
    target_image_url: str | None = None


class ChallengeStatusRead(BaseModel):
    id: str
    round_id: str
    round_title: str
    competition_title: str
    time_limit_seconds: int
    round_status: LifecycleStatus
    target_image_url: str | None = None
    uploaded_image_url: str | None = None
    status: str
    prompt: str = ""
    started_at_elapsed: int | None = None
    remaining_seconds: int = 0
    deadline_elapsed: int | None = None
    submitted_at: datetime | None = None
    scoring_status: str | None = None
    total_score: float | None = None