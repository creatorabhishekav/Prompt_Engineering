import io


def test_challenge_full_flow_and_locking(
    client, participant_headers, active_round_with_target
):
    flow_headers = {"Authorization": "Bearer participant-token-flow"}
    rnd = active_round_with_target

    # 1. Start challenge
    start_res = client.post(
        f"/api/rounds/{rnd['id']}/start", headers=flow_headers
    )
    assert start_res.status_code == 200
    sub_data = start_res.json()["data"]
    sub_id = sub_data["id"]
    assert sub_data["status"] == "in_progress"

    # 2. Save prompt
    save_res = client.put(
        f"/api/submissions/{sub_id}/prompt",
        json={"prompt": "cyberpunk neon city in the rain"},
        headers=flow_headers,
    )
    assert save_res.status_code == 200
    assert save_res.json()["data"]["prompt"] == "cyberpunk neon city in the rain"

    # 3. Submit without image should fail
    fail_submit = client.post(
        f"/api/submissions/{sub_id}/submit", headers=flow_headers
    )
    assert fail_submit.status_code == 400 or fail_submit.status_code == 409

    # 4. Upload generated image
    png_bytes = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15c4\x00\x00\x00\rIDATx\x9cc` \x05\x00\x00\x02\x00\x01H\xafA4\x00\x00\x00\x00IEND\xaeB`\x82"
    file_payload = {"file": ("test_generated.png", io.BytesIO(png_bytes), "image/png")}
    upload_res = client.post(
        f"/api/submissions/{sub_id}/upload-image",
        files=file_payload,
        headers=flow_headers,
    )
    assert upload_res.status_code == 200
    assert upload_res.json()["data"]["uploaded_image_url"] is not None

    # 5. Final Submit
    submit_res = client.post(
        f"/api/submissions/{sub_id}/submit", headers=flow_headers
    )
    assert submit_res.status_code == 200
    final_data = submit_res.json()["data"]
    assert final_data["status"] == "scored" or final_data["status"] == "submitted"
    assert final_data["total_score"] is not None
    assert final_data["total_score"] <= 80.0

    # 6. Double submit should be rejected
    double_res = client.post(
        f"/api/submissions/{sub_id}/submit", headers=flow_headers
    )
    assert double_res.status_code == 409


def test_invalid_file_upload_rejected(
    client, participant_headers, active_round_with_target
):
    upload_headers = {"Authorization": "Bearer participant-token-upload-test"}
    rnd = active_round_with_target
    start_res = client.post(
        f"/api/rounds/{rnd['id']}/start", headers=upload_headers
    )
    sub_id = start_res.json()["data"]["id"]

    # Upload invalid text file disguised as PNG
    file_payload = {
        "file": ("fake.png", io.BytesIO(b"this is not an image file"), "image/png")
    }
    res = client.post(
        f"/api/submissions/{sub_id}/upload-image",
        files=file_payload,
        headers=upload_headers,
    )
    assert res.status_code == 400


def test_admin_delete_submission_full_flow(
    client, participant_headers, admin_headers, active_round_with_target
):
    flow_headers = {"Authorization": "Bearer participant-token-delete-test"}
    rnd = active_round_with_target

    # 1. Participant starts challenge and uploads image
    start_res = client.post(f"/api/rounds/{rnd['id']}/start", headers=flow_headers)
    sub_id = start_res.json()["data"]["id"]

    png_bytes = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15c4\x00\x00\x00\rIDATx\x9cc` \x05\x00\x00\x02\x00\x01H\xafA4\x00\x00\x00\x00IEND\xaeB`\x82"
    client.put(f"/api/submissions/{sub_id}/prompt", json={"prompt": "test prompt"}, headers=flow_headers)
    client.post(f"/api/submissions/{sub_id}/upload-image", files={"file": ("test.png", io.BytesIO(png_bytes), "image/png")}, headers=flow_headers)
    client.post(f"/api/submissions/{sub_id}/submit", headers=flow_headers)

    # 2. Participant attempts to delete submission -> 403 Forbidden
    part_del_res = client.delete(f"/api/admin/submissions/{sub_id}", headers=participant_headers)
    assert part_del_res.status_code == 403

    # 3. Admin deletes submission -> 200 OK
    admin_del_res = client.delete(f"/api/admin/submissions/{sub_id}", headers=admin_headers)
    assert admin_del_res.status_code == 200
    assert admin_del_res.json()["data"]["id"] == sub_id

    # 4. Deleting non-existing submission -> 404 Not Found
    del_404_res = client.delete(f"/api/admin/submissions/{sub_id}", headers=admin_headers)
    assert del_404_res.status_code == 404

    # 5. Verify round, competition, and target image remain intact
    round_res = client.get(f"/api/admin/competitions/{rnd['competition_id']}/rounds", headers=admin_headers)
    assert round_res.status_code == 200
    assert len(round_res.json()["data"]) == 1

