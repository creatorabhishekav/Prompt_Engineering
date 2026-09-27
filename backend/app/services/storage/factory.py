from app.core.config import get_settings
from app.services.storage.local import LocalStorageProvider
from app.services.storage.base import StorageProvider

_provider = None

def get_storage_provider() -> StorageProvider:
    global _provider
    if _provider is None:
        settings = get_settings()
        _provider = LocalStorageProvider(settings.MEDIA_ROOT)
    return _provider
