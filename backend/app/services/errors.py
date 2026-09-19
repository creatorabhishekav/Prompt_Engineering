from fastapi import HTTPException, status


class ApiError(Exception):
    """Domain error with an HTTP status code.

    Services raise this and route handlers convert it to an HTTPException so
    the standard FastAPI error envelope ({"detail": <message>}) is preserved.
    """

    def __init__(self, message: str, status_code: int = status.HTTP_400_BAD_REQUEST):
        self.message = message
        self.status_code = status_code
        super().__init__(message)


def abort(message: str, status_code: int = status.HTTP_400_BAD_REQUEST) -> None:
    raise ApiError(message, status_code)


def to_http_error(exc: ApiError) -> HTTPException:
    return HTTPException(status_code=exc.status_code, detail=exc.message)