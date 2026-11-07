"""Model: comment_report. Mẫu: báo cáo một bình luận mà user được phép đọc."""

from uuid import UUID

from sqlalchemy.orm import Session

from app.models import CommentReport


def report_comment(
    session: Session,
    *,
    reporter_id: UUID,
    comment_id: UUID,
    reason_category: str,
    reason_details: str = "",
) -> CommentReport:
    from app.modules.community.community_service import submit_report

    return submit_report(
        session,
        reporter_id,
        comment_id,
        {"reason_category": reason_category, "reason_details": reason_details},
    )
