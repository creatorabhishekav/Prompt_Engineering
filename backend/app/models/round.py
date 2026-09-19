from datetime import datetime

from sqlalchemy import ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin
from app.models.domain_enums import LifecycleStatus
from app.models.enums import str_enum
from app.models.uuid import GUID, new_uuid


class Round(TimestampMixin, Base):
    __tablename__ = "rounds"
    __table_args__ = (UniqueConstraint("competition_id", "round_number", name="uq_round_number"),)

    id: Mapped[str] = mapped_column(GUID(), primary_key=True, default=new_uuid)
    competition_id: Mapped[str] = mapped_column(
        GUID(), ForeignKey("competitions.id"), index=True, nullable=False
    )
    round_number: Mapped[int] = mapped_column(Integer, nullable=False)
    title: Mapped[str] = mapped_column(String(150), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    secret_prompt: Mapped[str] = mapped_column(Text, nullable=False)
    time_limit_seconds: Mapped[int] = mapped_column(Integer, default=600, nullable=False)
    max_submissions: Mapped[int] = mapped_column(Integer, default=1, nullable=False)

    status: Mapped[LifecycleStatus] = mapped_column(
        str_enum(LifecycleStatus, "round_status"), default=LifecycleStatus.DRAFT, nullable=False
    )

    # Server-authoritative timer. `elapsed_seconds` accumulates completed time
    # while PAUSED/ENDED; `segment_started_at` marks the current ACTIVE segment.
    elapsed_seconds: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    segment_started_at: Mapped[datetime | None] = mapped_column(nullable=True)

    # Actual lifecycle wall-clock bookkeeping.
    started_at: Mapped[datetime | None] = mapped_column(nullable=True)
    paused_at: Mapped[datetime | None] = mapped_column(nullable=True)
    ended_at: Mapped[datetime | None] = mapped_column(nullable=True)

    competition: Mapped["Competition"] = relationship(back_populates="rounds")
    target_images: Mapped[list["TargetImage"]] = relationship(
        back_populates="round", cascade="all, delete-orphan"
    )
    submissions: Mapped[list["Submission"]] = relationship(
        back_populates="round", cascade="all, delete-orphan"
    )
    scores: Mapped[list["Score"]] = relationship(
        back_populates="round", cascade="all, delete-orphan"
    )


from app.models.competition import Competition  # noqa: E402
from app.models.score import Score  # noqa: E402
from app.models.submission import Submission  # noqa: E402
from app.models.target_image import TargetImage  # noqa: E402