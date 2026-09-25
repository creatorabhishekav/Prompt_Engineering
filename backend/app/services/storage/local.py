from pathlib import Path

from app.core.config import get_settings
from app.models.uuid import new_uuid
from app.services.errors import abort
from app.services.storage.base import StorageProvider
from app.services.storage.validate import extension_for, validate_image_file

settings = get_settings()


class LocalStorageProvider(StorageProvider):
    """Persist uploads on the local filesystem under MEDIA_ROOT.

    Files are served by the FastAPI StaticFiles mount at /media and proxied
    by Vite during development.
    """

    name = "local"

    def __init__(self, root: str | None = None):
        self.root = Path(root or settings.MEDIA_ROOT)

    def save(self, *, data: bytes, folder: str, filename: str, max_bytes: int | None = None) -> str:
        limit = max_bytes if max_bytes is not None else settings.max_upload_bytes
        validate_image_file(data, max_bytes=limit)

        safe_folder = Path(folder)
        if not safe_folder.is_relative_to(Path("")) or ".." in safe_folder.parts:
            abort("Invalid storage folder.")

        dest_dir = self.root / safe_folder
        dest_dir.mkdir(parents=True, exist_ok=True)

        unique = new_uuid()
        destination = dest_dir / f"{unique}{extension_for(data)}"
        destination.write_bytes(data)
        relative = destination.relative_to(self.root)
        return f"/media/{relative.as_posix()}"

    def delete(self, path: str) -> None:
        if not path.startswith("/media/"):
            return
        candidate = (self.root / path[len("/media/") :]).resolve()
        if candidate.is_relative_to(self.root.resolve()) and candidate.exists():
            candidate.unlink(missing_ok=True)