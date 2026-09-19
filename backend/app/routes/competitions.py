from fastapi import APIRouter, File, UploadFile
from sqlalchemy.orm import Session

from app.core.deps import CurrentUser, DbSession
from app.models.competition import Competition
from app.models.domain_enums import LifecycleStatus, SubmissionStatus
from app.models.round import Round
from app.models.submission import Submission
from app.models.user import User
from app.schemas.challenge import (
    ActiveCompetitionRead,
    ActiveRoundRead,
    ChallengeStatusRead,
)
from app.schemas.common import ApiResponse
from app.schemas.submission import SubmissionUpdate
from app.services import challenge_service
from app.services.errors import ApiError, abort, to_http_error

router = APIRouter(tags=["challenge"])


def _round_or_404(db: Session, round_id: str) -> Round:
    return challenge_service.get_round_for_participant_or_404(db, round_id)


def _owner_submission_or_404(db: Session, user: User, submission_id: str) -> Submission:
    submission = db.get(Submission, submission_id)
    if submission is None or submission.user_id != user.id:
        abort("Submission not found.", 404)
    return submission


def _build_status(round_: Round, submission: Submission | None) -> ChallengeStatusRead:
    remaining = 0
    status = "not_started"
    prompt = ""
    uploaded_image_url = None
    started_at_elapsed = None
    deadline_elapsed = None
    submitted_at = None
    scoring_status = None
    total_score = None
    if submission is not None:
        final = challenge_service.ensure_fresh(submission, round_)
        status = final.status.value
        prompt = final.prompt_used
        uploaded_image_url = final.image_url
        started_at_elapsed = final.started_at_elapsed
        deadline_elapsed = final.deadline_elapsed
        submitted_at = final.submitted_at
        if final.score:
            scoring_status = final.score.status.value
            total_score = final.score.total_score
        if final.status == SubmissionStatus.IN_PROGRESS:
            remaining = challenge_service.participant_remaining(round_, final)
    return ChallengeStatusRead(
        id=submission.id if submission else "",
        round_id=round_.id,
        round_title=round_.title,
        competition_title=round_.competition.title,
        time_limit_seconds=round_.time_limit_seconds,
        round_status=round_.status,
        target_image_url=challenge_service.target_image_url(round_),
        uploaded_image_url=uploaded_image_url,
        status=status,
        prompt=prompt,
        started_at_elapsed=started_at_elapsed,
        remaining_seconds=remaining,
        deadline_elapsed=deadline_elapsed,
        submitted_at=submitted_at,
        scoring_status=scoring_status,
        total_score=total_score,
    )


@router.get("/competitions/active", response_model=ApiResponse[list[ActiveCompetitionRead]])
def active_competitions(db: DbSession, _: CurrentUser):
    competitions: list[Competition] = challenge_service.get_active_competitions(db)
    payload = []
    for competition in competitions:
        open_rounds = [
            r for r in competition.rounds if r.status in (LifecycleStatus.ACTIVE, LifecycleStatus.PAUSED)
        ]
        payload.append(
            ActiveCompetitionRead(
                id=competition.id,
                title=competition.title,
                description=competition.description,
                status=competition.status,
                round_count=len(competition.rounds),
                open_round_count=len(open_rounds),
            )
        )
    return ApiResponse(data=payload, message="OK")


@router.get("/rounds/active", response_model=ApiResponse[list[ActiveRoundRead]])
def active_rounds(db: DbSession, _: CurrentUser):
    rounds: list[Round] = challenge_service.get_playable_rounds(db)
    payload = []
    for round_ in rounds:
        image = challenge_service.target_image_for(round_)
        payload.append(
            ActiveRoundRead(
                id=round_.id,
                competition_id=round_.competition_id,
                competition_title=round_.competition.title,
                round_number=round_.round_number,
                title=round_.title,
                description=round_.description,
                time_limit_seconds=round_.time_limit_seconds,
                status=round_.status,
                server_elapsed_seconds=challenge_service.round_server_elapsed_for(round_),
                target_image_url=image.image_url if image else None,
            )
        )
    return ApiResponse(data=payload, message="OK")


@router.post("/rounds/{round_id}/start", response_model=ApiResponse[ChallengeStatusRead])
def start_round_challenge(round_id: str, db: DbSession, user: CurrentUser):
    round_ = _round_or_404(db, round_id)
    try:
        submission = challenge_service.start_challenge(db, user.id, round_)
        db.commit()
        db.refresh(submission)
    except ApiError as exc:
        raise to_http_error(exc)
    return ApiResponse(data=_build_status(round_, submission), message="Challenge started.")


@router.get("/rounds/{round_id}/status", response_model=ApiResponse[ChallengeStatusRead])
def round_challenge_status(round_id: str, db: DbSession, user: CurrentUser):
    round_ = challenge_service.get_round_or_404_status(db, round_id)
    submission = challenge_service.find_attempt(db, user.id, round_.id)
    if submission is not None:
        challenge_service.ensure_fresh(submission, round_)
        db.commit()
    return ApiResponse(data=_build_status(round_, submission), message="OK")


@router.put("/submissions/{submission_id}/prompt", response_model=ApiResponse[ChallengeStatusRead])
def save_prompt(submission_id: str, payload: SubmissionUpdate, db: DbSession, user: CurrentUser):
    submission = _owner_submission_or_404(db, user, submission_id)
    try:
        challenge_service.save_prompt(db, submission, payload.prompt)
        db.commit()
        db.refresh(submission)
    except ApiError as exc:
        raise to_http_error(exc)
    return ApiResponse(
        data=_build_status(submission.round, submission), message="Prompt saved."
    )


@router.post("/submissions/{submission_id}/upload-image", response_model=ApiResponse[ChallengeStatusRead])
def upload_participant_generated_image(
    submission_id: str,
    db: DbSession,
    user: CurrentUser,
    file: UploadFile = File(...),
):
    submission = _owner_submission_or_404(db, user, submission_id)
    data = file.file.read()
    try:
        challenge_service.upload_participant_image(
            db, submission, file_bytes=data, filename=file.filename or "generated.png"
        )
        db.commit()
        db.refresh(submission)
    except ApiError as exc:
        raise to_http_error(exc)
    return ApiResponse(
        data=_build_status(submission.round, submission), message="Generated image uploaded successfully."
    )


@router.post("/submissions/{submission_id}/submit", response_model=ApiResponse[ChallengeStatusRead])
def submit_challenge(submission_id: str, db: DbSession, user: CurrentUser):
    submission = _owner_submission_or_404(db, user, submission_id)
    try:
        challenge_service.submit_challenge(db, submission, submission.round)
        db.commit()
        db.refresh(submission)
    except ApiError as exc:
        raise to_http_error(exc)
    return ApiResponse(data=_build_status(submission.round, submission), message="Submission received and evaluated.")