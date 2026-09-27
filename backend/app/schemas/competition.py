from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict
from app.models.domain_enums import LifecycleStatus

class CompetitionBase(BaseModel):
    title: str
    description: Optional[str] = None
    slug: Optional[str] = None
    scheduled_start: Optional[datetime] = None
    scheduled_end: Optional[datetime] = None

class CompetitionCreate(CompetitionBase):
    pass

class CompetitionUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    slug: Optional[str] = None
    scheduled_start: Optional[datetime] = None
    scheduled_end: Optional[datetime] = None

class RoundBase(BaseModel):
    title: str
    description: Optional[str] = None
    secret_prompt: str
    time_limit_seconds: int = 600
    max_submissions: int = 1
    round_number: Optional[int] = 1

class RoundCreate(RoundBase):
    pass

class RoundUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    secret_prompt: Optional[str] = None
    time_limit_seconds: Optional[int] = None
    max_submissions: Optional[int] = None

class RoundRead(RoundBase):
    model_config = ConfigDict(from_attributes=True)

    id: str
    competition_id: str
    status: LifecycleStatus
    is_archived: bool = False
    target_image_url: Optional[str] = None
    started_at: Optional[datetime] = None
    paused_at: Optional[datetime] = None
    ended_at: Optional[datetime] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

class CompetitionRead(CompetitionBase):
    model_config = ConfigDict(from_attributes=True)

    id: str
    slug: str
    status: LifecycleStatus
    is_archived: bool = False
    started_at: Optional[datetime] = None
    paused_at: Optional[datetime] = None
    ended_at: Optional[datetime] = None
    created_by: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    rounds: List[RoundRead] = []
