from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin
from app.models.uuid import GUID, new_uuid


class TargetImage(TimestampMixin, Base):
    __tablename__ = "target_images"

    id: Mapped[str] = mapped_column(GUID(), primary_key=True, default=new_uuid)
    round_id: Mapped[str] = mapped_column(
        GUID(), ForeignKey("rounds.id"), index=True, nullable=False
    )
    image_url: Mapped[str] = mapped_column(String(1000), nullable=False)
    alt_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_by: Mapped[str | None] = mapped_column(GUID(), ForeignKey("users.id"), nullable=True)

    round: Mapped["Round"] = relationship(back_populates="target_images")
    submissions: Mapped[list["Submission"]] = relationship(back_populates="target_image")
    practice_sessions: Mapped[list["PracticeSession"]] = relationship(
        back_populates="target_image"
    )


from app.models.practice_session import PracticeSession  # noqa: E402
from app.models.round import Round  # noqa: E402
from app.models.submission import Submission  # noqa: E402