from datetime import datetime
from sqlalchemy import Column, DateTime, Enum, Float, ForeignKey, String, Text
from app.db.base import Base
from app.models.domain_enums import ScoringStatus, EvaluationStage
from app.models.uuid import generate_uuid

class Score(Base):
    __tablename__ = "scores"

    id = Column(String, primary_key=True, default=generate_uuid)
    submission_id = Column(String, ForeignKey("submissions.id", ondelete="CASCADE"), nullable=False)
    round_id = Column(String, ForeignKey("rounds.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)

    evaluation_stage = Column(Enum(EvaluationStage), default=EvaluationStage.FINAL, nullable=False)
    status = Column(Enum(ScoringStatus), default=ScoringStatus.PENDING, nullable=False)

    # Sub-scores (Total max 80)
    semantic_score = Column(Float, default=0.0, nullable=False)      # max 32
    composition_score = Column(Float, default=0.0, nullable=False)   # max 20
    objects_score = Column(Float, default=0.0, nullable=False)       # max 16
    color_score = Column(Float, default=0.0, nullable=False)         # max 8
    details_score = Column(Float, default=0.0, nullable=False)       # max 4
    total_score = Column(Float, default=0.0, nullable=False)         # max 80

    clip_similarity = Column(Float, nullable=True)
    evaluation_method = Column(String, default="CLIP + computer vision", nullable=False)
    feedback = Column(Text, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
