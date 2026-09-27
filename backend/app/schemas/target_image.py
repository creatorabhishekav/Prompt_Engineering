from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict

class TargetImageBase(BaseModel):
    round_id: str
    image_url: str
    alt_text: Optional[str] = None

class TargetImageCreate(TargetImageBase):
    pass

class TargetImageRead(TargetImageBase):
    model_config = ConfigDict(from_attributes=True)

    id: str
    created_by: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
