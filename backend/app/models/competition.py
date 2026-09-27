from datetime import datetime
from sqlalchemy import Boolean, Column, DateTime, Enum, String, Text
from app.db.base import Base
from app.models.domain_enums import LifecycleStatus
from app.models.uuid import generate_uuid

class Competition(Base):
    __tablename__ = "competitions"

    id = Column(String, primary_key=True, default=generate_uuid)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    slug = Column(String, unique=True, index=True, nullable=False)
    status = Column(Enum(LifecycleStatus), default=LifecycleStatus.DRAFT, nullable=False)
    is_archived = Column(Boolean, default=False, nullable=False)
    scheduled_start = Column(DateTime, nullable=True)
    scheduled_end = Column(DateTime, nullable=True)
    started_at = Column(DateTime, nullable=True)
    paused_at = Column(DateTime, nullable=True)
    ended_at = Column(DateTime, nullable=True)
    created_by = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
