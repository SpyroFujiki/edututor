"""The personal subscription API preserves all purchases for the history screen."""

from datetime import timedelta
from uuid import UUID, uuid4

from test_domain_api import DomainApiFixture

from app.models import Course, TutoringPackage, UserSubscription
from app.models.enums import ServiceType, SubscriptionStatus
from app.modules.common import now


class PurchaseHistoryTests(DomainApiFixture):
    def test_course_and_tutoring_purchases_keep_original_prices_and_names(self):
        course, _lesson = self.create_course(price=120)
        course_purchase = self.purchase(course)
        booking = self.create_booking(price=230)
        paid = self.request("POST", f"/bookings/{booking['id']}/pay")
        with self.factory.begin() as session:
            current_course = session.get(Course, UUID(course["id"]))
            current_course.title, current_course.price = "Changed course", 999
            current_package = session.get(TutoringPackage, UUID(booking["package_id"]))
            current_package.name, current_package.price = "Changed package", 900
        rows = self.request("GET", "/me/subscriptions")
        by_id = {row["id"]: row for row in rows}
        self.assertEqual(len(rows), 2)
        self.assertEqual(by_id[course_purchase["id"]]["title_at_purchase"], "Python")
        self.assertEqual(by_id[course_purchase["id"]]["price_at_purchase"], 120)
        self.assertEqual(by_id[paid["subscription_id"]]["title_at_purchase"], "Math")
        self.assertEqual(by_id[paid["subscription_id"]]["price_at_purchase"], 230)
        self.assertEqual({row["type"] for row in rows}, {"course", "booking"})
        self.assertEqual(self.request("GET", "/me/subscriptions", who="other"), [])

    def test_all_statuses_are_paginated_and_other_users_history_stays_private(self):
        identities = [uuid4() for _ in range(4)]
        with self.factory.begin() as session:
            for index, status in enumerate(
                (
                    SubscriptionStatus.ACTIVE,
                    SubscriptionStatus.EXPIRED,
                    SubscriptionStatus.CANCELLED,
                )
            ):
                session.add(
                    UserSubscription(
                        id=identities[index],
                        user_id=self.ids["customer"],
                        type=ServiceType.BOOKING if index == 1 else ServiceType.COURSE,
                        title_at_purchase=f"Historical service {index}",
                        price_at_purchase=100 + index,
                        status=status,
                        activated_at=now() - timedelta(days=index),
                    )
                )
            session.add(
                UserSubscription(
                    id=identities[3],
                    user_id=self.ids["other"],
                    type=ServiceType.COURSE,
                    title_at_purchase="Private other purchase",
                    price_at_purchase=500,
                    status=SubscriptionStatus.ACTIVE,
                    activated_at=now(),
                )
            )
        first = self.request("GET", "/me/subscriptions?limit=2&offset=0")
        second = self.request("GET", "/me/subscriptions?limit=2&offset=2")
        self.assertEqual(
            [row["id"] for row in first + second], [str(value) for value in identities[:3]]
        )
        self.assertEqual(
            {row["status"] for row in first + second}, {"active", "expired", "cancelled"}
        )
        self.assertEqual(
            [row["id"] for row in self.request("GET", "/me/subscriptions", who="other")],
            [str(identities[3])],
        )
        self.request("GET", "/me/subscriptions", who=None, expected=401)
