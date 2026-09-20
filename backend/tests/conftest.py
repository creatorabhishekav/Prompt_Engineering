import os
from pathlib import Path
import pytest
from fastapi.testclient import TestClient

from app.core.security import create_access_token
from app.db.crud import FirestoreCRUD, _memory_db
from app.main import app
from app.models.domain_enums import LifecycleStatus, UserRole
from app.models.user import User

@pytest.fixture(scope="function", autouse=True)
def clean_memory_db(monkeypatch):
    import app.db.firestore
    import app.db.crud
    import app.core.deps
    import app.routes.competitions
    import app.routes.admin
    import app.routes.leaderboard
    
    app.db.firestore._firestore_db = None
    from app.core.config import get_settings
    s = get_settings()
    s.FIREBASE_CREDENTIALS_PATH = ""
    s.FIREBASE_CREDENTIALS_JSON = ""
    monkeypatch.setattr(app.db.firestore, "get_firestore_db", lambda: None)
    monkeypatch.setattr(app.db.crud, "get_firestore_db", lambda: None)
    monkeypatch.setattr(app.db.crud.FirestoreCRUD, "_is_live", lambda: False)
    
    for k in list(_memory_db.keys()):
        _memory_db[k].clear()
    yield
    app.db.firestore._firestore_db = None
    for k in list(_memory_db.keys()):
        _memory_db[k].clear()

@pytest.fixture(scope="function")
def db_session():
    # Return dummy object for tests
    return None

@pytest.fixture(scope="function")
def client():
    with TestClient(app) as c:
        yield c

@pytest.fixture
def participant_user():
    uid = "test-participant-123"
    user_doc = {
        "uid": uid,
        "email": "participant@example.com",
        "username": "player1",
        "full_name": "Player One",
        "role": UserRole.PARTICIPANT.value,
        "is_active": True,
    }
    FirestoreCRUD.save_user(user_doc)
    return User(
        id=uid,
        email="participant@example.com",
        username="player1",
        full_name="Player One",
        role=UserRole.PARTICIPANT,
        is_active=True,
    )

@pytest.fixture
def admin_user():
    uid = "test-admin-999"
    user_doc = {
        "uid": uid,
        "email": "admin@example.com",
        "username": "admin1",
        "full_name": "Admin One",
        "role": UserRole.ADMIN.value,
        "is_active": True,
    }
    FirestoreCRUD.save_user(user_doc)
    return User(
        id=uid,
        email="admin@example.com",
        username="admin1",
        full_name="Admin One",
        role=UserRole.ADMIN,
        is_active=True,
    )

@pytest.fixture(autouse=True)
def mock_firebase_verify_in_tests(monkeypatch):
    import firebase_admin.auth
    def _mock_verify(token, *args, **kwargs):
        if token.startswith("participant-token"):
            suffix = token.replace("participant-token", "").lstrip("-")
            uid = f"test-participant-{suffix}" if suffix else "test-participant-123"
            if token == "participant-token-user2":
                uid = "test-participant-user2"
                username = "player2"
                name = "Player Two"
            else:
                username = f"player_{suffix}" if suffix else "player1"
                name = username if suffix else "Player One"
            return {
                "uid": uid,
                "email": f"{username}@example.com",
                "name": name,
                "admin": False,
            }
        elif token == "admin-token":
            return {
                "uid": "test-admin-999",
                "email": "admin@example.com",
                "name": "Admin One",
                "admin": True,
            }
        raise ValueError("Invalid Firebase Token in test")
    monkeypatch.setattr(firebase_admin.auth, "verify_id_token", _mock_verify)

@pytest.fixture
def participant_headers(participant_user):
    return {"Authorization": "Bearer participant-token"}

@pytest.fixture
def admin_headers(admin_user):
    return {"Authorization": "Bearer admin-token"}

@pytest.fixture
def active_round_with_target(admin_user):
    comp = FirestoreCRUD.create_competition({
        "id": "comp-123",
        "title": "Test Competition",
        "slug": "test-comp",
        "status": LifecycleStatus.ACTIVE.value,
        "created_by": admin_user.id,
    })

    rnd = FirestoreCRUD.create_round({
        "id": "round-123",
        "competition_id": comp["id"],
        "round_number": 1,
        "title": "Round 1",
        "secret_prompt": "cyberpunk neon city in the rain",
        "time_limit_seconds": 600,
        "status": LifecycleStatus.ACTIVE.value,
    })

    FirestoreCRUD.create_target_image({
        "id": "target-img-123",
        "round_id": rnd["id"],
        "image_url": "/media/rounds/target.png",
        "created_by": admin_user.id,
    })
    return rnd
