"""Derive redundant learning, payment and role-request fields."""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0009_normalize_domain_tables"
down_revision = "0008_user_avatar"
branch_labels = None
depends_on = None

FEE = "div(total_amount::numeric * commission_rate, 100)::bigint"
INCOME = f"total_amount - {FEE}"
SCORE = """
CASE WHEN completed_at IS NOT NULL
THEN round((midterm_score::numeric + endterm_score + practice_score) / 3)::integer
END
"""
RESULT = f"""
(CASE WHEN ({SCORE}) >= 85 THEN 'excellent'
      WHEN ({SCORE}) >= 50 THEN 'good'
      WHEN ({SCORE}) < 50 THEN 'failed'
 END)::course_result
"""
QUESTION_SET = """
CASE current_role_at_request
    WHEN 'guest' THEN 1 WHEN 'member' THEN 2 WHEN 'student' THEN 3
    WHEN 'trainee_tutor' THEN 4 WHEN 'tutor' THEN 5 WHEN 'admin' THEN 6
    WHEN 'head_admin' THEN 7
END
"""
OLD_COMPLETION = (
    "(progress_percent < 100 AND result IS NULL AND completed_at IS NULL) OR "
    "(progress_percent = 100 AND completed_at IS NOT NULL AND "
    "((result IS NULL AND final_score IS NULL) OR (result IS NOT NULL AND final_score IS NOT NULL)))"
)
OLD_NONNEGATIVE = (
    "total_amount >= 0 AND platform_fee >= 0 AND tutor_income >= 0 "
    "AND available_amount >= 0 AND hold_amount >= 0"
)


def validate_history():
    checks = {
        "attendance: missing parent or course mismatch": """
            SELECT a.subscription_id, a.lesson_id, a.course_id,
                   p.course_id AS progress_course_id, l.course_id AS lesson_course_id
            FROM attendance a
            LEFT JOIN course_progress p ON p.subscription_id = a.subscription_id
            LEFT JOIN lessons l ON l.id = a.lesson_id
            WHERE a.course_id IS DISTINCT FROM p.course_id
               OR a.course_id IS DISTINCT FROM l.course_id
            ORDER BY a.subscription_id, a.lesson_id
        """,
        "cash_order: missing wallet or owner mismatch": """
            SELECT o.id, o.wallet_id, o.user_id AS order_user_id, w.user_id AS wallet_user_id
            FROM cash_order o LEFT JOIN wallets w ON w.id = o.wallet_id
            WHERE w.id IS NULL OR o.user_id IS DISTINCT FROM w.user_id
            ORDER BY o.id
        """,
        "booking_settlements: stored allocation differs from initial allocation": f"""
            SELECT id, booking_id, total_amount, commission_rate, platform_fee, tutor_income,
                   available_amount, hold_amount, {FEE} AS expected_fee,
                   {INCOME} AS expected_income
            FROM booking_settlements
            WHERE platform_fee IS DISTINCT FROM ({FEE})
               OR tutor_income IS DISTINCT FROM ({INCOME})
               OR hold_amount IS DISTINCT FROM ({INCOME})
               OR available_amount IS DISTINCT FROM 0
            ORDER BY id
        """,
        "course_progress: stored grade differs from derived grade": f"""
            SELECT subscription_id, completed_at, midterm_score, endterm_score, practice_score,
                   final_score, result, {SCORE} AS expected_score, {RESULT} AS expected_result
            FROM course_progress
            WHERE final_score IS DISTINCT FROM ({SCORE}) OR result IS DISTINCT FROM ({RESULT})
            ORDER BY subscription_id
        """,
        "role_requests: unexpected question set": f"""
            SELECT id, current_role_at_request, question_set, {QUESTION_SET} AS expected_question_set
            FROM role_requests
            WHERE question_set IS DISTINCT FROM ({QUESTION_SET})
            ORDER BY id
        """,
    }
    statements = []
    for label, query in checks.items():
        statements.append(f"""
            SELECT jsonb_agg(to_jsonb(sample)) INTO samples FROM ({query} LIMIT 10) sample;
            IF samples IS NOT NULL THEN
                failures := failures || jsonb_build_object('{label}', samples);
            END IF;
        """)
    op.execute(f"""
        DO $$
        DECLARE
            samples jsonb;
            failures jsonb := '{{}}';
        BEGIN
            {"".join(statements)}
            IF failures <> '{{}}'::jsonb THEN
                RAISE EXCEPTION 'Normalization preflight failed (up to 10 rows per check)'
                    USING ERRCODE = '23514', DETAIL = failures::text;
            END IF;
        END;
        $$;
    """)


