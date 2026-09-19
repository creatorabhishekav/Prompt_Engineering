from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.schemas.domain_enums import SubmissionStatus


class TargetImageRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    round_id: str
    image_url: str
    alt_text: str | None = None
    created_by: str | None = None
    created_at: datetime
    updated_at: datetime