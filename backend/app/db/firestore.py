import os
import json
import logging
import firebase_admin
from firebase_admin import credentials, firestore
from app.core.config import get_settings

logger = logging.getLogger("app.db.firestore")
settings = get_settings()

_firestore_db = None

def get_firestore_db():
    global _firestore_db
    if _firestore_db is not None:
        return _firestore_db

    # In local development / test without Google Application Default Credentials, return None early
    if not settings.FIREBASE_CREDENTIALS_JSON and not (settings.FIREBASE_CREDENTIALS_PATH and os.path.exists(settings.FIREBASE_CREDENTIALS_PATH)):
        _firestore_db = None
        return None

    if not firebase_admin._apps:
        cred = None
        if settings.FIREBASE_CREDENTIALS_JSON:
            try:
                cred_dict = json.loads(settings.FIREBASE_CREDENTIALS_JSON)
                cred = credentials.Certificate(cred_dict)
            except Exception as e:
                logger.error(f"Failed to parse FIREBASE_CREDENTIALS_JSON: {e}")
        elif settings.FIREBASE_CREDENTIALS_PATH and os.path.exists(settings.FIREBASE_CREDENTIALS_PATH):
            try:
                cred = credentials.Certificate(settings.FIREBASE_CREDENTIALS_PATH)
            except Exception as e:
                logger.error(f"Failed to load FIREBASE_CREDENTIALS_PATH: {e}")
        
        options = {}
        if settings.FIREBASE_PROJECT_ID:
            options["projectId"] = settings.FIREBASE_PROJECT_ID

        if cred:
            firebase_admin.initialize_app(cred, options)
        else:
            return None

    try:
        _firestore_db = firestore.client()
    except Exception as e:
        logger.warning(f"Could not connect to live Firestore: {e}")
        _firestore_db = None

    return _firestore_db
