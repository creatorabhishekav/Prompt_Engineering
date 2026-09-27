from datetime import datetime
from sqlalchemy import Boolean, Column, DateTime, Enum, ForeignKey, Integer, String, Text
from app.db.base import Base
from app.models.domain_enums import LifecycleStatus
from app.models.uuid import generate_uuid

class Round(Base):
    __tablename__ = "rounds"

    id = Column(String, primary_key=True, default=generate_uuid)
    competition_id = Column(String, ForeignKey("competitions.id", ondelete="CASCADE"), nullable=False)
    round_number = Column(Integer, default=1, nullable=False)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    secret_prompt = Column(Text, nullable=False)
    time_limit_seconds = Column(Integer, default=600, nullable=False)
    max_submissions = Column(Integer, default=1, nullable=False)
    status = Column(Enum(LifecycleStatus), default=LifecycleStatus.ACTIVE, nullable=False)
    is_archived = Column(Boolean, default=False, nullable=False)
    started_at = Column(DateTime, nullable=True)
    paused_at = Column(DateTime, nullable=True)
    ended_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
