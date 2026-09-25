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

def _build_challenge_status_read(sub: dict, rnd: dict, comp: dict, ti: dict) -> ChallengeStatusRead:
    final_sc = FirestoreCRUD.get_score_by_submission_and_stage(sub["id"], "FINAL") or FirestoreCRUD.get_score_by_submission(sub["id"]) or {}
    first_sc = FirestoreCRUD.get_score_by_submission_and_stage(sub["id"], "FIRST") or {}

    first_breakdown = {
        "semantic_score": first_sc.get("semantic_score", 0.0),
        "composition_score": first_sc.get("composition_score", 0.0),
        "objects_score": first_sc.get("objects_score", 0.0),
        "color_score": first_sc.get("color_score", 0.0),
        "details_score": first_sc.get("details_score", 0.0),
        "total_score": first_sc.get("total_score", 0.0),
    } if first_sc.get("total_score") is not None else None

    final_breakdown = {
        "semantic_score": final_sc.get("semantic_score", 0.0),
        "composition_score": final_sc.get("composition_score", 0.0),
        "objects_score": final_sc.get("objects_score", 0.0),
        "color_score": final_sc.get("color_score", 0.0),
        "details_score": final_sc.get("details_score", 0.0),
        "total_score": final_sc.get("total_score", 0.0),
    } if final_sc.get("total_score") is not None else None

    return ChallengeStatusRead(
        id=sub["id"],
        round_id=rnd.get("id", ""),
        round_title=rnd.get("title", ""),
        competition_title=comp.get("title", ""),
        time_limit_seconds=rnd.get("time_limit_seconds", 600),
        round_status=rnd.get("status", "active"),
        target_image_url=ti.get("image_url"),
        uploaded_image_url=sub.get("final_image_url") or sub.get("image_url"),
        first_image_url=sub.get("first_image_url"),
        final_image_url=sub.get("final_image_url") or sub.get("image_url"),
        status=sub.get("status", "in_progress"),
        prompt=sub.get("prompt_used", ""),
        prompt_1=sub.get("prompt_1") or sub.get("prompt_used", ""),
        prompt_2=sub.get("prompt_2", ""),
        started_at_elapsed=sub.get("started_at_elapsed", 0),
        remaining_seconds=rnd.get("time_limit_seconds", 600) if sub.get("status") == "in_progress" else 0,
        deadline_elapsed=sub.get("deadline_elapsed"),
        submitted_at=sub.get("submitted_at"),
        scoring_status=final_sc.get("status"),
        total_score=final_sc.get("total_score"),
        first_scoring_status=first_sc.get("status"),
        first_score=first_sc.get("total_score"),
        first_score_breakdown=first_breakdown,
        final_score=final_sc.get("total_score"),
        final_score_breakdown=final_breakdown,
    )

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
            "prompt_1": "",
            "prompt_2": "",
            "status": SubmissionStatus.IN_PROGRESS.value,
            "started_at_elapsed": 0,
        })
    
    return ApiResponse(data=_build_challenge_status_read(sub, rnd, comp, ti), message="Challenge started.")

@router.get("/rounds/{round_id}/status", response_model=ApiResponse[ChallengeStatusRead])
def round_challenge_status(round_id: str, user: CurrentUser):
    return start_round_challenge(round_id, user)

@router.put("/submissions/{submission_id}/prompt", response_model=ApiResponse[ChallengeStatusRead])
def save_prompt(submission_id: str, payload: SubmissionUpdate, user: CurrentUser):
    sub = FirestoreCRUD.get_submission(submission_id)
    if not sub or sub.get("user_id") != user.id:
        return ApiResponse(data=None, message="Submission not found.")
    
    p1 = sub.get("prompt_1") or sub.get("prompt_used", "")
    p2 = sub.get("prompt_2", "")
    
    if not p1 and payload.prompt.strip():
        updates = {"prompt_1": payload.prompt.strip(), "prompt_used": payload.prompt.strip()}
    elif p1 and not p2 and payload.prompt.strip() and payload.prompt.strip() != p1:
        updates = {"prompt_2": payload.prompt.strip(), "prompt_used": payload.prompt.strip()}
    else:
        updates = {"prompt_used": payload.prompt}

    updated = FirestoreCRUD.update_submission(submission_id, updates)
    rnd = FirestoreCRUD.get_round(updated["round_id"]) or {}
    comp = FirestoreCRUD.get_competition(rnd.get("competition_id")) or {}
    ti = FirestoreCRUD.get_target_image_by_round(rnd.get("id")) or {}
    
    return ApiResponse(data=_build_challenge_status_read(updated, rnd, comp, ti), message="Prompt saved.")

