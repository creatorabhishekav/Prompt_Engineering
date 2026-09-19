import os
from pathlib import Path
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.security import create_access_token, hash_password
from app.db.base import Base
from app.db.session import get_db
from app.main import app
from app.models.competition import Competition
from app.models.domain_enums import LifecycleStatus, UserRole
from app.models.round import Round
from app.models.target_image import TargetImage
from app.models.user import User

TEST_DB_FILE = Path(__file__).parent / "test_temp.db"
SQLALCHEMY_TEST_DATABASE_URL = f"sqlite:///{TEST_DB_FILE}"

engine = create_engine(
    SQLALCHEMY_TEST_DATABASE_URL, connect_args={"check_same_thread": False}
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(scope="function")
def db_session():
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()
        Base.metadata.drop_all(bind=engine)
        if TEST_DB_FILE.exists():
            try:
                TEST_DB_FILE.unlink(missing_ok=True)
            except Exception:
                pass


@pytest.fixture(scope="function")
def client(db_session):
    def _override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = _override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture
def participant_user(db_session):
    user = User(
        email="participant@example.com",
        username="player1",
        hashed_password=hash_password("password123"),
        full_name="Player One",
        role=UserRole.PARTICIPANT,
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture
def admin_user(db_session):
    user = User(
        email="admin@example.com",
        username="admin1",
        hashed_password=hash_password("admin123"),
        full_name="Admin One",
        role=UserRole.ADMIN,
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture
def participant_headers(participant_user):
    token = create_access_token(subject=participant_user.id, role=participant_user.role.value)
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def admin_headers(admin_user):
    token = create_access_token(subject=admin_user.id, role=admin_user.role.value)
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def active_round_with_target(db_session, admin_user):
    comp = Competition(
        title="Test Competition",
        slug="test-comp",
        status=LifecycleStatus.ACTIVE,
        created_by=admin_user.id,
    )
    db_session.add(comp)
    db_session.commit()
    db_session.refresh(comp)

    rnd = Round(
        competition_id=comp.id,
        round_number=1,
        title="Round 1",
        secret_prompt="cyberpunk neon city in the rain",
        time_limit_seconds=600,
        status=LifecycleStatus.ACTIVE,
    )
    db_session.add(rnd)
    db_session.commit()
    db_session.refresh(rnd)

    target_img = TargetImage(
        round_id=rnd.id,
        image_url="/media/rounds/target.png",
        created_by=admin_user.id,
    )
    db_session.add(target_img)
    db_session.commit()
    return rnd
