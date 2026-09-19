from datetime import datetime

from sqlalchemy import ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin
from app.models.domain_enums import SubmissionStatus
from app.models.enums import str_enum
from app.models.uuid import GUID, new_uuid


class Submission(TimestampMixin, Base):
    __tablename__ = "submissions"
    __table_args__ = (UniqueConstraint("user_id", "round_id", name="uq_user_round"),)

    id: Mapped[str] = mapped_column(GUID(), primary_key=True, default=new_uuid)
    user_id: Mapped[str] = mapped_column(GUID(), ForeignKey("users.id"), index=True, nullable=False)
    round_id: Mapped[str] = mapped_column(GUID(), ForeignKey("rounds.id"), index=True, nullable=False)
    target_image_id: Mapped[str | None] = mapped_column(
        GUID(), ForeignKey("target_images.id"), nullable=True
    )
    image_url: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    prompt_used: Mapped[str] = mapped_column(Text, nullable=False, default="")
    status: Mapped[SubmissionStatus] = mapped_column(
        str_enum(SubmissionStatus, "submission_status"),
        default=SubmissionStatus.IN_PROGRESS,
        nullable=False,
    )

    # Round elapsed seconds (server clock) at the moment this attempt started.
    started_at_elapsed: Mapped[int | None] = mapped_column(Integer, nullable=True)
    # Seconds of the participant's personal window consumed on final submit.
    deadline_elapsed: Mapped[int | None] = mapped_column(Integer, nullable=True)
    # Wall-clock time of the final submission.
    submitted_at: Mapped[datetime | None] = mapped_column(nullable=True)

    user: Mapped["User"] = relationship(back_populates="submissions")
    round: Mapped["Round"] = relationship(back_populates="submissions")
    target_image: Mapped["TargetImage"] = relationship(back_populates="submissions")
    score: Mapped["Score"] = relationship(
        back_populates="submission", uselist=False, cascade="all, delete-orphan"
    )


from app.models.round import Round  # noqa: E402
from app.models.score import Score  # noqa: E402
from app.models.target_image import TargetImage  # noqa: E402
from app.models.user import User  # noqa: E402