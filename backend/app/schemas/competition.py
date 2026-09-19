from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.round import Round
from app.schemas.domain_enums import LifecycleStatus
from app.services.lifecycle import round_remaining_seconds, round_server_elapsed


class RoundRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    competition_id: str
    round_number: int
    title: str
    description: str | None = None
    secret_prompt: str
    time_limit_seconds: int
    max_submissions: int
    status: LifecycleStatus
    elapsed_seconds: int
    server_elapsed_seconds: int
    remaining_seconds: int
    target_image_url: str | None = None
    started_at: datetime | None = None
    paused_at: datetime | None = None
    ended_at: datetime | None = None
    created_at: datetime
    updated_at: datetime

    @classmethod
    def from_round(cls, round_: Round) -> "RoundRead":
        images = round_.target_images or []
        latest = max(images, key=lambda i: i.created_at or datetime.min) if images else None
        elapsed = round_server_elapsed(round_)
        return cls(
            id=round_.id,
            competition_id=round_.competition_id,
            round_number=round_.round_number,
            title=round_.title,
            description=round_.description,
            secret_prompt=round_.secret_prompt,
            time_limit_seconds=round_.time_limit_seconds,
            max_submissions=round_.max_submissions,
            status=round_.status,
            elapsed_seconds=round_.elapsed_seconds or 0,
            server_elapsed_seconds=elapsed,
            remaining_seconds=round_remaining_seconds(round_),
            target_image_url=latest.image_url if latest else None,
            started_at=round_.started_at,
            paused_at=round_.paused_at,
            ended_at=round_.ended_at,
            created_at=round_.created_at,
            updated_at=round_.updated_at,
        )


class CompetitionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    title: str
    description: str | None = None
    slug: str
    status: LifecycleStatus
    scheduled_start: datetime | None = None
    scheduled_end: datetime | None = None
    started_at: datetime | None = None
    paused_at: datetime | None = None
    ended_at: datetime | None = None
    created_by: str | None = None
    created_at: datetime
    updated_at: datetime
    rounds: list[RoundRead] = []


class CompetitionCreate(BaseModel):
    title: str = Field(min_length=1, max_length=150)
    description: str | None = Field(default=None, max_length=4000)
    slug: str | None = Field(default=None, max_length=180)
    scheduled_start: datetime | None = None
    scheduled_end: datetime | None = None


class CompetitionUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=150)
    description: str | None = Field(default=None, max_length=4000)
    slug: str | None = Field(default=None, max_length=180)
    scheduled_start: datetime | None = None
    scheduled_end: datetime | None = None


class RoundCreate(BaseModel):
    round_number: int | None = None
    title: str = Field(min_length=1, max_length=150)
    description: str | None = Field(default=None, max_length=4000)
    secret_prompt: str = Field(min_length=1, max_length=4000)
    time_limit_seconds: int = Field(default=600, ge=10, le=604800)
    max_submissions: int = Field(default=1, ge=1, le=5)


class RoundUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=150)
    description: str | None = Field(default=None, max_length=4000)
    secret_prompt: str | None = Field(default=None, min_length=1, max_length=4000)
    time_limit_seconds: int | None = Field(default=None, ge=10, le=604800)
    max_submissions: int | None = Field(default=None, ge=1, le=5)