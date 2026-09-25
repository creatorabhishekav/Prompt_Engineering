from fastapi import APIRouter, File, Form, UploadFile, Depends
from typing import Optional

from app.core.deps import AdminUser
from app.db.crud import FirestoreCRUD
from app.models.domain_enums import LifecycleStatus, UserRole, SubmissionStatus
from app.schemas.common import ApiResponse
from app.schemas.competition import (
    CompetitionCreate,
    CompetitionRead,
    CompetitionUpdate,
    RoundCreate,
    RoundRead,
    RoundUpdate,
)
from app.schemas.submission import AdminSubmissionRead
from app.schemas.target_image import TargetImageRead
from app.services import competition_service, lifecycle
from app.services.errors import ApiError, abort, to_http_error
from app.services.storage.factory import get_storage_provider

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/overview", response_model=ApiResponse[dict])
def admin_overview(_: AdminUser):
    """Admin-only summary of platform counters from Firestore CRUD."""
    users = FirestoreCRUD.list_users()
    participants = [u for u in users if u.get("role") == UserRole.PARTICIPANT.value]
    competitions = FirestoreCRUD.list_competitions()
    rounds = FirestoreCRUD.list_all_rounds()
    submissions = FirestoreCRUD.list_all_submissions()

    return ApiResponse(
        data={
            "users": len(users),
            "participants": len(participants),
            "competitions": len(competitions),
            "rounds": len(rounds),
            "submissions": len(submissions),
        },
        message="OK",
    )


@router.get("/users", response_model=ApiResponse[list[dict]])
def list_participants(_: AdminUser):
    users = FirestoreCRUD.list_users()
    participants = [
        {
            "id": u.get("uid") or u.get("id"),
            "username": u.get("username", ""),
            "email": u.get("email", ""),
            "full_name": u.get("full_name") or u.get("displayName"),
            "is_active": u.get("is_active", True),
            "created_at": u.get("created_at") or u.get("createdAt"),
        }
        for u in users
        if u.get("role") == UserRole.PARTICIPANT.value
    ]
    return ApiResponse(data=participants, message="OK")


# --- Competitions ---

@router.get("/competitions", response_model=ApiResponse[list[dict]])
def list_competitions(_: AdminUser):
    comps = FirestoreCRUD.list_competitions(include_archived=True)
    all_subs = FirestoreCRUD.list_all_submissions()
    sub_count_by_round = {}
    for s in all_subs:
        rid = s.get("round_id")
        if rid:
            sub_count_by_round[rid] = sub_count_by_round.get(rid, 0) + 1

    for c in comps:
        rounds = FirestoreCRUD.list_rounds_for_competition(c["id"], include_archived=True)
        for r in rounds:
            r["submission_count"] = sub_count_by_round.get(r["id"], 0)
        c["rounds"] = rounds
    return ApiResponse(data=comps, message="OK")


@router.post("/competitions/{competition_id}/archive", response_model=ApiResponse[dict])
def archive_competition(competition_id: str, _: AdminUser):
    comp = FirestoreCRUD.get_competition(competition_id)
    if not comp:
        abort("Competition not found.", 404)
    if comp.get("status") != LifecycleStatus.ENDED.value:
        abort("Only ended competitions can be archived.", 400)
    
    updated = FirestoreCRUD.update_competition(competition_id, {"is_archived": True})
    updated["rounds"] = FirestoreCRUD.list_rounds_for_competition(competition_id, include_archived=True)
    return ApiResponse(data=updated, message="Competition archived successfully.")


@router.post("/competitions/{competition_id}/restore", response_model=ApiResponse[dict])
def restore_competition(competition_id: str, _: AdminUser):
    comp = FirestoreCRUD.get_competition(competition_id)
    if not comp:
        abort("Competition not found.", 404)
    
    updated = FirestoreCRUD.update_competition(competition_id, {"is_archived": False})
    updated["rounds"] = FirestoreCRUD.list_rounds_for_competition(competition_id, include_archived=True)
    return ApiResponse(data=updated, message="Competition restored successfully.")


