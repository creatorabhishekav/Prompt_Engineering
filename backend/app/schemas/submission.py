from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.domain_enums import SubmissionStatus


class SubmissionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    user_id: str
    round_id: str
    target_image_id: str | None = None
    image_url: str | None = None
    prompt_used: str
    status: SubmissionStatus
    started_at_elapsed: int | None = None
    deadline_elapsed: int | None = None
    submitted_at: datetime | None = None
    created_at: datetime
    updated_at: datetime


class SubmissionUpdate(BaseModel):
    prompt: str = Field(default="", max_length=4000)


class AdminSubmissionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    user_id: str
    username: str
    full_name: str | None = None
    round_id: str
    round_title: str
    prompt_used: str
    image_url: str | None = None
    status: SubmissionStatus
    started_at_elapsed: int | None = None
    deadline_elapsed: int | None = None
    submitted_at: datetime | None = None
    created_at: datetime
    # Score fields if evaluated
    scoring_status: str | None = None
    semantic_score: float | None = None
    composition_score: float | None = None
    objects_score: float | None = None
    color_score: float | None = None
    details_score: float | None = None
    total_score: float | None = None


class ScoreRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    submission_id: str
    round_id: str
    user_id: str
    semantic_score: float
    composition_score: float
    objects_score: float
    color_score: float
    details_score: float
    total_score: float
    status: str
    feedback: str | None = None
    created_at: datetime

