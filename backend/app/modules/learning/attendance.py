"""Model: attendance. Mẫu: xem lịch sử học thuộc một lần đăng ký của chính user."""

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Attendance, Lesson
from app.modules.learning.course_progress import get_my_course_progress


def list_my_attendance(session: Session, subscription_id: UUID, user_id: UUID) -> list[Attendance]:
    get_my_course_progress(session, subscription_id, user_id)
    return list(
        session.scalars(
            select(Attendance)
            .join(Lesson)
            .where(Attendance.subscription_id == subscription_id)
            .order_by(Lesson.order_idx)
        )
    )
