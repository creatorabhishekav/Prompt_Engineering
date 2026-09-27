import logging
import os
import firebase_admin
from firebase_admin import credentials, firestore
from app.core.config import get_settings

logger = logging.getLogger("app.db.firestore")
settings = get_settings()

_db = None

def get_firestore_db():
    global _db
    if _db is not None:
        return _db

    try:
        if not firebase_admin._apps:
            cred_path = settings.FIREBASE_CREDENTIALS_PATH or os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
            if cred_path and os.path.exists(cred_path):
                cred = credentials.Certificate(cred_path)
                firebase_admin.initialize_app(cred, {"projectId": settings.FIREBASE_PROJECT_ID})
                logger.info(f"Firebase Admin initialized with certificate for project {settings.FIREBASE_PROJECT_ID}")
            else:
                firebase_admin.initialize_app(options={"projectId": settings.FIREBASE_PROJECT_ID})
                logger.info(f"Firebase Admin initialized with project ID: {settings.FIREBASE_PROJECT_ID}")

        _db = firestore.client()
        logger.info("Firestore client connected successfully.")
    except Exception as e:
        logger.warning(f"Firestore initialization warning: {e}. In-memory fallback will handle database operations.")
        _db = None

    return _db
