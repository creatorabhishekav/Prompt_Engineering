from app.core.security import create_access_token
from app.db.crud import FirestoreCRUD
from app.models.domain_enums import UserRole

def test_firebase_token_verification_and_user_sync(client, monkeypatch):
    # Mock firebase_admin.auth.verify_id_token
    def mock_verify_id_token(token):
        if token == "valid-google-token":
            return {
                "uid": "google-uid-100",
                "email": "googleuser@example.com",
                "name": "Google User",
                "admin": False,
            }
        elif token == "valid-admin-token":
            return {
                "uid": "admin-uid-999",
                "email": "admin@example.com",
                "name": "Admin User",
                "admin": True,
            }
        raise ValueError("Invalid Firebase Token")

    import firebase_admin.auth
    monkeypatch.setattr(firebase_admin.auth, "verify_id_token", mock_verify_id_token)

    # 1. Google Participant Auth token verification
    res = client.get("/api/auth/me", headers={"Authorization": "Bearer valid-google-token"})
    assert res.status_code == 200
    data = res.json()["data"]
    assert data["id"] == "google-uid-100"
    assert data["role"] == "PARTICIPANT"

    # Verify Firestore user doc was created with PARTICIPANT role
    u_doc = FirestoreCRUD.get_user("google-uid-100")
    assert u_doc is not None
    assert u_doc["role"] == "PARTICIPANT"

    # 2. Admin Auth token verification
    res_admin = client.get("/api/auth/me", headers={"Authorization": "Bearer valid-admin-token"})
    assert res_admin.status_code == 200
    data_admin = res_admin.json()["data"]
    assert data_admin["role"] == "ADMIN"

def test_auth_me_protected(client, participant_headers):
    res = client.get("/api/auth/me", headers=participant_headers)
    assert res.status_code == 200
    assert res.json()["data"]["username"] == "player1"

def test_admin_rbac_protection(client, participant_headers, admin_headers):
    # Participant should receive HTTP 403 on admin route
    res = client.get("/api/admin/overview", headers=participant_headers)
    assert res.status_code == 403

    # Admin should succeed
    admin_res = client.get("/api/admin/overview", headers=admin_headers)
    assert admin_res.status_code == 200
