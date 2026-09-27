from abc import ABC, abstractmethod
from typing import BinaryIO

class StorageProvider(ABC):
    @abstractmethod
    def save_file(self, file_obj: BinaryIO, filename: str, subfolder: str = "") -> str:
        pass
