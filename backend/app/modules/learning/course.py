"""Model: courses. Mẫu: danh mục khóa học đang hiển thị công khai."""

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Course
from app.models.enums import CourseStatus


def list_visible_courses(session: Session, *, limit: int = 20, offset: int = 0) -> list[Course]:
    if not 1 <= limit <= 100 or offset < 0:
        raise ValueError("limit must be 1..100 and offset must be nonnegative")
    return list(
        session.scalars(
            select(Course)
            .where(Course.status == CourseStatus.VISIBLE)
            .order_by(Course.created_at.desc(), Course.id)
            .offset(offset)
            .limit(limit)
        )
    )
