from datetime import datetime
from sqlalchemy import Column, DateTime, ForeignKey, String, Text
from app.db.base import Base
from app.models.uuid import generate_uuid

class TargetImage(Base):
    __tablename__ = "target_images"

    id = Column(String, primary_key=True, default=generate_uuid)
    round_id = Column(String, ForeignKey("rounds.id", ondelete="CASCADE"), nullable=False)
    image_url = Column(String, nullable=False)
    alt_text = Column(Text, nullable=True)
    created_by = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
