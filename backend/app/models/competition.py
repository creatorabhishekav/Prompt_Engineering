from datetime import datetime

from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin
from app.models.domain_enums import LifecycleStatus
from app.models.enums import str_enum
from app.models.uuid import GUID, new_uuid


class Competition(TimestampMixin, Base):
    __tablename__ = "competitions"

    id: Mapped[str] = mapped_column(GUID(), primary_key=True, default=new_uuid)
    title: Mapped[str] = mapped_column(String(150), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    slug: Mapped[str] = mapped_column(String(180), unique=True, index=True, nullable=False)
    status: Mapped[LifecycleStatus] = mapped_column(
        str_enum(LifecycleStatus, "competition_status"),
        default=LifecycleStatus.DRAFT,
        nullable=False,
    )
    # Scheduled window (informational), independent of the actual lifecycle.
    scheduled_start: Mapped[datetime | None] = mapped_column(nullable=True)
    scheduled_end: Mapped[datetime | None] = mapped_column(nullable=True)
    # Actual lifecycle bookkeeping.
    started_at: Mapped[datetime | None] = mapped_column(nullable=True)
    paused_at: Mapped[datetime | None] = mapped_column(nullable=True)
    ended_at: Mapped[datetime | None] = mapped_column(nullable=True)

    created_by: Mapped[str | None] = mapped_column(GUID(), ForeignKey("users.id"), nullable=True)

    creator: Mapped["User"] = relationship(
        back_populates="competitions", foreign_keys=[created_by]
    )
    rounds: Mapped[list["Round"]] = relationship(
        back_populates="competition", cascade="all, delete-orphan"
    )


from app.models.round import Round  # noqa: E402
from app.models.user import User  # noqa: E402