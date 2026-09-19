from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin
from app.models.domain_enums import PracticeStatus
from app.models.enums import str_enum
from app.models.uuid import GUID, new_uuid


class PracticeSession(TimestampMixin, Base):
    __tablename__ = "practice_sessions"

    id: Mapped[str] = mapped_column(GUID(), primary_key=True, default=new_uuid)
    user_id: Mapped[str] = mapped_column(GUID(), ForeignKey("users.id"), index=True, nullable=False)
    target_image_id: Mapped[str | None] = mapped_column(
        GUID(), ForeignKey("target_images.id"), index=True, nullable=True
    )
    status: Mapped[PracticeStatus] = mapped_column(
        str_enum(PracticeStatus, "practice_status"),
        default=PracticeStatus.STARTED,
        nullable=False,
    )
    rounds_completed: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    final_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    user: Mapped["User"] = relationship(back_populates="practice_sessions")
    target_image: Mapped["TargetImage"] = relationship(back_populates="practice_sessions")


from app.models.target_image import TargetImage  # noqa: E402
from app.models.user import User  # noqa: E402