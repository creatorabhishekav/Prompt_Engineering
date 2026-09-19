from app.services.errors import abort
from app.services.storage.base import StorageProvider


class SupabaseStorageProvider(StorageProvider):
    """Placeholder for hosted uploads.

    A later phase will implement this against Supabase Storage with the
    service-role key kept server-side. Until then, selecting this provider
    fails fast with a clear message rather than silent misconfiguration.
    """

    name = "supabase"

    def save(self, *, data: bytes, folder: str, filename: str) -> str:
        abort("Supabase storage is not wired up yet. Use STORAGE_PROVIDER=local.", 501)

    def delete(self, path: str) -> None:
        return None