"""One-off script to create an admin user.

Usage:
    python -m scripts.create_admin --email admin@example.com --username admin --password <secret>
"""
import argparse
import sys

from app.db.session import SessionLocal
from app.models.domain_enums import UserRole
from app.services.auth_service import register_user

sys.path.insert(0, ".")


def main() -> None:
    parser = argparse.ArgumentParser(description="Create an admin user.")
    parser.add_argument("--email", required=True)
    parser.add_argument("--username", required=True)
    parser.add_argument("--password", required=True)
    parser.add_argument("--full-name", default="Administrator")
    args = parser.parse_args()

    db = SessionLocal()
    try:
        user = register_user(
            db,
            email=args.email,
            username=args.username,
            password=args.password,
            full_name=args.full_name,
            role=UserRole.ADMIN,
        )
        print(f"Admin created: {user.username} <{user.email}> role={user.role.value}")
    except Exception as exc:  # noqa: BLE001
        print(f"Failed: {exc}")
        raise SystemExit(1) from exc
    finally:
        db.close()


if __name__ == "__main__":
    main()