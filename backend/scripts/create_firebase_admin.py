import argparse
import sys
import logging
import firebase_admin
from firebase_admin import auth, credentials
from app.core.config import get_settings
from app.db.crud import FirestoreCRUD
from app.models.domain_enums import UserRole

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("create_firebase_admin")
settings = get_settings()

def create_admin(email: str, password: str | None = None):
    # Initialize Firebase Admin if needed
    if not firebase_admin._apps:
        if settings.FIREBASE_CREDENTIALS_PATH:
            cred = credentials.Certificate(settings.FIREBASE_CREDENTIALS_PATH)
            options = {}
            if settings.FIREBASE_PROJECT_ID:
                options["projectId"] = settings.FIREBASE_PROJECT_ID
            firebase_admin.initialize_app(cred, options)
        else:
            firebase_admin.initialize_app()

    # Find or create user in Firebase Auth
    try:
        fb_user = auth.get_user_by_email(email)
        logger.info(f"Found existing Firebase Auth user: {fb_user.uid} ({email})")
        if password:
            fb_user = auth.update_user(fb_user.uid, password=password)
            logger.info(f"Updated password for existing Firebase Auth user: {fb_user.uid}")
    except auth.UserNotFoundError:
        if not password:
            password = "ChangeMe-1234"
        fb_user = auth.create_user(
            email=email,
            password=password,
            display_name="Administrator",
            email_verified=True,
        )
        logger.info(f"Created new Firebase Auth user: {fb_user.uid} ({email})")

    # Set Firebase Custom Claims: admin = True
    auth.set_custom_user_claims(fb_user.uid, {"admin": True})
    logger.info(f"Assigned custom claim admin=True to UID: {fb_user.uid}")

    # Create / update Firestore users/{uid} document
    user_doc = {
        "uid": fb_user.uid,
        "email": email,
        "username": email.split("@")[0],
        "displayName": fb_user.display_name or "Administrator",
        "full_name": fb_user.display_name or "Administrator",
        "role": UserRole.ADMIN.value,
        "is_active": True,
    }
    FirestoreCRUD.save_user(user_doc)
    logger.info(f"Updated Firestore document users/{fb_user.uid} with role=ADMIN.")
    print(
        "Firebase Admin user provisioned successfully.\n"
        f"Email: {email}\n"
        f"UID: {fb_user.uid}\n"
        "Role: ADMIN\n"
        "Custom claim: admin=true\n"
    )

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Provision a Firebase Admin User")
    parser.add_argument("--email", required=True, help="Admin email address")
    parser.add_argument("--password", required=False, help="Password if creating or updating user")
    args = parser.parse_args()
    create_admin(args.email, args.password)
