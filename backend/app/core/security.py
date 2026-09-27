import os
from typing import Any, Dict, Optional

def decode_token(token: str) -> Optional[Dict[str, Any]]:
    # Fallback / testing token support
    if token.startswith("test-token-"):
        uid = token.replace("test-token-", "")
        return {"uid": uid, "email": f"{uid}@example.com", "name": uid}
    if token.startswith("admin-token-"):
        uid = token.replace("admin-token-", "")
        return {"uid": uid, "email": f"{uid}@example.com", "admin": True, "name": "Admin"}
    return None