@router.post("/rounds/{round_id}/archive", response_model=ApiResponse[dict])
def archive_round(round_id: str, _: AdminUser):
    rnd = FirestoreCRUD.get_round(round_id)
    if not rnd:
        abort("Round not found.", 404)
    if rnd.get("status") != LifecycleStatus.ENDED.value:
        abort("Only ended rounds can be archived.", 400)
    
    updated = FirestoreCRUD.update_round(round_id, {"is_archived": True})
    return ApiResponse(data=updated, message="Round archived successfully.")


@router.post("/rounds/{round_id}/restore", response_model=ApiResponse[dict])
def restore_round(round_id: str, _: AdminUser):
    rnd = FirestoreCRUD.get_round(round_id)
    if not rnd:
        abort("Round not found.", 404)
    
    updated = FirestoreCRUD.update_round(round_id, {"is_archived": False})
    return ApiResponse(data=updated, message="Round restored successfully.")


@router.post("/competitions", response_model=ApiResponse[dict])
def create_competition(payload: CompetitionCreate, admin: AdminUser):
    data = FirestoreCRUD.create_competition({
        "title": payload.title,
        "description": payload.description,
        "slug": payload.slug or payload.title.lower().replace(" ", "-"),
        "scheduled_start": payload.scheduled_start.isoformat() if payload.scheduled_start else None,
        "scheduled_end": payload.scheduled_end.isoformat() if payload.scheduled_end else None,
        "status": LifecycleStatus.DRAFT.value,
        "created_by": admin.id,
    })
    data["rounds"] = []
    return ApiResponse(data=data, message="Competition created.")


@router.get("/competitions/{competition_id}", response_model=ApiResponse[dict])
def get_competition(competition_id: str, _: AdminUser):
    comp = FirestoreCRUD.get_competition(competition_id)
    if not comp:
        abort("Competition not found.", 404)
    comp["rounds"] = FirestoreCRUD.list_rounds_for_competition(competition_id)
    return ApiResponse(data=comp, message="OK")


@router.patch("/competitions/{competition_id}", response_model=ApiResponse[dict])
def update_competition(competition_id: str, payload: CompetitionUpdate, _: AdminUser):
    updates = {}
    if payload.title is not None:
        updates["title"] = payload.title
    if payload.description is not None:
        updates["description"] = payload.description
    if payload.slug is not None:
        updates["slug"] = payload.slug
    if payload.scheduled_start is not None:
        updates["scheduled_start"] = payload.scheduled_start.isoformat()
    if payload.scheduled_end is not None:
        updates["scheduled_end"] = payload.scheduled_end.isoformat()

    comp = FirestoreCRUD.update_competition(competition_id, updates)
    if not comp:
        abort("Competition not found.", 404)
    comp["rounds"] = FirestoreCRUD.list_rounds_for_competition(competition_id)
    return ApiResponse(data=comp, message="Competition updated.")


# --- Rounds ---

@router.post("/competitions/{competition_id}/rounds", response_model=ApiResponse[dict])
def create_round(competition_id: str, payload: RoundCreate, admin: AdminUser):
    comp = FirestoreCRUD.get_competition(competition_id)
    if not comp:
        abort("Competition not found.", 404)
    if comp.get("status") == LifecycleStatus.ENDED.value:
        abort("Cannot add rounds to an ended competition.", 409)

    existing_rounds = FirestoreCRUD.list_rounds_for_competition(competition_id)
    round_num = payload.round_number or (len(existing_rounds) + 1)

    rnd = FirestoreCRUD.create_round({
        "competition_id": competition_id,
        "round_number": round_num,
        "title": payload.title,
        "description": payload.description,
        "secret_prompt": payload.secret_prompt,
        "time_limit_seconds": payload.time_limit_seconds,
        "max_submissions": payload.max_submissions,
        "status": LifecycleStatus.DRAFT.value,
    })
    return ApiResponse(data=rnd, message="Round created.")


@router.get("/competitions/{competition_id}/rounds", response_model=ApiResponse[list[dict]])
def list_rounds(competition_id: str, _: AdminUser):
    rounds = FirestoreCRUD.list_rounds_for_competition(competition_id)
    rounds.sort(key=lambda r: r.get("round_number", 0))
    return ApiResponse(data=rounds, message="OK")