def create_attendance_guards():
    # Row versions serialize attendance writes with parent moves even at REPEATABLE READ.
    # A concurrent move must either see the attendance or fail with a serialization error.
    op.execute("""
        CREATE FUNCTION check_attendance_course() RETURNS trigger
        LANGUAGE plpgsql AS $$
        DECLARE
            progress_course uuid;
            lesson_course uuid;
        BEGIN
            UPDATE course_progress SET course_id = course_id
            WHERE subscription_id = NEW.subscription_id RETURNING course_id INTO progress_course;
            UPDATE lessons SET course_id = course_id
            WHERE id = NEW.lesson_id RETURNING course_id INTO lesson_course;
            IF progress_course IS NULL OR lesson_course IS NULL OR progress_course <> lesson_course THEN
                RAISE EXCEPTION 'Attendance subscription % and lesson % must belong to the same course',
                    NEW.subscription_id, NEW.lesson_id
                    USING ERRCODE = '23514', CONSTRAINT = 'attendance_same_course';
            END IF;
            RETURN NEW;
        END;
        $$;
    """)
    op.execute("""
        CREATE FUNCTION check_attendance_parent_course() RETURNS trigger
        LANGUAGE plpgsql AS $$
        BEGIN
            IF TG_TABLE_NAME = 'course_progress' THEN
                IF NOT EXISTS (
                    SELECT 1 FROM attendance a JOIN lessons l ON l.id = a.lesson_id
                    WHERE a.subscription_id = NEW.subscription_id AND l.course_id <> NEW.course_id
                ) THEN
                    RETURN NEW;
                END IF;
            ELSE
                IF NOT EXISTS (
                    SELECT 1 FROM attendance a JOIN course_progress p USING (subscription_id)
                    WHERE a.lesson_id = NEW.id AND p.course_id <> NEW.course_id
                ) THEN
                    RETURN NEW;
                END IF;
            END IF;
            RAISE EXCEPTION 'Changing %.course_id would put attendance in a different course',
                TG_TABLE_NAME USING ERRCODE = '23514', CONSTRAINT = 'attendance_same_course';
        END;
        $$;
    """)
    op.execute("""
        DO $$
        BEGIN
            EXECUTE format(
                'ALTER FUNCTION %I.check_attendance_course() SET search_path TO pg_catalog, %I, pg_temp',
                current_schema(), current_schema()
            );
            EXECUTE format(
                'ALTER FUNCTION %I.check_attendance_parent_course() SET search_path TO pg_catalog, %I, pg_temp',
                current_schema(), current_schema()
            );
        END;
        $$;
    """)
    op.execute("""
        CREATE TRIGGER attendance_course_insert
        BEFORE INSERT ON attendance
        FOR EACH ROW EXECUTE FUNCTION check_attendance_course()
    """)
    op.execute("""
        CREATE TRIGGER attendance_course_update
        BEFORE UPDATE OF subscription_id, lesson_id ON attendance
        FOR EACH ROW
        WHEN (OLD.subscription_id IS DISTINCT FROM NEW.subscription_id
              OR OLD.lesson_id IS DISTINCT FROM NEW.lesson_id)
        EXECUTE FUNCTION check_attendance_course()
    """)
    for table in ("course_progress", "lessons"):
        op.execute(f"""
            CREATE TRIGGER attendance_parent_course_update
            AFTER UPDATE ON {table} FOR EACH ROW
            WHEN (OLD.course_id IS DISTINCT FROM NEW.course_id)
            EXECUTE FUNCTION check_attendance_parent_course()
        """)


def upgrade():
    op.execute("""
        LOCK TABLE attendance, booking_settlements, cash_order, course_progress,
                   lessons, posts, role_requests, wallets IN ACCESS EXCLUSIVE MODE
    """)
    validate_history()

    op.drop_constraint(
        "fk_attendance_lesson_id_course_id_lessons", "attendance", type_="foreignkey"
    )
    op.drop_constraint(
        "fk_attendance_subscription_id_course_id_course_progress", "attendance", type_="foreignkey"
    )
    op.drop_constraint("uq_lessons_id_course_id", "lessons", type_="unique")
    op.drop_constraint(
        "uq_course_progress_subscription_id_course_id", "course_progress", type_="unique"
    )
    op.drop_column("attendance", "course_id")
    op.create_foreign_key(None, "attendance", "lessons", ["lesson_id"], ["id"])
    op.create_foreign_key(
        None, "attendance", "course_progress", ["subscription_id"], ["subscription_id"]
    )
    op.create_index("ix_attendance_lesson_id", "attendance", ["lesson_id"])
    create_attendance_guards()

    op.drop_column("cash_order", "user_id")
    op.alter_column("cash_order", "wallet_id", nullable=False)
    op.create_index("ix_cash_order_wallet_id", "cash_order", ["wallet_id"])

    for name in ("nonnegative_amounts", "total_allocation", "income_allocation"):
        op.drop_constraint(name, "booking_settlements", type_="check")
    for column in ("platform_fee", "tutor_income", "available_amount", "hold_amount"):
        op.drop_column("booking_settlements", column)
    op.create_check_constraint("nonnegative_amounts", "booking_settlements", "total_amount >= 0")

    op.drop_constraint("completion_requires_result", "course_progress", type_="check")
    op.drop_column("course_progress", "final_score")
    op.drop_column("course_progress", "result")
    op.create_check_constraint(
        "completion_timestamp",
        "course_progress",
        "(progress_percent = 100) = (completed_at IS NOT NULL)",
    )
    op.drop_column("role_requests", "question_set")
    op.alter_column(
        "posts", "author_avatar_url", new_column_name="author_avatar_base64", type_=sa.Text()
    )


