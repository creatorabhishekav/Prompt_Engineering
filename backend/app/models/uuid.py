import uuid
from typing import Any

from sqlalchemy import CHAR, Dialect
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.types import TypeDecorator


class GUID(TypeDecorator):
    """Platform-independent UUID type.

    Uses native PostgreSQL UUID when available and CHAR(36) elsewhere
    (e.g. SQLite for local development), storing the standard string form.
    """

    impl = CHAR
    cache_ok = True

    def load_dialect_impl(self, dialect: Dialect) -> Any:
        if dialect.name == "postgresql":
            return dialect.type_descriptor(PG_UUID(as_uuid=True))
        return dialect.type_descriptor(CHAR(36))

    def process_bind_param(self, value: Any, dialect: Dialect) -> Any:
        if value is None:
            return value
        if dialect.name == "postgresql":
            return value if isinstance(value, uuid.UUID) else uuid.UUID(str(value))
        return str(value)

    def process_result_value(self, value: Any, dialect: Dialect) -> Any:
        if value is None or dialect.name == "postgresql":
            return value
        return str(value)


def new_uuid() -> str:
    return str(uuid.uuid4())