@router.post("/competitions/{competition_id}/{action}", response_model=ApiResponse[dict])
def competition_action(competition_id: str, action: str, _: AdminUser):
    status_map = {
        "schedule": LifecycleStatus.SCHEDULED.value,
        "start": LifecycleStatus.ACTIVE.value,
        "pause": LifecycleStatus.PAUSED.value,
        "resume": LifecycleStatus.ACTIVE.value,
        "end": LifecycleStatus.ENDED.value,
    }
    if action not in status_map:
        abort(f"Invalid action: {action}", 400)

    comp = FirestoreCRUD.update_competition(competition_id, {"status": status_map[action]})
    if not comp:
        abort("Competition not found.", 404)

    if action == "end":
        rounds = FirestoreCRUD.list_rounds_for_competition(competition_id)
        for r in rounds:
            if r.get("status") != LifecycleStatus.ENDED.value:
                FirestoreCRUD.update_round(r["id"], {"status": LifecycleStatus.ENDED.value})

    comp["rounds"] = FirestoreCRUD.list_rounds_for_competition(competition_id)
    return ApiResponse(data=comp, message=f"Competition {action}d successfully.")


@router.patch("/rounds/{round_id}", response_model=ApiResponse[dict])
def update_round(round_id: str, payload: RoundUpdate, _: AdminUser):
    rnd = FirestoreCRUD.get_round(round_id)
    if not rnd:
        abort("Round not found.", 404)
    updates = {}
    if payload.title is not None: updates["title"] = payload.title
    if payload.description is not None: updates["description"] = payload.description
    if payload.secret_prompt is not None: updates["secret_prompt"] = payload.secret_prompt
    if payload.time_limit_seconds is not None: updates["time_limit_seconds"] = payload.time_limit_seconds
    if payload.max_submissions is not None: updates["max_submissions"] = payload.max_submissions

    updated = FirestoreCRUD.update_round(round_id, updates)
    return ApiResponse(data=updated, message="Round updated.")


@router.post("/rounds/{round_id}/target-images")
def upload_target_image(
    round_id: str,
    admin: AdminUser,
    file: UploadFile = File(...),
    alt_text: Optional[str] = Form(default=None),
):
    rnd = FirestoreCRUD.get_round(round_id)
    if not rnd:
        abort("Round not found.", 404)
    data = file.file.read()
    storage = get_storage_provider()
    url = storage.save(
        data=data,
        folder=f"rounds/{round_id}",
        filename=file.filename or "target.png",
    )
    ti = FirestoreCRUD.create_target_image({
        "round_id": round_id,
        "image_url": url,
        "alt_text": alt_text,
        "created_by": admin.id,
    })
    return ApiResponse(data=ti, message="Target image uploaded.")


@router.get("/rounds/{round_id}/target-images", response_model=ApiResponse[list[dict]])
def get_target_images(round_id: str, _: AdminUser):
    ti = FirestoreCRUD.get_target_image_by_round(round_id)
    return ApiResponse(data=[ti] if ti else [], message="OK")


