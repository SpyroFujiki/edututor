"""Model: course_progress. Mẫu: chủ subscription xem tiến độ, kể cả lịch sử hết hạn."""

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import CourseProgress, UserSubscription
from app.models.enums import ServiceType
from app.modules.users.user import get_active_user


def get_my_course_progress(
    session: Session, subscription_id: UUID, user_id: UUID
) -> CourseProgress:
    get_active_user(session, user_id)
    progress = session.scalar(
        select(CourseProgress)
        .join(UserSubscription, UserSubscription.id == CourseProgress.subscription_id)
        .where(
            CourseProgress.subscription_id == subscription_id,
            UserSubscription.user_id == user_id,
            UserSubscription.type == ServiceType.COURSE,
        )
    )
    if progress is None:
        raise LookupError("Course progress not found or access denied")
    return progress
