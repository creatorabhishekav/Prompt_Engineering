import os
import shutil
from pathlib import Path
from typing import BinaryIO
from app.core.config import get_settings
from app.services.storage.base import StorageProvider

settings = get_settings()

class LocalStorageProvider(StorageProvider):
    def __init__(self, media_root: str):
        self.media_root = Path(media_root)
        self.media_root.mkdir(parents=True, exist_ok=True)

    def save_file(self, file_obj: BinaryIO, filename: str, subfolder: str = "") -> str:
        target_dir = self.media_root / subfolder if subfolder else self.media_root
        target_dir.mkdir(parents=True, exist_ok=True)
        dest_path = target_dir / filename
        with open(dest_path, "wb") as buffer:
            shutil.copyfileobj(file_obj, buffer)
        
        rel_path = f"/{subfolder}/{filename}" if subfolder else f"/{filename}"
        return f"/media{rel_path}"
