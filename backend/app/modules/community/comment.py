"""Model: comments. Mẫu: lấy bình luận hiển thị sau khi kiểm tra quyền đọc bài."""

from uuid import UUID

from sqlalchemy import and_, or_, select
from sqlalchemy.orm import Session

from app.models import Comment
from app.modules.community.post import get_readable_post


def list_visible_comments(
    session: Session,
    post_id: UUID,
    user_id: UUID | None = None,
    *,
    limit: int = 50,
    offset: int = 0,
    after_id: UUID | None = None,
) -> list[Comment]:
    if not 1 <= limit <= 100 or offset < 0:
        raise ValueError("limit must be between 1 and 100")
    get_readable_post(session, post_id, user_id)
    statement = select(Comment).where(Comment.post_id == post_id, Comment.is_hidden.is_(False))
    if after_id:
        pivot = session.scalar(
            select(Comment).where(
                Comment.id == after_id, Comment.post_id == post_id, Comment.is_hidden.is_(False)
            )
        )
        if pivot is None:
            raise LookupError("Comment cursor not found")
        if pivot.created_at is None:
            statement = statement.where(Comment.created_at.is_(None), Comment.id > pivot.id)
        else:
            statement = statement.where(
                or_(
                    Comment.created_at > pivot.created_at,
                    Comment.created_at.is_(None),
                    and_(Comment.created_at == pivot.created_at, Comment.id > pivot.id),
                )
            )
    # A hidden parent remains an opaque ID; its content is never joined into replies.
    return list(
        session.scalars(
            statement.order_by(Comment.created_at.asc().nulls_last(), Comment.id)
            .offset(offset)
            .limit(limit)
        )
    )
