"""Validate raster image data URLs and store a small, metadata-free avatar."""

import base64
import binascii
import warnings
from io import BytesIO

from PIL import Image, ImageOps, UnidentifiedImageError

MAX_AVATAR_BYTES = 5 * 1024 * 1024
MAX_AVATAR_DATA_LENGTH = 4 * ((MAX_AVATAR_BYTES + 2) // 3) + 40
# The stored 512px image stays within the existing database constraint.
MAX_STORED_AVATAR_DATA_LENGTH = 2796244
MAX_AVATAR_PIXELS = 4096 * 4096
AVATAR_SIZE = (512, 512)
FORMATS = {
    "data:image/png;base64": "PNG",
    "data:image/jpeg;base64": "JPEG",
    "data:image/webp;base64": "WEBP",
}


def normalize_avatar(value: str | None) -> str | None:
    if value is None:
        return None
    if len(value) > MAX_AVATAR_DATA_LENGTH:
        raise ValueError("Ảnh đại diện vượt quá 5 MB")
    header, separator, encoded = value.partition(",")
    if not separator or header not in FORMATS:
        raise ValueError("Ảnh đại diện phải là ảnh PNG, JPEG hoặc WebP dạng base64")
    try:
        data = base64.b64decode(encoded, validate=True)
    except (binascii.Error, ValueError):
        raise ValueError("Dữ liệu base64 của ảnh không hợp lệ") from None
    if not data or len(data) > MAX_AVATAR_BYTES:
        raise ValueError("Ảnh phải có dung lượng từ 1 byte đến 5 MB")
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            with Image.open(BytesIO(data), formats=list(FORMATS.values())) as probe:
                if probe.format != FORMATS[header]:
                    raise ValueError("Nội dung ảnh không khớp định dạng đã chọn")
                if probe.width * probe.height > MAX_AVATAR_PIXELS:
                    raise ValueError("Ảnh có độ phân giải quá lớn; vui lòng chọn ảnh nhỏ hơn")
                if getattr(probe, "n_frames", 1) != 1:
                    raise ValueError("Vui lòng dùng ảnh đại diện tĩnh")
                probe.verify()
            with Image.open(BytesIO(data), formats=list(FORMATS.values())) as source:
                source.load()
                with ImageOps.exif_transpose(source) as oriented:
                    oriented.thumbnail(AVATAR_SIZE, Image.Resampling.LANCZOS)
                    mode = (
                        "RGBA"
                        if "A" in oriented.getbands() or "transparency" in oriented.info
                        else "RGB"
                    )
                    with oriented.convert(mode) as avatar:
                        output = BytesIO()
                        avatar.save(
                            output, "WEBP", quality=85, method=4, exif=b"", icc_profile=b"", xmp=b""
                        )
    except (
        UnidentifiedImageError,
        OSError,
        SyntaxError,
        Image.DecompressionBombError,
        Image.DecompressionBombWarning,
    ):
        raise ValueError(
            "Không đọc được ảnh. Vui lòng chọn ảnh PNG, JPEG hoặc WebP hợp lệ"
        ) from None
    result = "data:image/webp;base64," + base64.b64encode(output.getvalue()).decode("ascii")
    if len(result) > MAX_STORED_AVATAR_DATA_LENGTH:
        raise ValueError("Ảnh đại diện vượt quá dung lượng cho phép")
    return result
