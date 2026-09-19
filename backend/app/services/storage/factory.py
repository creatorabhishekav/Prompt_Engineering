from app.core.config import get_settings
from app.services.errors import abort
from app.services.storage.base import StorageProvider
from app.services.storage.local import LocalStorageProvider

# Real providers are registered as they are implemented in later phases.
_registry: dict[str, type[StorageProvider]] = {
    "local": LocalStorageProvider,
}


def _register_provider(name: str, cls: type[StorageProvider]) -> None:
    _registry[name] = cls


def get_storage_provider() -> StorageProvider:
    settings = get_settings()
    name = (settings.STORAGE_PROVIDER or "local").lower()
    provider_cls = _registry.get(name)
    if provider_cls is None:
        abort(
            f"Unsupported STORAGE_PROVIDER '{name}'. Supported: {sorted(_registry)}.",
            501,
        )
    provider = provider_cls()
    if not getattr(provider, "is_configured", lambda: True)():
        abort(f"Storage provider '{name}' is not configured.", 501)
    return provider


def is_supabase_enabled() -> bool:
    return (get_settings().STORAGE_PROVIDER or "local").lower() == "supabase"