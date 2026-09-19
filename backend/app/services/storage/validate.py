import re

from fastapi import status

from app.services.errors import abort

# Detected from magic bytes, not from the client-provided MIME type.
PNG_MAGIC = b"\x89PNG\r\n\x1a\n"
JPEG_MAGIC = b"\xff\xd8\xff"
WEBP_MAGIC = b"RIFF"  # confirmed by the WEBP marker at offset 8

ALLOWED_FORMATS = ("png", "jpeg", "webp")
ALLOWED_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp"}
_SAFE_BASENAME = re.compile(r"^[A-Za-z0-9_.-]{1,120}$")


def detect_image_format(data: bytes) -> str | None:
    """Return 'png', 'jpeg' or 'webp' based on magic bytes, else None."""
    if data.startswith(PNG_MAGIC):
        return "png"
    if data.startswith(JPEG_MAGIC):
        return "jpeg"
    if data.startswith(WEBP_MAGIC) and len(data) >= 12 and data[8:12] == b"WEBP":
        return "webp"
    return None


def validate_image_file(data: bytes, *, max_bytes: int) -> None:
    """Validate size and true format of an uploaded image.

    Raises ApiError (HTTP 400) for anything that is not a PNG, JPEG or WEBP.
    """
    if not data:
        abort("Uploaded file is empty.")
    if len(data) > max_bytes:
        abort("Image exceeds the maximum allowed size.")
    if detect_image_format(data) is None:
        abort("Unsupported image type. Allowed: PNG, JPEG, WEBP.")


def safe_upload_name(filename: str) -> str:
    """Return a filesystem-safe lowercase basename with a known extension."""
    name = filename or "image"
    name = name.replace("\\", "/").split("/")[-1]
    name = re.sub(r"[^A-Za-z0-9_.-]", "-", name)
    while len(name) < 3:
        name = f"img-{name}"
    if "/" in name or "\\" in name or name.startswith("."):
        name = f"img-{name.replace('/', '-').replace('\\', '-')}"
    return name.lower()[:120]


def extension_for(data: bytes) -> str:
    fmt = detect_image_format(data)
    if fmt == "png":
        return ".png"
    if fmt == "jpeg":
        return ".jpg"
    return ".webp"