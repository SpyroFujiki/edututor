"""Compatibility entry point; implementations live in their feature modules."""

from app.modules.finance.booking_settlement import release_settlement
from app.modules.tutoring.access import accessible_booking
from app.modules.tutoring.booking import (
    assign_tutor,
    cancel_booking,
    complete_booking,
    create_booking,
    pay_booking,
    refund_booking,
)
from app.modules.tutoring.booking_session import (
    check_schedule,
    schedule_session,
    session_action,
    session_values,
)
from app.modules.tutoring.dispute import (
    claim_dispute,
    dispute_access,
    open_dispute,
    resolve_dispute,
)
from app.modules.tutoring.message import list_messages, send_message

__all__ = [
    "accessible_booking",
    "session_values",
    "check_schedule",
    "schedule_session",
    "session_action",
    "create_booking",
    "pay_booking",
    "assign_tutor",
    "complete_booking",
    "refund_booking",
    "cancel_booking",
    "list_messages",
    "send_message",
    "open_dispute",
    "dispute_access",
    "claim_dispute",
    "resolve_dispute",
    "release_settlement",
]
