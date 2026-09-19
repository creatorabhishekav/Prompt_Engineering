from datetime import datetime


def utcnow() -> datetime:
    """Return the current time as naive UTC.

    SQLite stores datetimes without timezone info, so the rest of the app
    deliberately works with naive-UTC timestamps to avoid aware/naive
    comparison errors. Use this helper everywhere we stamp wall-clock time.
    """
    return datetime.utcnow()