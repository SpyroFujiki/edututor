from datetime import datetime
from uuid import UUID

from sqlalchemy import DateTime, ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base
from app.models.enums import DisputeVerdict, dispute_verdict_enum


class Dispute(Base):
    __tablename__ = "disputes"
    __table_args__ = (UniqueConstraint("id", "booking_id"),)

    id: Mapped[UUID] = mapped_column(primary_key=True)
    booking_id: Mapped[UUID] = mapped_column(ForeignKey("booking.id"), unique=True)
    raised_by_user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id"))
    admin_id: Mapped[UUID | None] = mapped_column(ForeignKey("users.id"))
    reason_category: Mapped[str | None] = mapped_column(String)
    verdict: Mapped[DisputeVerdict | None] = mapped_column(dispute_verdict_enum)
    created_at: Mapped[datetime | None] = mapped_column(DateTime)
    resolve_at: Mapped[datetime | None] = mapped_column(DateTime)
