from datetime import datetime
from sqlalchemy import Column, DateTime, Enum, ForeignKey, String, Text
from app.db.base import Base
from app.models.domain_enums import SubmissionStatus
from app.models.uuid import generate_uuid

class Submission(Base):
    __tablename__ = "submissions"

    id = Column(String, primary_key=True, default=generate_uuid)
    round_id = Column(String, ForeignKey("rounds.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    target_image_id = Column(String, ForeignKey("target_images.id", ondelete="SET NULL"), nullable=True)

    # TWO-STAGE INDEPENDENT IMAGE URLS
    first_image_url = Column(String, nullable=True)
    final_image_url = Column(String, nullable=True)
    image_url = Column(String, nullable=True)  # legacy fallback only

    # TWO-STAGE PROMPTS
    prompt_used = Column(Text, default="", nullable=False)
    prompt_1 = Column(Text, nullable=True)
    prompt_2 = Column(Text, nullable=True)

    status = Column(Enum(SubmissionStatus), default=SubmissionStatus.IN_PROGRESS, nullable=False)
    started_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    submitted_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
