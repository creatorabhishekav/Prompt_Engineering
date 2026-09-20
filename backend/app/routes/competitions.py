from datetime import datetime
from fastapi import APIRouter, File, UploadFile
from typing import Optional

from app.core.deps import CurrentUser
from app.db.crud import FirestoreCRUD
from app.models.domain_enums import LifecycleStatus, SubmissionStatus, ScoringStatus
from app.schemas.challenge import (
    ActiveCompetitionRead,
    ActiveRoundRead,
    ChallengeStatusRead,
)
from app.schemas.common import ApiResponse
from app.schemas.submission import SubmissionUpdate
from app.services.errors import abort
from app.services.evaluator import evaluate_submission
from app.services.storage.factory import get_storage_provider

router = APIRouter(tags=["challenge"])

@router.get("/competitions/active", response_model=ApiResponse[list[ActiveCompetitionRead]])
def active_competitions(_: CurrentUser):
    comps = FirestoreCRUD.list_competitions()
    active_comps = [c for c in comps if c.get("status") in (LifecycleStatus.ACTIVE.value, LifecycleStatus.PAUSED.value)]
    payload = []
    for c in active_comps:
        rounds = FirestoreCRUD.list_rounds_for_competition(c["id"])
        open_rounds = [r for r in rounds if r.get("status") in (LifecycleStatus.ACTIVE.value, LifecycleStatus.PAUSED.value)]
        payload.append(
            ActiveCompetitionRead(
                id=c["id"],
                title=c["title"],
                description=c.get("description"),
                status=c["status"],
                round_count=len(rounds),
                open_round_count=len(open_rounds),
            )
        )
    return ApiResponse(data=payload, message="OK")

@router.get("/rounds/active", response_model=ApiResponse[list[ActiveRoundRead]])
def active_rounds(_: CurrentUser):
    all_rounds = FirestoreCRUD.list_all_rounds()
    active_rnds = [r for r in all_rounds if r.get("status") in (LifecycleStatus.ACTIVE.value, LifecycleStatus.PAUSED.value)]
    payload = []
    for r in active_rnds:
        comp = FirestoreCRUD.get_competition(r["competition_id"]) or {}
        ti = FirestoreCRUD.get_target_image_by_round(r["id"]) or {}
        payload.append(
            ActiveRoundRead(
                id=r["id"],
                competition_id=r["competition_id"],
                competition_title=comp.get("title", ""),
                round_number=r.get("round_number", 1),
                title=r["title"],
                description=r.get("description"),
                time_limit_seconds=r.get("time_limit_seconds", 600),
                status=r["status"],
                server_elapsed_seconds=0,
                target_image_url=ti.get("image_url"),
            )
        )
    return ApiResponse(data=payload, message="OK")

@router.post("/rounds/{round_id}/start", response_model=ApiResponse[ChallengeStatusRead])
def start_round_challenge(round_id: str, user: CurrentUser):
    rnd = FirestoreCRUD.get_round(round_id)
    if not rnd:
        return ApiResponse(data=None, message="Round not found.")
    
    comp = FirestoreCRUD.get_competition(rnd["competition_id"]) or {}
    ti = FirestoreCRUD.get_target_image_by_round(round_id) or {}
    
    sub = FirestoreCRUD.get_submission_by_round_and_user(round_id, user.id)
    if not sub:
        sub = FirestoreCRUD.create_submission({
            "user_id": user.id,
            "round_id": round_id,
            "target_image_id": ti.get("id"),
            "prompt_used": "",
            "status": SubmissionStatus.IN_PROGRESS.value,
            "started_at_elapsed": 0,
        })
    
    sc = FirestoreCRUD.get_score_by_submission(sub["id"]) or {}
    return ApiResponse(
        data=ChallengeStatusRead(
            id=sub["id"],
            round_id=round_id,
            round_title=rnd["title"],
            competition_title=comp.get("title", ""),
            time_limit_seconds=rnd.get("time_limit_seconds", 600),
            round_status=rnd["status"],
            target_image_url=ti.get("image_url"),
            uploaded_image_url=sub.get("image_url"),
            status=sub["status"],
            prompt=sub.get("prompt_used", ""),
            started_at_elapsed=sub.get("started_at_elapsed", 0),
            remaining_seconds=rnd.get("time_limit_seconds", 600),
            deadline_elapsed=sub.get("deadline_elapsed"),
            submitted_at=sub.get("submitted_at"),
            scoring_status=sc.get("status"),
            total_score=sc.get("total_score"),
        ),
        message="Challenge started."
    )

@router.get("/rounds/{round_id}/status", response_model=ApiResponse[ChallengeStatusRead])
def round_challenge_status(round_id: str, user: CurrentUser):
    return start_round_challenge(round_id, user)

