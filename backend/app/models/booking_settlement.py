from datetime import datetime
from uuid import UUID

from sqlalchemy import BigInteger, CheckConstraint, DateTime, ForeignKey, Index, Integer, text
from sqlalchemy.ext.hybrid import hybrid_property
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base
from app.models.enums import EscrowStatus, escrow_status_enum


class BookingSettlement(Base):
    __tablename__ = "booking_settlements"
    __table_args__ = (
        Index(None, "tutor_wallet_id", "status"),
        Index(None, "release_date"),
        CheckConstraint("total_amount >= 0", name="nonnegative_amounts"),
        CheckConstraint("commission_rate >= 0 AND commission_rate <= 100", name="commission_range"),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True)
    booking_id: Mapped[UUID] = mapped_column(ForeignKey("booking.id"), unique=True)
    tutor_wallet_id: Mapped[UUID] = mapped_column(ForeignKey("wallets.id"))
    total_amount: Mapped[int] = mapped_column(BigInteger)
    commission_rate: Mapped[int] = mapped_column(Integer)
    status: Mapped[EscrowStatus] = mapped_column(escrow_status_enum, server_default=text("'held'"))
    release_date: Mapped[datetime | None] = mapped_column(DateTime)
    actual_released_at: Mapped[datetime | None] = mapped_column(DateTime)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=text("now()"))

    @staticmethod
    def fee_for(total: int, rate: int) -> int:
        return total * rate // 100

    @hybrid_property
    def platform_fee(self) -> int:
        return self.fee_for(self.total_amount, self.commission_rate)

    @platform_fee.inplace.expression
    @classmethod
    def _platform_fee_expression(cls):
        # Split the amount before multiplying to keep the SQL arithmetic in BIGINT.
        return (cls.total_amount // 100) * cls.commission_rate + (
            cls.total_amount % 100
        ) * cls.commission_rate // 100

    @hybrid_property
    def tutor_income(self) -> int:
        return self.total_amount - self.platform_fee

    @property
    def available_amount(self) -> int:
        return 0

    @hybrid_property
    def hold_amount(self) -> int:
        return self.tutor_income
