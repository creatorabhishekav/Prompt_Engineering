from sqlalchemy import Float, ForeignKey, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin
from app.models.domain_enums import ScoringStatus
from app.models.enums import str_enum
from app.models.uuid import GUID, new_uuid


class Score(TimestampMixin, Base):
    __tablename__ = "scores"

    id: Mapped[str] = mapped_column(GUID(), primary_key=True, default=new_uuid)
    submission_id: Mapped[str] = mapped_column(
        GUID(), ForeignKey("submissions.id"), unique=True, index=True, nullable=False
    )
    round_id: Mapped[str] = mapped_column(GUID(), ForeignKey("rounds.id"), index=True, nullable=False)
    user_id: Mapped[str] = mapped_column(GUID(), ForeignKey("users.id"), index=True, nullable=False)

    semantic_score: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    composition_score: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    objects_score: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    color_score: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    details_score: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    total_score: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    status: Mapped[ScoringStatus] = mapped_column(
        str_enum(ScoringStatus, "scoring_status"),
        default=ScoringStatus.PENDING,
        nullable=False,
    )
    feedback: Mapped[str | None] = mapped_column(Text, nullable=True)

    submission: Mapped["Submission"] = relationship(back_populates="score")
    round: Mapped["Round"] = relationship(back_populates="scores")
    user: Mapped["User"] = relationship(back_populates="scores")


from app.models.round import Round  # noqa: E402
from app.models.submission import Submission  # noqa: E402
from app.models.user import User  # noqa: E402