@router.put("/submissions/{submission_id}/prompt", response_model=ApiResponse[ChallengeStatusRead])
def save_prompt(submission_id: str, payload: SubmissionUpdate, user: CurrentUser):
    sub = FirestoreCRUD.get_submission(submission_id)
    if not sub or sub.get("user_id") != user.id:
        return ApiResponse(data=None, message="Submission not found.")
    updated = FirestoreCRUD.update_submission(submission_id, {"prompt_used": payload.prompt})
    rnd = FirestoreCRUD.get_round(updated["round_id"]) or {}
    comp = FirestoreCRUD.get_competition(rnd.get("competition_id")) or {}
    ti = FirestoreCRUD.get_target_image_by_round(rnd.get("id")) or {}
    sc = FirestoreCRUD.get_score_by_submission(submission_id) or {}
    
    return ApiResponse(
        data=ChallengeStatusRead(
            id=updated["id"],
            round_id=rnd.get("id", ""),
            round_title=rnd.get("title", ""),
            competition_title=comp.get("title", ""),
            time_limit_seconds=rnd.get("time_limit_seconds", 600),
            round_status=rnd.get("status", "active"),
            target_image_url=ti.get("image_url"),
            uploaded_image_url=updated.get("image_url"),
            status=updated.get("status", "in_progress"),
            prompt=updated.get("prompt_used", ""),
            remaining_seconds=rnd.get("time_limit_seconds", 600),
            scoring_status=sc.get("status"),
            total_score=sc.get("total_score"),
        ),
        message="Prompt saved."
    )

@router.post("/submissions/{submission_id}/upload-image", response_model=ApiResponse[ChallengeStatusRead])
def upload_participant_generated_image(submission_id: str, user: CurrentUser, file: UploadFile = File(...)):
    sub = FirestoreCRUD.get_submission(submission_id)
    if not sub or sub.get("user_id") != user.id:
        return ApiResponse(data=None, message="Submission not found.")
    data = file.file.read()
    storage = get_storage_provider()
    relative_url = storage.save(
        data=data,
        folder=f"submissions/{submission_id}",
        filename=file.filename or "generated.png",
    )
    updated = FirestoreCRUD.update_submission(submission_id, {"image_url": relative_url})
    rnd = FirestoreCRUD.get_round(updated["round_id"]) or {}
    comp = FirestoreCRUD.get_competition(rnd.get("competition_id")) or {}
    ti = FirestoreCRUD.get_target_image_by_round(rnd.get("id")) or {}
    sc = FirestoreCRUD.get_score_by_submission(submission_id) or {}

    return ApiResponse(
        data=ChallengeStatusRead(
            id=updated["id"],
            round_id=rnd.get("id", ""),
            round_title=rnd.get("title", ""),
            competition_title=comp.get("title", ""),
            time_limit_seconds=rnd.get("time_limit_seconds", 600),
            round_status=rnd.get("status", "active"),
            target_image_url=ti.get("image_url"),
            uploaded_image_url=updated.get("image_url"),
            status=updated.get("status", "in_progress"),
            prompt=updated.get("prompt_used", ""),
            remaining_seconds=rnd.get("time_limit_seconds", 600),
            scoring_status=sc.get("status"),
            total_score=sc.get("total_score"),
        ),
        message="Generated image uploaded successfully."
    )

@router.post("/submissions/{submission_id}/submit", response_model=ApiResponse[ChallengeStatusRead])
def submit_challenge(submission_id: str, user: CurrentUser):
    sub = FirestoreCRUD.get_submission(submission_id)
    if not sub or sub.get("user_id") != user.id:
        abort("Submission not found.", 404)
    if sub.get("status") in (SubmissionStatus.SUBMITTED.value, SubmissionStatus.SCORED.value):
        abort("You have already submitted for this round.", 409)
    if not sub.get("prompt_used") or len(sub.get("prompt_used", "").strip()) == 0:
        abort("Write a prompt before submitting.", 400)
    if not sub.get("image_url"):
        abort("Upload your generated image before submitting.", 400)

    rnd = FirestoreCRUD.get_round(sub["round_id"]) or {}
    ti = FirestoreCRUD.get_target_image_by_round(sub["round_id"]) or {}
    
    target_img_url = ti.get("image_url")
    uploaded_img_url = sub.get("image_url")

    res = evaluate_submission(
        target_image_path=target_img_url,
        uploaded_image_path=uploaded_img_url,
        participant_prompt=sub.get("prompt_used", ""),
        reference_prompt=rnd.get("secret_prompt", ""),
    )

    sc = FirestoreCRUD.create_score({
        "submission_id": submission_id,
        "round_id": sub["round_id"],
        "user_id": user.id,
        "semantic_score": res.semantic_score,
        "composition_score": res.composition_score,
        "objects_score": res.objects_score,
        "color_score": res.color_score,
        "details_score": res.details_score,
        "total_score": res.total_score,
        "clip_similarity": res.clip_similarity,
        "evaluation_method": res.evaluation_method,
        "status": ScoringStatus.SCORED.value,
    })

    updated = FirestoreCRUD.update_submission(submission_id, {
        "status": SubmissionStatus.SCORED.value,
        "submitted_at": datetime.utcnow().isoformat(),
    })
    comp = FirestoreCRUD.get_competition(rnd.get("competition_id")) or {}
    ti = FirestoreCRUD.get_target_image_by_round(rnd.get("id")) or {}

    return ApiResponse(
        data=ChallengeStatusRead(
            id=updated["id"],
            round_id=rnd.get("id", ""),
            round_title=rnd.get("title", ""),
            competition_title=comp.get("title", ""),
            time_limit_seconds=rnd.get("time_limit_seconds", 600),
            round_status=rnd.get("status", "active"),
            target_image_url=ti.get("image_url"),
            uploaded_image_url=updated.get("image_url"),
            status=updated.get("status", "scored"),
            prompt=updated.get("prompt_used", ""),
            remaining_seconds=0,
            submitted_at=updated.get("submitted_at"),
            scoring_status=sc["status"],
            total_score=sc["total_score"],
        ),
        message="Submission received and evaluated."
    )