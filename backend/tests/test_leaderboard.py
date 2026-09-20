def test_leaderboard_ranking(
    client, participant_user, participant_headers, active_round_with_target
):
    user2_headers = {"Authorization": "Bearer participant-token-user2"}
    user2_doc = {
        "uid": "test-participant-user2",
        "email": "player_user2@example.com",
        "username": "player2",
        "full_name": "Player Two",
        "role": "PARTICIPANT",
        "is_active": True,
    }
    from app.db.crud import FirestoreCRUD
    FirestoreCRUD.save_user(user2_doc)

    rnd = active_round_with_target
    # Start and submit challenge
    start = client.post(f"/api/rounds/{rnd['id']}/start", headers=user2_headers)
    sub_id = start.json()["data"]["id"]

    client.put(
        f"/api/submissions/{sub_id}/prompt",
        json={"prompt": "cyberpunk neon city"},
        headers=user2_headers,
    )

    png_bytes = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15c4\x00\x00\x00\rIDATx\x9cc` \x05\x00\x00\x02\x00\x01H\xafA4\x00\x00\x00\x00IEND\xaeB`\x82"
    import io

    client.post(
        f"/api/submissions/{sub_id}/upload-image",
        files={"file": ("img.png", io.BytesIO(png_bytes), "image/png")},
        headers=user2_headers,
    )
    client.post(f"/api/submissions/{sub_id}/submit", headers=user2_headers)

    # Fetch leaderboard
    res = client.get("/api/leaderboard")
    assert res.status_code == 200
    entries = res.json()["data"]
    assert len(entries) >= 1
    assert entries[0]["username"] == "player2"
    assert entries[0]["total_score"] <= 80.0
