"""Opt-in migration cycles in a disposable loopback PostgreSQL schema."""

import os
import unittest
from concurrent.futures import ThreadPoolExecutor
from decimal import Decimal
from queue import Queue
from time import monotonic, sleep
from unittest.mock import patch
from uuid import uuid4

from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, inspect, select, text
from sqlalchemy.exc import DBAPIError, IntegrityError
from sqlalchemy.orm import sessionmaker

from app.core.config import BACKEND_DIR, ROOT_DIR, get_database_settings
from app.core.database import expected_schema_heads
from app.models import (
    Base,
    BookingSettlement,
    CashOrder,
    Course,
    CourseProgress,
    Lesson,
    Post,
    RoleRequest,
    User,
    UserSubscription,
)
from app.models.enums import CourseStatus, ServiceType, SubscriptionStatus, UserRole, UserStatus
from app.modules.common import now
from app.modules.learning.learning_service import record_attendance


@unittest.skipUnless(
    os.environ.get("TUTOR_TEST_POSTGRES") == "1",
    "Set TUTOR_TEST_POSTGRES=1 for isolated PostgreSQL tests",
)
class PostgreSQLMigrationTests(unittest.TestCase):
    def setUp(self):
        settings = get_database_settings()
        self.assertIn(settings.url.host, {"localhost", "127.0.0.1", "::1"})
        self.schema = "tutor_migration_test_" + uuid4().hex
        self.control = create_engine(settings.url, hide_parameters=True)
        self.addCleanup(self.control.dispose)
        with self.control.begin() as connection:
            connection.execute(text(f'CREATE SCHEMA "{self.schema}"'))
        self.addCleanup(self.drop_schema)
        self.engine = create_engine(
            settings.url,
            hide_parameters=True,
            connect_args={
                "options": f"-c search_path={self.schema} -c timezone=UTC -c statement_timeout=15000",
            },
        )
        self.addCleanup(self.engine.dispose)
        self.factory = sessionmaker(self.engine, expire_on_commit=False)
        self.config = Config(str(ROOT_DIR / "alembic.ini"))
        self.config.set_main_option("script_location", str(BACKEND_DIR / "migrations"))
        self.config.set_main_option("prepend_sys_path", str(BACKEND_DIR))

    def drop_schema(self):
        self.assertRegex(self.schema, r"^tutor_migration_test_[0-9a-f]{32}$")
        with self.control.begin() as connection:
            connection.execute(text(f'DROP SCHEMA "{self.schema}" CASCADE'))

    def migrate(self, target, *, downgrade=False):
        with patch("app.core.database.create_database_engine", return_value=self.engine):
            (command.downgrade if downgrade else command.upgrade)(self.config, target)

    def test_empty_database_upgrades_to_current_models_and_downgrades_cleanly(self):
        self.migrate("head")
        self.assertEqual(
            set(inspect(self.engine).get_table_names()),
            set(Base.metadata.tables) | {"alembic_version"},
        )
        with self.engine.connect() as connection:
            self.assertEqual(
                frozenset(connection.scalars(text("SELECT version_num FROM alembic_version"))),
                expected_schema_heads(),
            )
            protected = connection.scalar(
                text(
                    "SELECT count(*) FROM pg_class WHERE relnamespace = current_schema()::regnamespace "
                    "AND relkind = 'r' AND relrowsecurity"
                )
            )
            self.assertEqual(protected, len(Base.metadata.tables) + 1)
        self.migrate("base", downgrade=True)
        self.assertEqual(inspect(self.engine).get_table_names(), ["alembic_version"])

    def create_enrollment(self):
        user_id, course_id, lesson_id, subscription_id = [uuid4() for _ in range(4)]
        with self.factory.begin() as session:
            session.execute(
                User.__table__.insert().values(
                    id=user_id, role=UserRole.STUDENT, status=UserStatus.ACTIVE
                )
            )
            session.add(
                Course(
                    id=course_id,
                    title="Migration fixture",
                    price=0,
                    status=CourseStatus.VISIBLE,
                    is_live=False,
                    created_at=now(),
                    updated_at=now(),
                )
            )
            session.flush()
            session.add(
                Lesson(id=lesson_id, course_id=course_id, order_idx=1, duration_seconds=600)
            )
            session.add(
                UserSubscription(
                    id=subscription_id,
                    user_id=user_id,
                    type=ServiceType.COURSE,
                    title_at_purchase="Migration fixture",
                    price_at_purchase=0,
                    status=SubscriptionStatus.ACTIVE,
                    activated_at=now(),
                )
            )
            session.flush()
            session.add(
                CourseProgress(
                    subscription_id=subscription_id,
                    course_id=course_id,
                    progress_percent=Decimal("99.99"),
                )
            )
        return user_id, course_id, lesson_id, subscription_id

    def test_existing_watch_history_survives_upgrade_and_ungraded_completion_downgrade(self):
        self.migrate("0006_database_audit_operation")
        user_id, course_id, lesson_id, subscription_id = self.create_enrollment()
        with self.factory.begin() as session:
            session.execute(
                text(
                    "INSERT INTO attendance (subscription_id, course_id, lesson_id, duration_watched, is_absent) "
                    "VALUES (:subscription, :course, :lesson, 600, false)"
                ),
                {"subscription": subscription_id, "course": course_id, "lesson": lesson_id},
            )
        self.migrate("head")
        with self.factory.begin() as session:
            progress = record_attendance(session, user_id, subscription_id, lesson_id, 600)
            self.assertEqual(progress.progress_percent, Decimal("100.00"))
            self.assertIsNotNone(progress.completed_at)
            self.assertIsNone(progress.final_score)
            self.assertIsNone(progress.result)
        self.migrate("0006_database_audit_operation", downgrade=True)
        with self.engine.connect() as connection:
            progress = connection.execute(
                text("SELECT progress_percent, completed_at FROM course_progress")
            ).one()
            self.assertEqual(progress.progress_percent, Decimal("99.99"))
            self.assertIsNone(progress.completed_at)
            self.assertEqual(
                connection.scalar(text("SELECT duration_watched FROM attendance")), 600
            )
        self.migrate("head")
        with self.engine.connect() as connection:
            self.assertIs(
                connection.scalar(text("SELECT assignment_completed FROM attendance")), False
            )

    def test_attendance_rejects_mismatched_inserts_and_course_changes(self):
        self.migrate("head")
        _, course_id, lesson_id, subscription_id = self.create_enrollment()
        _, other_course, other_lesson, other_subscription = self.create_enrollment()
        values = {
            "subscription": subscription_id,
            "lesson": lesson_id,
            "other_course": other_course,
            "other_lesson": other_lesson,
            "other_subscription": other_subscription,
        }
        insert = (
            "INSERT INTO attendance (subscription_id, lesson_id) VALUES (:subscription, :lesson)"
        )
        with self.assertRaises(IntegrityError) as error, self.engine.begin() as connection:
            connection.execute(text(insert), {**values, "lesson": other_lesson})
        self.assertEqual(error.exception.orig.diag.constraint_name, "attendance_same_course")
        with self.engine.begin() as connection:
            connection.execute(text(insert), values)
        for statement in (
            "UPDATE attendance SET lesson_id = :other_lesson",
            "UPDATE attendance SET subscription_id = :other_subscription",
            "UPDATE lessons SET course_id = :other_course, order_idx = 2 WHERE id = :lesson",
            "UPDATE course_progress SET course_id = :other_course WHERE subscription_id = :subscription",
        ):
            with self.subTest(statement=statement):
                with self.assertRaises(IntegrityError) as error, self.engine.begin() as connection:
                    connection.execute(text(statement), values)
                self.assertEqual(
                    error.exception.orig.diag.constraint_name, "attendance_same_course"
                )
        with self.engine.connect() as connection:
            self.assertEqual(
                connection.execute(
                    text(
                        "SELECT p.course_id, l.course_id FROM attendance "
                        "JOIN course_progress p USING (subscription_id) JOIN lessons l ON l.id = lesson_id"
                    )
                ).one(),
                (course_id, course_id),
            )

    def test_concurrent_attendance_insert_and_parent_move(self):
        self.migrate("head")
        for isolation in ("READ COMMITTED", "REPEATABLE READ"):
            for parent_first in (False, True):
                with self.subTest(isolation=isolation, parent_first=parent_first):
                    _, _, lesson_id, subscription_id = self.create_enrollment()
                    _, other_course, _, _ = self.create_enrollment()
                    values = {
                        "subscription": subscription_id,
                        "lesson": lesson_id,
                        "other_course": other_course,
                    }
                    insert = text(
                        "INSERT INTO attendance (subscription_id, lesson_id) VALUES (:subscription, :lesson)"
                    )
                    move = text(
                        "UPDATE lessons SET course_id = :other_course, order_idx = 2 WHERE id = :lesson"
                    )
                    first, second = (move, insert) if parent_first else (insert, move)
                    waiting_pid = Queue(maxsize=1)

                    def try_second_write():
                        with self.engine.connect().execution_options(
                            isolation_level=isolation
                        ) as connection:
                            try:
                                with connection.begin():
                                    waiting_pid.put(
                                        connection.scalar(text("SELECT pg_backend_pid()"))
                                    )
                                    connection.execute(second, values)
                            except DBAPIError as error:
                                return error.orig.sqlstate
                            return None

                    with (
                        ThreadPoolExecutor(max_workers=1) as pool,
                        self.engine.begin() as connection,
                    ):
                        connection.execute(first, values)
                        pending = pool.submit(try_second_write)
                        pid = waiting_pid.get(timeout=5)
                        deadline = monotonic() + 5
                        with self.engine.connect() as observer:
                            while not observer.scalar(
                                text("SELECT cardinality(pg_blocking_pids(:pid))"), {"pid": pid}
                            ):
                                self.assertLess(
                                    monotonic(),
                                    deadline,
                                    "Concurrent write never waited for its peer",
                                )
                                sleep(0.01)
                        connection.commit()

                    self.assertEqual(
                        pending.result(), "23514" if isolation == "READ COMMITTED" else "40001"
                    )

    def test_preflight_blocks_conflicts_then_valid_history_round_trips(self):
        self.migrate("0008_user_avatar")
        user_id, _, _, subscription_id = self.create_enrollment()
        values = {
            key: uuid4()
            for key in (
                "other",
                "wallet",
                "missing",
                "cash",
                "role",
                "post",
                "package",
                "booking",
                "settlement",
            )
        }
        values.update(
            user=user_id, subscription=subscription_id, avatar="data:image/webp;base64,AA=="
        )
        statements = (
            "INSERT INTO users (id, role) VALUES (:other, 'student')",
            "INSERT INTO wallets (id, user_id, type) VALUES (:wallet, :user, 'commercial')",
            "INSERT INTO cash_order (id) VALUES (:missing)",
            "INSERT INTO cash_order (id, wallet_id, user_id) VALUES (:cash, :wallet, :other)",
            "INSERT INTO role_requests (id, user_id, current_role_at_request, question_set) VALUES (:role, :user, 'student', 2)",
            "INSERT INTO posts (id, author_id, author_avatar_url) VALUES (:post, :user, :avatar)",
            "INSERT INTO tutoring_package (id) VALUES (:package)",
            "INSERT INTO booking (id, package_id, customer_id, status) VALUES (:booking, :package, :user, 'pending')",
            """
            INSERT INTO booking_settlements (id, booking_id, tutor_wallet_id, total_amount,
                commission_rate, platform_fee, tutor_income, available_amount, hold_amount)
            VALUES (:settlement, :booking, :wallet, 105, 10, 11, 94, 1, 93)
            """,
            """
            UPDATE course_progress SET progress_percent = 100, completed_at = now(),
                midterm_score = 84, endterm_score = 85, practice_score = 85,
                final_score = 84, result = 'good' WHERE subscription_id = :subscription
            """,
        )
        with self.engine.begin() as connection:
            for statement in statements:
                connection.execute(text(statement), values)

        with self.assertRaises(IntegrityError) as error:
            self.migrate("head")
        self.assertEqual(error.exception.orig.sqlstate, "23514")
        detail = error.exception.orig.diag.message_detail
        for key in ("missing", "cash", "role", "subscription", "settlement"):
            self.assertIn(str(values[key]), detail)

        total = 2**63 - 1
        fee = total // 10
        income = total - fee
        values.update(total=total, fee=fee, income=income)
        corrections = (
            "DELETE FROM cash_order WHERE id = :missing",
            "UPDATE cash_order SET user_id = :user WHERE id = :cash",
            "UPDATE role_requests SET question_set = 3 WHERE id = :role",
            """
            UPDATE booking_settlements SET total_amount = :total, platform_fee = :fee,
                tutor_income = :income, available_amount = 0, hold_amount = :income
            """,
            "UPDATE course_progress SET final_score = 85, result = 'excellent' WHERE subscription_id = :subscription",
        )
        with self.engine.begin() as connection:
            self.assertEqual(
                connection.scalar(text("SELECT version_num FROM alembic_version")),
                "0008_user_avatar",
            )
            for statement in corrections:
                connection.execute(text(statement), values)

        self.migrate("head")
        with self.factory() as session:
            self.assertEqual(session.get(CashOrder, values["cash"]).user_id, user_id)
            self.assertEqual(session.get(RoleRequest, values["role"]).question_set, 3)
            self.assertEqual(
                session.get(Post, values["post"]).author_avatar_base64, values["avatar"]
            )
            progress = session.get(CourseProgress, subscription_id)
            self.assertEqual((progress.final_score, progress.result), (85, "excellent"))
            self.assertEqual(
                session.execute(
                    select(
                        BookingSettlement.platform_fee,
                        BookingSettlement.tutor_income,
                        BookingSettlement.hold_amount,
                    )
                ).one(),
                (fee, income, income),
            )
        self.migrate("0008_user_avatar", downgrade=True)
        with self.engine.connect() as connection:
            self.assertEqual(connection.scalar(text("SELECT user_id FROM cash_order")), user_id)
            self.assertEqual(connection.scalar(text("SELECT question_set FROM role_requests")), 3)
            self.assertEqual(
                connection.scalar(text("SELECT author_avatar_url FROM posts")), values["avatar"]
            )
            self.assertEqual(
                connection.execute(text("SELECT final_score, result FROM course_progress")).one(),
                (85, "excellent"),
            )
            self.assertEqual(
                connection.execute(
                    text(
                        "SELECT platform_fee, tutor_income, available_amount, hold_amount FROM booking_settlements"
                    )
                ).one(),
                (fee, income, 0, income),
            )

    def test_dispute_timestamp_migration_preserves_history_and_blocks_conflicts(self):
        previous = "0009_normalize_domain_tables"
        self.migrate(previous)
        user, _, _, _ = self.create_enrollment()
        values = {
            key: uuid4() for key in ("package", "open_booking", "closed_booking", "open", "closed")
        }
        values.update(user=user, resolved=now())
        with self.engine.begin() as connection:
            connection.execute(text("INSERT INTO tutoring_package (id) VALUES (:package)"), values)
            connection.execute(
                text("""
                INSERT INTO booking (id, package_id, customer_id, status)
                VALUES (:open_booking, :package, :user, 'pending'),
                       (:closed_booking, :package, :user, 'pending')
            """),
                values,
            )
            connection.execute(
                text("""
                INSERT INTO disputes (id, booking_id, raised_by_user_id, is_completed, resolve_at)
                VALUES (:open, :open_booking, :user, NULL, NULL),
                       (:closed, :closed_booking, :user, true, NULL)
            """),
                values,
            )
        with self.assertRaises(IntegrityError) as error:
            self.migrate("head")
        self.assertIn(str(values["closed"]), error.exception.orig.diag.message_detail)
        with self.engine.begin() as connection:
            connection.execute(
                text("UPDATE disputes SET resolve_at = :resolved WHERE id = :closed"), values
            )

        self.migrate("head")
        self.assertNotIn(
            "is_completed",
            {column["name"] for column in inspect(self.engine).get_columns("disputes")},
        )
        with self.engine.connect() as connection:
            rows = dict(connection.execute(text("SELECT id, resolve_at FROM disputes")).all())
            self.assertEqual(rows, {values["open"]: None, values["closed"]: values["resolved"]})
        self.migrate(previous, downgrade=True)
        with self.engine.connect() as connection:
            rows = dict(connection.execute(text("SELECT id, is_completed FROM disputes")).all())
            self.assertEqual(rows, {values["open"]: False, values["closed"]: True})

    def test_booking_integrity_blocks_invalid_history_and_future_changes(self):
        self.migrate("0010_dispute_resolve_at")
        customer, _, _, course_subscription = self.create_enrollment()
        other, _, _, _ = self.create_enrollment()
        values = {key: uuid4() for key in ("package", "booking", "purchase")}
        values.update(customer=customer, other=other, course=course_subscription)
        with self.engine.begin() as connection:
            connection.execute(text("INSERT INTO tutoring_package (id) VALUES (:package)"), values)
            connection.execute(
                text("""
                INSERT INTO user_subscriptions (id, user_id, type, activated_at)
                VALUES (:purchase, :customer, 'booking', now())
            """),
                values,
            )
            connection.execute(
                text("""
                INSERT INTO booking (id, package_id, customer_id, status, subscription_id)
                VALUES (:booking, :package, :customer, 'confirmed', :course)
            """),
                values,
            )

        with self.assertRaises(IntegrityError) as error:
            self.migrate("head")
        self.assertIn(str(values["booking"]), error.exception.orig.diag.message_detail)
        with self.engine.begin() as connection:
            connection.execute(
                text("UPDATE booking SET subscription_id = :purchase WHERE id = :booking"), values
            )
        self.migrate("head")

        for statement, constraint in (
            ("UPDATE booking SET status = NULL", None),
            ("UPDATE booking SET status = 'pending'", "ck_booking_status_subscription"),
            ("UPDATE booking SET subscription_id = NULL", "ck_booking_status_subscription"),
            ("UPDATE booking SET status = 'assigned'", "ck_booking_status_tutor"),
            ("UPDATE booking SET tutor_id = customer_id", "ck_booking_distinct_participants"),
            ("UPDATE booking SET customer_id = :other", "booking_subscription_owner_and_type"),
            ("UPDATE booking SET subscription_id = :course", "booking_subscription_owner_and_type"),
            (
                "UPDATE user_subscriptions SET type = 'course' WHERE id = :purchase",
                "booking_subscription_owner_and_type",
            ),
            (
                "UPDATE user_subscriptions SET user_id = :other WHERE id = :purchase",
                "booking_subscription_owner_and_type",
            ),
        ):
            with self.subTest(statement=statement):
                with self.assertRaises(IntegrityError) as error, self.engine.begin() as connection:
                    connection.execute(text(statement), values)
                self.assertEqual(error.exception.orig.diag.constraint_name, constraint)

        with self.engine.begin() as connection:
            connection.execute(
                text("UPDATE booking SET tutor_id = :other, status = 'assigned'"), values
            )
        with self.engine.begin() as connection:
            connection.execute(
                text("UPDATE booking SET status = 'pending', subscription_id = NULL")
            )
        with self.engine.connect().execution_options(isolation_level="REPEATABLE READ") as stale:
            with self.assertRaises(DBAPIError) as error, stale.begin():
                stale.execute(
                    text("SELECT type FROM user_subscriptions WHERE id = :purchase"), values
                )
                with self.engine.begin() as writer:
                    writer.execute(
                        text(
                            "UPDATE booking SET status = 'confirmed', subscription_id = :purchase"
                        ),
                        values,
                    )
                stale.execute(
                    text("UPDATE user_subscriptions SET type = 'course' WHERE id = :purchase"),
                    values,
                )
            self.assertEqual(error.exception.orig.sqlstate, "40001")

        self.migrate("0010_dispute_resolve_at", downgrade=True)
        with self.engine.begin() as connection:
            connection.execute(text("UPDATE booking SET status = NULL"))

    def test_avatar_upgrade_preserves_existing_profile_and_enforces_storage_limit(self):
        self.migrate("0007_learning_progress")
        identity = uuid4()
        with self.engine.begin() as connection:
            connection.execute(
                text(
                    "INSERT INTO users (id, full_name, role, status) VALUES (:id, 'Existing profile', 'member', 'active')"
                ),
                {"id": identity},
            )
        self.migrate("head")
        from test_avatars import picture

        from app.core.avatar import MAX_STORED_AVATAR_DATA_LENGTH, normalize_avatar

        avatar = normalize_avatar(picture())
        with self.factory.begin() as session:
            user = session.get(User, identity)
            self.assertEqual(user.full_name, "Existing profile")
            self.assertIsNone(user.avatar_base64)
            user.avatar_base64 = avatar
        with self.factory() as session:
            self.assertEqual(session.get(User, identity).avatar_base64, avatar)
        with self.assertRaises(IntegrityError):
            with self.engine.begin() as connection:
                connection.execute(
                    text("UPDATE users SET avatar_base64 = :value WHERE id = :id"),
                    {"value": "x" * (MAX_STORED_AVATAR_DATA_LENGTH + 1), "id": identity},
                )
        self.migrate("0007_learning_progress", downgrade=True)
        with self.engine.connect() as connection:
            self.assertEqual(
                connection.scalar(
                    text("SELECT full_name FROM users WHERE id = :id"), {"id": identity}
                ),
                "Existing profile",
            )
        self.migrate("head")
        with self.factory() as session:
            self.assertIsNone(session.get(User, identity).avatar_base64)
