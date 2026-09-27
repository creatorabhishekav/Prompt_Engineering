from fastapi import HTTPException, status

class ApiError(Exception):
    def __init__(self, message: str, status_code: int = 400):
        self.message = message
        self.status_code = status_code
        super().__init__(message)

def abort(status_code: int, message: str):
    raise HTTPException(status_code=status_code, detail=message)
