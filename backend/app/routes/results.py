from datetime import datetime
from fastapi import APIRouter
from pydantic import BaseModel
from sqlalchemy import select

from app.core.deps import CurrentUser, DbSession
from app.models.score import Score
from app.models.submission import Submission
from app.schemas.common import ApiResponse
from app.services.challenge_service import target_image_url
from app.services.errors import abort

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
    semantic_score: float = 0.0      # max 32
    composition_score: float = 0.0   # max 20
    objects_score: float = 0.0       # max 16
    color_score: float = 0.0         # max 8
    details_score: float = 0.0       # max 4
    total_score: float = 0.0         # max 80
    feedback: str | None = None
    submitted_at: datetime | None = None


@router.get("/results/me", response_model=ApiResponse[list[ResultItemRead]])
def my_results(db: DbSession, user: CurrentUser):
    submissions = db.scalars(
        select(Submission)
        .where(Submission.user_id == user.id)
        .order_by(Submission.created_at.desc())
    ).all()

    items = []
    for sub in submissions:
        score = sub.score
        items.append(
            ResultItemRead(
                submission_id=sub.id,
                round_id=sub.round_id,
                round_title=sub.round.title if sub.round else "",
                competition_title=sub.round.competition.title if sub.round and sub.round.competition else "",
                target_image_url=target_image_url(sub.round) if sub.round else None,
                uploaded_image_url=sub.image_url,
                prompt_used=sub.prompt_used,
                submission_status=sub.status.value,
                scoring_status=score.status.value if score else "PENDING",
                semantic_score=score.semantic_score if score else 0.0,
                composition_score=score.composition_score if score else 0.0,
                objects_score=score.objects_score if score else 0.0,
                color_score=score.color_score if score else 0.0,
                details_score=score.details_score if score else 0.0,
                total_score=score.total_score if score else 0.0,
                feedback=score.feedback if score else None,
                submitted_at=sub.submitted_at,
            )
        )

    return ApiResponse(data=items, message="OK")


@router.get("/submissions/{submission_id}/result", response_model=ApiResponse[ResultItemRead])
def get_submission_result(submission_id: str, db: DbSession, user: CurrentUser):
    sub = db.get(Submission, submission_id)
    if sub is None:
        abort("Submission not found.", 404)
    if sub.user_id != user.id and not user.is_admin:
        abort("Access denied.", 403)

    score = sub.score
    data = ResultItemRead(
        submission_id=sub.id,
        round_id=sub.round_id,
        round_title=sub.round.title if sub.round else "",
        competition_title=sub.round.competition.title if sub.round and sub.round.competition else "",
        target_image_url=target_image_url(sub.round) if sub.round else None,
        uploaded_image_url=sub.image_url,
        prompt_used=sub.prompt_used,
        submission_status=sub.status.value,
        scoring_status=score.status.value if score else "PENDING",
        semantic_score=score.semantic_score if score else 0.0,
        composition_score=score.composition_score if score else 0.0,
        objects_score=score.objects_score if score else 0.0,
        color_score=score.color_score if score else 0.0,
        details_score=score.details_score if score else 0.0,
        total_score=score.total_score if score else 0.0,
        feedback=score.feedback if score else None,
        submitted_at=sub.submitted_at,
    )

    return ApiResponse(data=data, message="OK")
