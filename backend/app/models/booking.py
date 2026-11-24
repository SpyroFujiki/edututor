from datetime import datetime
from uuid import UUID

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Index, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base
from app.models.enums import BookingStatus, booking_status_enum


class Booking(Base):
    __tablename__ = "booking"
    __table_args__ = (
        Index(None, "customer_id", "status"),
        Index(None, "tutor_id", "status"),
        Index(None, "status"),
        Index(None, "created_at"),
        CheckConstraint(
            "(status <> 'pending' OR subscription_id IS NULL) AND "
            "(status NOT IN ('confirmed', 'assigned', 'completed', 'disputing', 'refunded') "
            "OR subscription_id IS NOT NULL)",
            name="status_subscription",
        ),
        CheckConstraint(
            "status NOT IN ('assigned', 'completed') OR tutor_id IS NOT NULL",
            name="status_tutor",
        ),
        CheckConstraint("tutor_id <> customer_id", name="distinct_participants"),
    )

    subject: Mapped[str | None] = mapped_column(String)
    requirements: Mapped[str | None] = mapped_column(Text)
    id: Mapped[UUID] = mapped_column(primary_key=True)
    subscription_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("user_subscriptions.id"), unique=True
    )
    package_id: Mapped[UUID] = mapped_column(ForeignKey("tutoring_package.id"))
    customer_id: Mapped[UUID] = mapped_column(ForeignKey("users.id"))
    tutor_id: Mapped[UUID | None] = mapped_column(ForeignKey("users.id"))
    status: Mapped[BookingStatus] = mapped_column(booking_status_enum)
    created_at: Mapped[datetime | None] = mapped_column(DateTime)
    last_updated: Mapped[datetime | None] = mapped_column(DateTime)
