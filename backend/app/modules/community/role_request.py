"""Model: role_requests. Mẫu: xem lịch sử yêu cầu nâng bậc của chính user."""

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import RoleRequest
from app.modules.users.user import get_active_user


def list_my_role_requests(session: Session, user_id: UUID, *, limit: int = 20) -> list[RoleRequest]:
    if not 1 <= limit <= 100:
        raise ValueError("limit must be between 1 and 100")
    get_active_user(session, user_id)
    return list(
        session.scalars(
            select(RoleRequest)
            .where(RoleRequest.user_id == user_id)
            .order_by(RoleRequest.created_at.desc().nulls_last(), RoleRequest.id)
            .limit(limit)
        )
    )
