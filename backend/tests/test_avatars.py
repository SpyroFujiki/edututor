import base64
import unittest
from io import BytesIO
from unittest.mock import patch

from PIL import Image
from sqlalchemy import event
from test_domain_api import DomainApiFixture

from app.core.avatar import MAX_AVATAR_BYTES, normalize_avatar


def picture(format="PNG", size=(48, 32), *, exif=None):
    output = BytesIO()
    with Image.new("RGB", size, "#247447") as image:
        image.save(output, format, **({"exif": exif} if exif else {}))
    mime = {"PNG": "png", "JPEG": "jpeg", "WEBP": "webp"}[format]
    return f"data:image/{mime};base64," + base64.b64encode(output.getvalue()).decode("ascii")


class AvatarImageTests(unittest.TestCase):
    def test_supported_raster_formats_become_small_webp_data_urls(self):
        for format in ("PNG", "JPEG", "WEBP"):
            with self.subTest(format=format):
                value = normalize_avatar(picture(format, (1024, 768)))
                self.assertTrue(value.startswith("data:image/webp;base64,"))
                with Image.open(BytesIO(base64.b64decode(value.partition(",")[2]))) as image:
                    self.assertEqual(image.size, (512, 384))
                    self.assertEqual(image.format, "WEBP")

    def test_exif_orientation_is_applied_and_metadata_is_removed(self):
        exif = Image.Exif()
        exif[274] = 6
        exif[270] = "Private camera metadata"
        value = normalize_avatar(picture("JPEG", (40, 20), exif=exif))
        with Image.open(BytesIO(base64.b64decode(value.partition(",")[2]))) as image:
            self.assertEqual(image.size, (20, 40))
            self.assertFalse(image.getexif())

    def test_invalid_base64_non_images_svg_and_mismatched_mime_are_rejected(self):
        bad_values = [
            "https://example.com/avatar.png",
            "",
            "data:image/png;base64,",
            "data:image/png;base64,not base64",
            "data:image/svg+xml;base64,PHN2Zy8+",
            "data:image/png;base64," + base64.b64encode(b"not an image").decode(),
            picture().replace("image/png", "image/jpeg"),
        ]
        for value in bad_values:
            with self.subTest(value=value[:45]), self.assertRaises(ValueError):
                normalize_avatar(value)

    def test_decoded_size_pixel_limit_and_truncated_content_are_rejected(self):
        with self.assertRaises(ValueError):
            normalize_avatar(
                "data:image/png;base64," + base64.b64encode(b"x" * (MAX_AVATAR_BYTES + 1)).decode()
            )
        with patch("app.core.avatar.MAX_AVATAR_PIXELS", 10), self.assertRaises(ValueError):
            normalize_avatar(picture())
        truncated = base64.b64decode(picture().partition(",")[2])[:20]
        with self.assertRaises(ValueError):
            normalize_avatar("data:image/png;base64," + base64.b64encode(truncated).decode())
        self.assertIsNone(normalize_avatar(None))


class AvatarApiTests(DomainApiFixture):
    def test_upload_persists_and_name_only_updates_do_not_erase_avatar(self):
        profile = self.request(
            "PATCH", "/auth/profile", {"full_name": "Nguyễn An", "avatar_base64": picture()}
        )
        saved = profile["avatar_base64"]
        self.assertTrue(saved.startswith("data:image/webp;base64,"))
        self.assertEqual(self.request("GET", "/auth/me")["avatar_base64"], saved)
        renamed = self.request("PATCH", "/auth/profile", {"full_name": "Nguyễn Bình"})
        self.assertEqual(renamed["avatar_base64"], saved)
        replaced = self.request("PATCH", "/auth/profile", {"avatar_base64": picture("JPEG")})
        self.assertEqual(replaced["full_name"], "Nguyễn Bình")
        cleared = self.request("PATCH", "/auth/profile", {"avatar_base64": None})
        self.assertIsNone(cleared["avatar_base64"])
        self.assertEqual(cleared["full_name"], "Nguyễn Bình")

    def test_only_current_user_can_change_avatar_and_bad_payload_does_not_change_profile(self):
        self.request("PATCH", "/auth/profile", {"avatar_base64": picture()}, who=None, expected=401)
        self.request(
            "PATCH",
            "/auth/profile",
            {"avatar_base64": picture(), "id": str(self.ids["other"])},
            expected=422,
        )
        self.request(
            "PATCH",
            "/auth/profile",
            {"avatar_base64": picture(), "role": "head_admin"},
            expected=422,
        )
        for body in (
            {},
            {"full_name": None},
            {"avatar_base64": "not an image"},
            {"avatar_base64": 123},
        ):
            self.request("PATCH", "/auth/profile", body, expected=422)
        self.assertIsNone(self.request("GET", "/auth/me")["avatar_base64"])
        self.assertIsNone(self.request("GET", "/auth/me", who="other")["avatar_base64"])

    def test_admin_lists_and_audit_identities_do_not_load_or_repeat_avatar_payloads(self):
        self.request("PATCH", "/auth/profile", {"avatar_base64": picture()})
        self.request(
            "POST",
            f"/admin/users/{self.ids['customer']}/status",
            {"status": "active", "reason": "Profile check"},
            who="head",
        )
        statements = []

        def capture(_connection, _cursor, statement, _parameters, _context, _many):
            statements.append(statement)

        event.listen(self.engine, "before_cursor_execute", capture)
        try:
            rows = self.request("GET", "/admin/users", who="head")
            logs = self.request("GET", "/admin/action-logs", who="head")
        finally:
            event.remove(self.engine, "before_cursor_execute", capture)
        self.assertTrue(all("avatar_base64" not in row for row in rows))
        self.assertTrue(
            all(
                "avatar_base64" not in (row["admin"] or {})
                and "avatar_base64" not in (row["target_user"] or {})
                for row in logs
            )
        )
        self.assertFalse(any("avatar_base64" in statement for statement in statements))
