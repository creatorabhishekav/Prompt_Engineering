import io
import pytest
from app.db.crud import FirestoreCRUD

def test_submission_privacy_and_access_control(
    client, participant_headers, admin_headers, active_round_with_target
):
    user1_headers = {"Authorization": "Bearer participant-token-user1"}
    user2_headers = {"Authorization": "Bearer participant-token-user2"}

    rnd = active_round_with_target

    # 1. User 1 creates submission
    start1 = client.post(f"/api/rounds/{rnd['id']}/start", headers=user1_headers)
    assert start1.status_code == 200
    sub1_id = start1.json()["data"]["id"]

    # 2. User 2 creates submission
    start2 = client.post(f"/api/rounds/{rnd['id']}/start", headers=user2_headers)
    assert start2.status_code == 200
    sub2_id = start2.json()["data"]["id"]

    # 3. User 1 calls GET /api/results/me -> sees only User 1 submission
    res1 = client.get("/api/results/me", headers=user1_headers)
    assert res1.status_code == 200
    u1_items = res1.json()["data"]
    assert len(u1_items) == 1
    assert u1_items[0]["submission_id"] == sub1_id

    # 4. User 1 tries to access User 2 submission result -> 403 Forbidden
    u1_access_u2 = client.get(f"/api/submissions/{sub2_id}/result", headers=user1_headers)
    assert u1_access_u2.status_code == 403

    # 5. User 1 tries to access admin submissions endpoint -> 403 Forbidden
    u1_admin_subs = client.get(f"/api/admin/rounds/{rnd['id']}/submissions", headers=user1_headers)
    assert u1_admin_subs.status_code == 403

    # 6. User 1 tries to delete User 2 submission -> 403 Forbidden
    u1_del_u2 = client.delete(f"/api/admin/submissions/{sub2_id}", headers=user1_headers)
    assert u1_del_u2.status_code == 403

    # 7. Admin calls GET /api/admin/rounds/{round_id}/submissions -> sees both submissions
    admin_subs = client.get(f"/api/admin/rounds/{rnd['id']}/submissions", headers=admin_headers)
    assert admin_subs.status_code == 200
    admin_items = admin_subs.json()["data"]
    assert len(admin_items) == 2
    sub_ids = {s["id"] for s in admin_items}
    assert sub1_id in sub_ids and sub2_id in sub_ids

    # 8. User 1 completes staged evaluation (Prompt 1, Stage 1 Image, Prompt 2, Stage 2 Image, Submit)
    png_bytes = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15c4\x00\x00\x00\rIDATx\x9cc` \x05\x00\x00\x02\x00\x01H\xafA4\x00\x00\x00\x00IEND\xaeB`\x82"
    client.post(f"/api/submissions/{sub1_id}/prompt-1", json={"prompt": "cyberpunk city"}, headers=user1_headers)
    client.post(f"/api/submissions/{sub1_id}/upload-first-image", files={"file": ("img1.png", io.BytesIO(png_bytes), "image/png")}, headers=user1_headers)
    client.post(f"/api/submissions/{sub1_id}/prompt-2", json={"prompt": "add neon rain"}, headers=user1_headers)
    client.post(f"/api/submissions/{sub1_id}/upload-final-image", files={"file": ("img2.png", io.BytesIO(png_bytes), "image/png")}, headers=user1_headers)
    client.post(f"/api/submissions/{sub1_id}/submit", headers=user1_headers)

    # Verify score records exist before delete
    scores_before = [s for s in FirestoreCRUD.list_scores() if s.get("submission_id") == sub1_id]
    assert len(scores_before) >= 1

    # 9. Admin deletes User 1 submission
    del_res = client.delete(f"/api/admin/submissions/{sub1_id}", headers=admin_headers)
    assert del_res.status_code == 200

    # 10. Verify User 1 submission no longer appears in User 1 results
    res1_after = client.get("/api/results/me", headers=user1_headers)
    assert res1_after.status_code == 200
    assert len(res1_after.json()["data"]) == 0

    # 11. Verify User 1 submission no longer appears in Admin list
    admin_subs_after = client.get(f"/api/admin/rounds/{rnd['id']}/submissions", headers=admin_headers)
    assert admin_subs_after.status_code == 200
    remaining_ids = {s["id"] for s in admin_subs_after.json()["data"]}
    assert sub1_id not in remaining_ids
    assert sub2_id in remaining_ids

    # 12. Verify score records for sub1_id are completely removed
    scores_after = [s for s in FirestoreCRUD.list_scores() if s.get("submission_id") == sub1_id]
    assert len(scores_after) == 0

    # 13. Verify target round image is NOT deleted
    target_img = FirestoreCRUD.get_target_image_by_round(rnd["id"])
    assert target_img is not None
    assert target_img.get("image_url") == "/media/rounds/target.png"
