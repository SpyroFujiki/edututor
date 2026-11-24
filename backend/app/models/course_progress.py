from datetime import datetime
from decimal import ROUND_HALF_UP, Decimal
from uuid import UUID

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base
from app.models.enums import CourseResult


class CourseProgress(Base):
    __tablename__ = "course_progress"
    __table_args__ = (
        Index(None, "course_id"),
        CheckConstraint("progress_percent >= 0 AND progress_percent <= 100", name="progress_range"),
        CheckConstraint(
            "attendance_ratio IS NULL OR (attendance_ratio >= 0 AND attendance_ratio <= 1)",
            name="attendance_ratio_range",
        ),
        CheckConstraint(
            "(progress_percent = 100) = (completed_at IS NOT NULL)",
            name="completion_timestamp",
        ),
    )

    subscription_id: Mapped[UUID] = mapped_column(
        ForeignKey("user_subscriptions.id"), primary_key=True
    )
    course_id: Mapped[UUID] = mapped_column(ForeignKey("courses.id"))
    progress_percent: Mapped[Decimal] = mapped_column(Numeric(5, 2), server_default=text("0"))
    attendance_ratio: Mapped[Decimal | None] = mapped_column(Numeric(5, 4))
    midterm_score: Mapped[int | None] = mapped_column(Integer)
    endterm_score: Mapped[int | None] = mapped_column(Integer)
    practice_score: Mapped[int | None] = mapped_column(Integer)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime)
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=text("now()"))

    @property
    def final_score(self) -> int | None:
        if (
            self.completed_at is None
            or self.midterm_score is None
            or self.endterm_score is None
            or self.practice_score is None
        ):
            return None
        total = self.midterm_score + self.endterm_score + self.practice_score
        return int((Decimal(total) / 3).quantize(Decimal(1), rounding=ROUND_HALF_UP))

    @property
    def result(self) -> CourseResult | None:
        score = self.final_score
        if score is None:
            return None
        if score >= 85:
            return CourseResult.EXCELLENT
        if score >= 50:
            return CourseResult.GOOD
        return CourseResult.FAILED