def downgrade():
    op.alter_column(
        "posts", "author_avatar_base64", new_column_name="author_avatar_url", type_=sa.String()
    )
    op.add_column("role_requests", sa.Column("question_set", sa.Integer()))
    op.execute(f"UPDATE role_requests SET question_set = {QUESTION_SET}")

    op.drop_constraint("completion_timestamp", "course_progress", type_="check")
    op.add_column("course_progress", sa.Column("final_score", sa.Integer()))
    op.add_column(
        "course_progress",
        sa.Column("result", postgresql.ENUM(name="course_result", create_type=False)),
    )
    op.execute(f"UPDATE course_progress SET final_score = {SCORE}, result = {RESULT}")
    op.create_check_constraint("completion_requires_result", "course_progress", OLD_COMPLETION)

    op.drop_constraint("nonnegative_amounts", "booking_settlements", type_="check")
    for column in ("platform_fee", "tutor_income", "available_amount", "hold_amount"):
        op.add_column("booking_settlements", sa.Column(column, sa.BigInteger()))
    op.execute(f"""
        UPDATE booking_settlements
        SET platform_fee = {FEE}, tutor_income = {INCOME}, available_amount = 0, hold_amount = {INCOME}
    """)
    for column in ("platform_fee", "tutor_income", "available_amount", "hold_amount"):
        op.alter_column("booking_settlements", column, nullable=False)
    op.create_check_constraint("nonnegative_amounts", "booking_settlements", OLD_NONNEGATIVE)
    op.create_check_constraint(
        "total_allocation", "booking_settlements", "total_amount = platform_fee + tutor_income"
    )
    op.create_check_constraint(
        "income_allocation", "booking_settlements", "tutor_income = available_amount + hold_amount"
    )

    op.drop_index("ix_cash_order_wallet_id", table_name="cash_order")
    op.alter_column("cash_order", "wallet_id", nullable=True)
    op.add_column("cash_order", sa.Column("user_id", sa.Uuid()))
    op.execute(
        "UPDATE cash_order o SET user_id = w.user_id FROM wallets w WHERE w.id = o.wallet_id"
    )
    op.create_foreign_key(None, "cash_order", "users", ["user_id"], ["id"])

    for trigger in ("attendance_course_insert", "attendance_course_update"):
        op.execute(f"DROP TRIGGER {trigger} ON attendance")
    for table in ("course_progress", "lessons"):
        op.execute(f"DROP TRIGGER attendance_parent_course_update ON {table}")
    op.execute("DROP FUNCTION check_attendance_course()")
    op.execute("DROP FUNCTION check_attendance_parent_course()")
    op.drop_index("ix_attendance_lesson_id", table_name="attendance")
    op.drop_constraint("fk_attendance_lesson_id_lessons", "attendance", type_="foreignkey")
    op.drop_constraint(
        "fk_attendance_subscription_id_course_progress", "attendance", type_="foreignkey"
    )
    op.add_column("attendance", sa.Column("course_id", sa.Uuid()))
    op.execute("""
        UPDATE attendance a SET course_id = p.course_id FROM course_progress p
        WHERE p.subscription_id = a.subscription_id
    """)
    op.alter_column("attendance", "course_id", nullable=False)
    op.create_unique_constraint(None, "lessons", ["id", "course_id"])
    op.create_unique_constraint(None, "course_progress", ["subscription_id", "course_id"])
    op.create_foreign_key(
        None, "attendance", "lessons", ["lesson_id", "course_id"], ["id", "course_id"]
    )
    op.create_foreign_key(
        None,
        "attendance",
        "course_progress",
        ["subscription_id", "course_id"],
        ["subscription_id", "course_id"],
    )
