"""Derive dispute completion from the resolution timestamp."""

import sqlalchemy as sa
from alembic import op

revision = "0010_dispute_resolve_at"
down_revision = "0009_normalize_domain_tables"
branch_labels = None
depends_on = None


def upgrade():
    op.execute("LOCK TABLE disputes IN ACCESS EXCLUSIVE MODE")
    op.execute("""
        DO $$
        DECLARE
            conflicts jsonb;
        BEGIN
            SELECT jsonb_agg(to_jsonb(sample)) INTO conflicts
            FROM (
                SELECT id, booking_id, is_completed, resolve_at
                FROM disputes
                WHERE coalesce(is_completed, false) <> (resolve_at IS NOT NULL)
                ORDER BY id
                LIMIT 10
            ) sample;
            IF conflicts IS NOT NULL THEN
                RAISE EXCEPTION 'Dispute status conflicts with resolve_at (up to 10 rows)'
                    USING ERRCODE = '23514', DETAIL = conflicts::text;
            END IF;
        END;
        $$;
    """)
    op.drop_column("disputes", "is_completed")


def downgrade():
    op.add_column(
        "disputes",
        sa.Column("is_completed", sa.Boolean(), server_default=sa.text("false"), nullable=True),
    )
    op.execute("UPDATE disputes SET is_completed = (resolve_at IS NOT NULL)")
