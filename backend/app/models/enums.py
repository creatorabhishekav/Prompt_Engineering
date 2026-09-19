from sqlalchemy import Enum as SAEnum
from sqlalchemy.types import Enum as SAEnumType


def str_enum(enum_cls, name: str) -> SAEnumType:
    """Return a portable SQLAlchemy Enum storing member *values* as strings."""
    return SAEnum(
        enum_cls,
        name=name,
        values_callable=lambda e: [m.value for m in e],
        native_enum=False,
        validate_strings=True,
        inherit_schema=True,
    )