from datetime import datetime
from fastapi import APIRouter
from pydantic import BaseModel
from app.core.deps import CurrentUser
from app.db.crud import FirestoreCRUD
from app.schemas.common import ApiResponse

router = APIRouter(tags=["results"])

class ResultItemRead(BaseModel):
    submission_id: str
    round_id: str
    round_title: str
    competition_title: str
    target_image_url: str | None = None
    uploaded_image_url: str | None = None
    prompt_used: str
    submission_status: str
    scoring_status: str
    clip_similarity: float | None = None
    evaluation_method: str = "CLIP + computer vision"
    semantic_score: float = 0.0      # max 32
    composition_score: float = 0.0   # max 20
    objects_score: float = 0.0       # max 16
    color_score: float = 0.0         # max 8
    details_score: float = 0.0       # max 4
    total_score: float = 0.0         # max 80
    feedback: str | None = None
    submitted_at: datetime | None = None

@router.get("/results/me", response_model=ApiResponse[list[ResultItemRead]])
def my_results(user: CurrentUser):
    subs = FirestoreCRUD.list_submissions_for_user(user.id)
    items = []
    for sub in subs:
        score = FirestoreCRUD.get_score_by_submission(sub["id"]) or {}
        rnd = FirestoreCRUD.get_round(sub.get("round_id")) or {}
        comp = FirestoreCRUD.get_competition(rnd.get("competition_id")) or {}
        ti = FirestoreCRUD.get_target_image_by_round(sub.get("round_id")) or {}
        items.append(
            ResultItemRead(
                submission_id=sub["id"],
                round_id=sub.get("round_id", ""),
                round_title=rnd.get("title", ""),
                competition_title=comp.get("title", ""),
                target_image_url=ti.get("image_url"),
                uploaded_image_url=sub.get("image_url"),
                prompt_used=sub.get("prompt_used", ""),
                submission_status=sub.get("status", "submitted"),
                scoring_status=score.get("status", "PENDING"),
                clip_similarity=score.get("clip_similarity"),
                evaluation_method=score.get("evaluation_method", "CLIP + computer vision"),
                semantic_score=score.get("semantic_score", 0.0),
                composition_score=score.get("composition_score", 0.0),
                objects_score=score.get("objects_score", 0.0),
                color_score=score.get("color_score", 0.0),
                details_score=score.get("details_score", 0.0),
                total_score=score.get("total_score", 0.0),
                feedback=score.get("feedback"),
                submitted_at=sub.get("submitted_at"),
            )
        )
    return ApiResponse(data=items, message="OK")

@router.get("/submissions/{submission_id}/result", response_model=ApiResponse[ResultItemRead])
def get_submission_result(submission_id: str, user: CurrentUser):
    sub = FirestoreCRUD.get_submission(submission_id)
    if not sub:
        return ApiResponse(data=None, message="Submission not found.")
    score = FirestoreCRUD.get_score_by_submission(submission_id) or {}
    rnd = FirestoreCRUD.get_round(sub.get("round_id")) or {}
    comp = FirestoreCRUD.get_competition(rnd.get("competition_id")) or {}
    ti = FirestoreCRUD.get_target_image_by_round(sub.get("round_id")) or {}
    
    data = ResultItemRead(
        submission_id=sub["id"],
        round_id=sub.get("round_id", ""),
        round_title=rnd.get("title", ""),
        competition_title=comp.get("title", ""),
        target_image_url=ti.get("image_url"),
        uploaded_image_url=sub.get("image_url"),
        prompt_used=sub.get("prompt_used", ""),
        submission_status=sub.get("status", "submitted"),
        scoring_status=score.get("status", "PENDING"),
        clip_similarity=score.get("clip_similarity"),
        evaluation_method=score.get("evaluation_method", "CLIP + computer vision"),
        semantic_score=score.get("semantic_score", 0.0),
        composition_score=score.get("composition_score", 0.0),
        objects_score=score.get("objects_score", 0.0),
        color_score=score.get("color_score", 0.0),
        details_score=score.get("details_score", 0.0),
        total_score=score.get("total_score", 0.0),
        feedback=score.get("feedback"),
        submitted_at=sub.get("submitted_at"),
    )
    return ApiResponse(data=data, message="OK")
