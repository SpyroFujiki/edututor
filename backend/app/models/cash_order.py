from datetime import datetime
from typing import Any
from uuid import UUID

from sqlalchemy import DateTime, ForeignKey, Index, Integer
from sqlalchemy.dialects.postgresql import JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base
from app.models.enums import (
    CashOrderStatus,
    CashOrderType,
    cash_order_status_enum,
    cash_order_type_enum,
)
from app.models.wallet import Wallet


class CashOrder(Base):
    __tablename__ = "cash_order"
    __table_args__ = (Index(None, "wallet_id"),)

    id: Mapped[UUID] = mapped_column(primary_key=True)
    wallet_id: Mapped[UUID] = mapped_column(ForeignKey("wallets.id"))
    wallet: Mapped[Wallet] = relationship()
    order_type: Mapped[CashOrderType | None] = mapped_column(cash_order_type_enum)
    package_id: Mapped[UUID | None] = mapped_column(ForeignKey("credit_package.id"))
    amount_vnd: Mapped[int | None] = mapped_column(Integer)
    credit_amount: Mapped[int | None] = mapped_column(Integer)
    status: Mapped[CashOrderStatus | None] = mapped_column(cash_order_status_enum)
    bank_info: Mapped[Any | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime | None] = mapped_column(DateTime)
    updated_at: Mapped[datetime | None] = mapped_column(DateTime)

    @property
    def user_id(self) -> UUID:
        return self.wallet.user_id