@router.get("/rounds/{round_id}/submissions", response_model=ApiResponse[list[dict]])
def list_submissions(round_id: str, _: AdminUser):
    subs = FirestoreCRUD.list_submissions_for_round(round_id)
    users_map = {u.get("uid") or u.get("id"): u for u in FirestoreCRUD.list_users()}
    rnds_map = {r["id"]: r for r in FirestoreCRUD.list_all_rounds()}

    payload = []
    for s in subs:
        u = users_map.get(s["user_id"], {})
        r = rnds_map.get(s["round_id"], {})
        sc = FirestoreCRUD.get_score_by_submission_and_stage(s["id"], "FINAL") or FirestoreCRUD.get_score_by_submission(s["id"]) or {}
        first_sc = FirestoreCRUD.get_score_by_submission_and_stage(s["id"], "FIRST") or {}
        payload.append({
            "id": s["id"],
            "user_id": s["user_id"],
            "username": u.get("username", "unknown"),
            "full_name": u.get("full_name") or u.get("displayName"),
            "round_id": s["round_id"],
            "round_title": r.get("title", ""),
            "prompt_used": s.get("prompt_used", ""),
            "prompt_1": s.get("prompt_1") or s.get("prompt_used", ""),
            "prompt_2": s.get("prompt_2", ""),
            "image_url": s.get("final_image_url") or s.get("image_url"),
            "first_image_url": s.get("first_image_url"),
            "final_image_url": s.get("final_image_url") or s.get("image_url"),
            "status": s.get("status", SubmissionStatus.SUBMITTED.value),
            "started_at_elapsed": s.get("started_at_elapsed"),
            "deadline_elapsed": s.get("deadline_elapsed"),
            "submitted_at": s.get("submitted_at"),
            "created_at": s.get("created_at"),
            "scoring_status": sc.get("status"),
            "semantic_score": sc.get("semantic_score"),
            "composition_score": sc.get("composition_score"),
            "objects_score": sc.get("objects_score"),
            "color_score": sc.get("color_score"),
            "details_score": sc.get("details_score"),
            "total_score": sc.get("total_score"),
            "clip_similarity": sc.get("clip_similarity"),
            "evaluation_method": sc.get("evaluation_method"),
            "first_scoring_status": first_sc.get("status"),
            "first_score": first_sc.get("total_score"),
            "first_score_breakdown": {
                "semantic_score": first_sc.get("semantic_score", 0.0),
                "composition_score": first_sc.get("composition_score", 0.0),
                "objects_score": first_sc.get("objects_score", 0.0),
                "color_score": first_sc.get("color_score", 0.0),
                "details_score": first_sc.get("details_score", 0.0),
                "total_score": first_sc.get("total_score", 0.0),
            } if first_sc.get("total_score") is not None else None,
        })
    return ApiResponse(data=payload, message="OK")


@router.post("/rounds/{round_id}/{action}", response_model=ApiResponse[dict])
def round_action(round_id: str, action: str, _: AdminUser):
    status_map = {
        "start": LifecycleStatus.ACTIVE.value,
        "pause": LifecycleStatus.PAUSED.value,
        "resume": LifecycleStatus.ACTIVE.value,
        "end": LifecycleStatus.ENDED.value,
    }
    if action not in status_map:
        abort(f"Invalid round action: {action}", 400)

    rnd = FirestoreCRUD.get_round(round_id)
    if not rnd:
        abort("Round not found.", 404)

    curr_status = rnd.get("status", LifecycleStatus.DRAFT.value)
    if curr_status == LifecycleStatus.ENDED.value and action != "end":
        abort("Cannot change status of an ended round.", 400)

    if action in ("start", "resume"):
        ti = FirestoreCRUD.get_target_image_by_round(round_id)
        if not ti or not ti.get("image_url"):
            abort("Target image must be uploaded before starting the round.", 400)

    updated = FirestoreCRUD.update_round(round_id, {"status": status_map[action]})
    return ApiResponse(data=updated, message=f"Round {action}d successfully.")


@router.delete("/submissions/{submission_id}", response_model=ApiResponse[dict])
def delete_submission(submission_id: str, _: AdminUser):
    sub = FirestoreCRUD.get_submission(submission_id)
    if not sub:
        abort("Submission not found.", 404)

    # 1. Clean up associated uploaded submission image files (never target round images)
    storage = get_storage_provider()
    image_paths = set()
    for key in ("image_url", "first_image_url", "final_image_url", "chat_screenshot_url", "chat_screenshot_path"):
        path = sub.get(key)
        if path and not path.startswith("http://") and not path.startswith("https://"):
            image_paths.add(path)

    for path in image_paths:
        try:
            storage.delete(path)
        except Exception:
            pass

    # 2. Delete all associated score documents for this exact submission
    FirestoreCRUD.delete_scores_by_submission(submission_id)

    # 3. Delete submission document
    FirestoreCRUD.delete_submission(submission_id)

    return ApiResponse(data={"id": submission_id}, message="Submission deleted successfully.")