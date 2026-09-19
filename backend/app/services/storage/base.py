from abc import ABC, abstractmethod


class StorageProvider(ABC):
    """Abstraction over where target images are persisted.

    Storage layers must not depend on FastAPI; they return a URL path that
    the app serves (e.g. "/media/rounds/<round_id>/<file>.png").
    """

    name: str = "base"

    @abstractmethod
    def save(self, *, data: bytes, folder: str, filename: str) -> str:
        """Persist ``data`` under ``folder`` and return the public URL path."""
        raise NotImplementedError

    def delete(self, path: str) -> None:
        """Best-effort removal of the resource identified by ``path``."""
        return None