@router.post("/submissions/{submission_id}/prompt-1", response_model=ApiResponse[ChallengeStatusRead])
def save_prompt_1(submission_id: str, payload: SubmissionUpdate, user: CurrentUser):
    sub = FirestoreCRUD.get_submission(submission_id)
    if not sub or sub.get("user_id") != user.id:
        abort("Submission not found.", 404)
    if sub.get("status") in (SubmissionStatus.SUBMITTED.value, SubmissionStatus.SCORED.value):
        abort("Submission is locked.", 409)
    if sub.get("prompt_1") and len(sub["prompt_1"].strip()) > 0:
        abort("First prompt has already been submitted and locked.", 409)
    
    text = payload.prompt.strip()
    if not text:
        abort("First prompt cannot be empty.", 400)

    updated = FirestoreCRUD.update_submission(submission_id, {
        "prompt_1": text,
        "prompt_used": text,
    })
    rnd = FirestoreCRUD.get_round(updated["round_id"]) or {}
    comp = FirestoreCRUD.get_competition(rnd.get("competition_id")) or {}
    ti = FirestoreCRUD.get_target_image_by_round(rnd.get("id")) or {}

    return ApiResponse(data=_build_challenge_status_read(updated, rnd, comp, ti), message="First prompt submitted successfully.")

@router.post("/submissions/{submission_id}/upload-first-image", response_model=ApiResponse[ChallengeStatusRead])
def upload_first_generated_image(submission_id: str, user: CurrentUser, file: UploadFile = File(...)):
    sub = FirestoreCRUD.get_submission(submission_id)
    if not sub or sub.get("user_id") != user.id:
        abort("Submission not found.", 404)
    if sub.get("status") in (SubmissionStatus.SUBMITTED.value, SubmissionStatus.SCORED.value):
        abort("Submission is locked.", 409)
    
    p1 = sub.get("prompt_1") or sub.get("prompt_used", "")
    if not p1 or len(p1.strip()) == 0:
        abort("Submit First Prompt before uploading first image.", 400)
    
    if sub.get("first_image_url"):
        abort("First image has already been uploaded and evaluated.", 409)

    from app.core.config import get_settings
    cfg = get_settings()
    data = file.file.read()
    storage = get_storage_provider()
    relative_url = storage.save(
        data=data,
        folder=f"submissions/{submission_id}",
        filename=file.filename or "first_generated.png",
        max_bytes=cfg.max_participant_upload_bytes,
    )

    rnd = FirestoreCRUD.get_round(sub["round_id"]) or {}
    ti = FirestoreCRUD.get_target_image_by_round(sub["round_id"]) or {}
    
    # Run ML Evaluator on First Image
    res = evaluate_submission(
        target_image_path=ti.get("image_url"),
        uploaded_image_path=relative_url,
        participant_prompt=p1,
        reference_prompt=rnd.get("secret_prompt", ""),
    )

    # Persist FIRST stage score in Firestore scores collection
    FirestoreCRUD.create_score({
        "submission_id": submission_id,
        "round_id": sub["round_id"],
        "user_id": user.id,
        "evaluation_stage": "FIRST",
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
        "first_image_url": relative_url,
        "image_url": relative_url,
    })

    comp = FirestoreCRUD.get_competition(rnd.get("competition_id")) or {}
    return ApiResponse(data=_build_challenge_status_read(updated, rnd, comp, ti), message="First generated image evaluated successfully.")

@router.post("/submissions/{submission_id}/prompt-2", response_model=ApiResponse[ChallengeStatusRead])
def save_prompt_2(submission_id: str, payload: SubmissionUpdate, user: CurrentUser):
    sub = FirestoreCRUD.get_submission(submission_id)
    if not sub or sub.get("user_id") != user.id:
        abort("Submission not found.", 404)
    if sub.get("status") in (SubmissionStatus.SUBMITTED.value, SubmissionStatus.SCORED.value):
        abort("Submission is locked.", 409)
    
    p1 = sub.get("prompt_1") or sub.get("prompt_used", "")
    if not p1 or len(p1.strip()) == 0:
        abort("You must submit First Prompt before submitting Follow-up Prompt.", 400)
    
    first_score = FirestoreCRUD.get_score_by_submission_and_stage(submission_id, "FIRST")
    if not sub.get("first_image_url") and not first_score:
        abort("Upload and evaluate first image before submitting Follow-up Prompt.", 400)

    if sub.get("prompt_2") and len(sub["prompt_2"].strip()) > 0:
        abort("Follow-up prompt has already been submitted and locked.", 409)
    
    text = payload.prompt.strip()
    if not text:
        abort("Follow-up prompt cannot be empty.", 400)

    updated = FirestoreCRUD.update_submission(submission_id, {
        "prompt_2": text,
        "prompt_used": text,
    })
    rnd = FirestoreCRUD.get_round(updated["round_id"]) or {}
    comp = FirestoreCRUD.get_competition(rnd.get("competition_id")) or {}
    ti = FirestoreCRUD.get_target_image_by_round(rnd.get("id")) or {}

    return ApiResponse(data=_build_challenge_status_read(updated, rnd, comp, ti), message="Follow-up prompt submitted successfully.")

