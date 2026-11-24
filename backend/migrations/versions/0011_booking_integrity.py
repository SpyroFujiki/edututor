"""Protect booking state and the identity of its purchase entitlement."""

from alembic import op

revision = "0011_booking_integrity"
down_revision = "0010_dispute_resolve_at"
branch_labels = None
depends_on = None

CHECKS = {
    "status_subscription": (
        "(status <> 'pending' OR subscription_id IS NULL) AND "
        "(status NOT IN ('confirmed', 'assigned', 'completed', 'disputing', 'refunded') "
        "OR subscription_id IS NOT NULL)"
    ),
    "status_tutor": "status NOT IN ('assigned', 'completed') OR tutor_id IS NOT NULL",
    "distinct_participants": "tutor_id <> customer_id",
}


def upgrade():
    op.execute("LOCK TABLE booking, user_subscriptions IN ACCESS EXCLUSIVE MODE")
    invalid_booking = " OR ".join(f"({condition}) IS FALSE" for condition in CHECKS.values())
    op.execute(f"""
        DO $$
        DECLARE conflicts jsonb;
        BEGIN
            SELECT jsonb_agg(to_jsonb(sample)) INTO conflicts FROM (
                SELECT b.id, b.status, b.customer_id, b.tutor_id, b.subscription_id,
                       s.user_id AS subscription_owner, s.type AS subscription_type
                FROM booking b
                LEFT JOIN (SELECT id, user_id, type FROM user_subscriptions) s ON s.id = b.subscription_id
                WHERE b.status IS NULL OR {invalid_booking}
                   OR (b.subscription_id IS NOT NULL AND (
                           s.user_id IS DISTINCT FROM b.customer_id OR s.type IS DISTINCT FROM 'booking'
                       ))
                ORDER BY b.id LIMIT 10
            ) sample;
            IF conflicts IS NOT NULL THEN
                RAISE EXCEPTION 'Inconsistent bookings (up to 10 rows)'
                    USING ERRCODE = '23514', DETAIL = conflicts::text;
            END IF;
        END;
        $$;
    """)
    op.alter_column("booking", "status", nullable=False)
    for name, condition in CHECKS.items():
        op.create_check_constraint(name, "booking", condition)

    # A booking link writes a row version on its subscription. A concurrent change
    # of owner/type must see the link or abort, including under REPEATABLE READ.
    op.execute("""
        CREATE FUNCTION check_booking_subscription() RETURNS trigger
        LANGUAGE plpgsql AS $$
        DECLARE
            owner_id uuid;
            is_booking boolean;
        BEGIN
            IF NEW.subscription_id IS NULL THEN
                RETURN NEW;
            END IF;
            IF TG_OP = 'UPDATE' THEN
                IF OLD.subscription_id IS NOT DISTINCT FROM NEW.subscription_id
                   AND OLD.customer_id = NEW.customer_id THEN
                    RETURN NEW;
                END IF;
            END IF;
            UPDATE user_subscriptions SET type = type
            WHERE id = NEW.subscription_id
            RETURNING user_id, type = 'booking' INTO owner_id, is_booking;
            IF owner_id IS DISTINCT FROM NEW.customer_id OR is_booking IS DISTINCT FROM true THEN
                RAISE EXCEPTION 'Booking % requires a booking subscription owned by its customer', NEW.id
                    USING ERRCODE = '23514', CONSTRAINT = 'booking_subscription_owner_and_type';
            END IF;
            RETURN NEW;
        END;
        $$;
    """)
    op.execute("""
        CREATE FUNCTION guard_booked_subscription() RETURNS trigger
        LANGUAGE plpgsql AS $$
        BEGIN
            IF EXISTS (
                SELECT 1 FROM booking WHERE subscription_id = NEW.id
                  AND (customer_id <> NEW.user_id OR NEW.type <> 'booking')
            ) THEN
                RAISE EXCEPTION 'Subscription % must remain a booking subscription owned by its customer', NEW.id
                    USING ERRCODE = '23514', CONSTRAINT = 'booking_subscription_owner_and_type';
            END IF;
            RETURN NEW;
        END;
        $$;
    """)
    op.execute("""
        DO $$
        BEGIN
            EXECUTE format(
                'ALTER FUNCTION %I.check_booking_subscription() SET search_path TO pg_catalog, %I, pg_temp',
                current_schema(), current_schema()
            );
            EXECUTE format(
                'ALTER FUNCTION %I.guard_booked_subscription() SET search_path TO pg_catalog, %I, pg_temp',
                current_schema(), current_schema()
            );
        END;
        $$;
    """)
    op.execute("""
        CREATE TRIGGER booking_subscription_link
        BEFORE INSERT OR UPDATE OF subscription_id, customer_id ON booking
        FOR EACH ROW EXECUTE FUNCTION check_booking_subscription()
    """)
    op.execute("""
        CREATE TRIGGER booking_subscription_identity
        AFTER UPDATE ON user_subscriptions FOR EACH ROW
        WHEN (OLD.user_id IS DISTINCT FROM NEW.user_id OR OLD.type IS DISTINCT FROM NEW.type)
        EXECUTE FUNCTION guard_booked_subscription()
    """)


def downgrade():
    op.execute("DROP TRIGGER booking_subscription_identity ON user_subscriptions")
    op.execute("DROP TRIGGER booking_subscription_link ON booking")
    op.execute("DROP FUNCTION guard_booked_subscription()")
    op.execute("DROP FUNCTION check_booking_subscription()")
    for name in CHECKS:
        op.drop_constraint(name, "booking", type_="check")
    op.alter_column("booking", "status", nullable=True)
