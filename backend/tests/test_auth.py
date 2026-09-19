def test_register_and_login(client):
    # Register
    res = client.post(
        "/api/auth/register",
        json={
            "email": "newuser@example.com",
            "username": "newuser",
            "password": "Password123!",
            "full_name": "New User",
        },
    )
    assert res.status_code == 201
    data = res.json()
    assert data["status"] == "success"
    assert "access_token" in data["data"]
    assert data["data"]["user"]["username"] == "newuser"

    # Login
    login_res = client.post(
        "/api/auth/login",
        json={"email": "newuser@example.com", "password": "Password123!"},
    )
    assert login_res.status_code == 200
    assert "access_token" in login_res.json()["data"]


def test_auth_me_protected(client, participant_headers):
    res = client.get("/api/auth/me", headers=participant_headers)
    assert res.status_code == 200
    assert res.json()["data"]["username"] == "player1"


def test_admin_rbac_protection(client, participant_headers, admin_headers):
    # Participant should be rejected on admin route
    res = client.get("/api/admin/overview", headers=participant_headers)
    assert res.status_code == 403

    # Admin should succeed
    admin_res = client.get("/api/admin/overview", headers=admin_headers)
    assert admin_res.status_code == 200