@router.post("/submissions/{submission_id}/upload-final-image", response_model=ApiResponse[ChallengeStatusRead])
def upload_final_generated_image(submission_id: str, user: CurrentUser, file: UploadFile = File(...)):
    sub = FirestoreCRUD.get_submission(submission_id)
    if not sub or sub.get("user_id") != user.id:
        abort("Submission not found.", 404)
    if sub.get("status") in (SubmissionStatus.SUBMITTED.value, SubmissionStatus.SCORED.value):
        abort("Submission is locked.", 409)

    p2 = sub.get("prompt_2", "")
    if not p2 or len(p2.strip()) == 0:
        abort("Submit Follow-up Prompt before uploading final image.", 400)

    from app.core.config import get_settings
    cfg = get_settings()
    data = file.file.read()
    storage = get_storage_provider()
    relative_url = storage.save(
        data=data,
        folder=f"submissions/{submission_id}",
        filename=file.filename or "final_generated.png",
        max_bytes=cfg.max_participant_upload_bytes,
    )

    rnd = FirestoreCRUD.get_round(sub["round_id"]) or {}
    ti = FirestoreCRUD.get_target_image_by_round(sub["round_id"]) or {}
    
    # Run ML Evaluator on Final Image
    res = evaluate_submission(
        target_image_path=ti.get("image_url"),
        uploaded_image_path=relative_url,
        participant_prompt=p2,
        reference_prompt=rnd.get("secret_prompt", ""),
    )

    # Persist FINAL stage score in Firestore scores collection
    FirestoreCRUD.create_score({
        "submission_id": submission_id,
        "round_id": sub["round_id"],
        "user_id": user.id,
        "evaluation_stage": "FINAL",
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
        "final_image_url": relative_url,
        "image_url": relative_url,
    })

    comp = FirestoreCRUD.get_competition(rnd.get("competition_id")) or {}
    return ApiResponse(data=_build_challenge_status_read(updated, rnd, comp, ti), message="Final generated image evaluated successfully.")

@router.post("/submissions/{submission_id}/upload-image", response_model=ApiResponse[ChallengeStatusRead])
def upload_participant_generated_image(submission_id: str, user: CurrentUser, file: UploadFile = File(...)):
    sub = FirestoreCRUD.get_submission(submission_id)
    if not sub:
        abort("Submission not found.", 404)
    if sub.get("prompt_2"):
        return upload_final_generated_image(submission_id, user, file)
    return upload_first_generated_image(submission_id, user, file)

@router.post("/submissions/{submission_id}/submit", response_model=ApiResponse[ChallengeStatusRead])
def submit_challenge(submission_id: str, user: CurrentUser):
    sub = FirestoreCRUD.get_submission(submission_id)
    if not sub or sub.get("user_id") != user.id:
        abort("Submission not found.", 404)
    if sub.get("status") in (SubmissionStatus.SUBMITTED.value, SubmissionStatus.SCORED.value):
        abort("You have already submitted for this round.", 409)

    p1 = sub.get("prompt_1") or sub.get("prompt_used", "")
    p2 = sub.get("prompt_2", "")

    if not p1 or len(p1.strip()) == 0:
        abort("Submit First Prompt before submitting final challenge.", 400)
    
    first_sc = FirestoreCRUD.get_score_by_submission_and_stage(submission_id, "FIRST")
    if not sub.get("first_image_url") and not first_sc:
        abort("Upload and evaluate first image before submitting final challenge.", 400)

    if not p2 or len(p2.strip()) == 0:
        abort("Submit Follow-up Prompt before submitting final challenge.", 400)

    final_img_url = sub.get("final_image_url") or sub.get("image_url")
    final_sc = FirestoreCRUD.get_score_by_submission_and_stage(submission_id, "FINAL")

    rnd = FirestoreCRUD.get_round(sub["round_id"]) or {}
    ti = FirestoreCRUD.get_target_image_by_round(sub["round_id"]) or {}

    if not sub.get("final_image_url") and not final_sc:
        abort("Upload and evaluate final generated image before submitting.", 400)

    if not final_sc and final_img_url:
        res = evaluate_submission(
            target_image_path=ti.get("image_url"),
            uploaded_image_path=final_img_url,
            participant_prompt=p2,
            reference_prompt=rnd.get("secret_prompt", ""),
        )
        final_sc = FirestoreCRUD.create_score({
            "submission_id": submission_id,
            "round_id": sub["round_id"],
            "user_id": user.id,
            "evaluation_stage": "FINAL",
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

    return ApiResponse(data=_build_challenge_status_read(updated, rnd, comp, ti), message="Submission received and evaluated.")