from datetime import datetime
from uuid import UUID

from sqlalchemy import CheckConstraint, DateTime, String, Text, text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base
from app.models.enums import UserRole, UserStatus, user_role_enum, user_status_enum


class User(Base):
    __tablename__ = "users"
    __table_args__ = (
        CheckConstraint(
            "avatar_base64 IS NULL OR length(avatar_base64) <= 2796244", name="avatar_size_limit"
        ),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True)
    email: Mapped[str | None] = mapped_column(String, unique=True)
    full_name: Mapped[str | None] = mapped_column(String(200))
    avatar_base64: Mapped[str | None] = mapped_column(Text, deferred=True)
    password_hash: Mapped[str | None] = mapped_column(String)
    role: Mapped[UserRole | None] = mapped_column(user_role_enum)
    status: Mapped[UserStatus | None] = mapped_column(
        user_status_enum, server_default=text("'active'")
    )
    created_at: Mapped[datetime | None] = mapped_column(DateTime)
    last_active_at: Mapped[datetime | None] = mapped_column(DateTime)
