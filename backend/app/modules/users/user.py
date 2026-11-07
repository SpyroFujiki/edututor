"""Model: users. Mẫu: lấy tài khoản đang được phép hoạt động."""

from uuid import UUID

from sqlalchemy.orm import Session

from app.models import User
from app.models.enums import UserStatus
from app.modules.users.accounts import change_email, change_password, change_status, register_user

__all__ = ["get_active_user", "register_user", "change_email", "change_password", "change_status"]


def get_active_user(session: Session, user_id: UUID) -> User:
    """user_id phải lấy từ danh tính đã xác thực, không tin ID do client tự chọn."""
    user = session.get(User, user_id, populate_existing=True)
    if user is None:
        raise LookupError("User not found")
    if user.status != UserStatus.ACTIVE:
        raise PermissionError("User is not active")
    return user
