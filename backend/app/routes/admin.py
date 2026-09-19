from fastapi import APIRouter, File, Form, UploadFile
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.deps import AdminUser, DbSession
from app.models.competition import Competition
from app.models.domain_enums import LifecycleStatus, UserRole
from app.models.round import Round
from app.models.submission import Submission
from app.models.target_image import TargetImage
from app.models.user import User
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


def _round_or_404(db: Session, round_id: str) -> Round:
    return competition_service.get_round_or_404(db, round_id)


def _competition_or_404(db: Session, competition_id: str) -> Competition:
    return competition_service.get_competition_or_404(db, competition_id)


def _competition_read(competition: Competition) -> CompetitionRead:
    data = CompetitionRead(
        id=competition.id,
        title=competition.title,
        description=competition.description,
        slug=competition.slug,
        status=competition.status,
        scheduled_start=competition.scheduled_start,
        scheduled_end=competition.scheduled_end,
        started_at=competition.started_at,
        paused_at=competition.paused_at,
        ended_at=competition.ended_at,
        created_by=competition.created_by,
        created_at=competition.created_at,
        updated_at=competition.updated_at,
    )
    data.rounds = _round_read_list(None, competition.rounds)
    return data


def _round_read_list(db: Session | None, rounds: list[Round]) -> list[RoundRead]:
    return [RoundRead.from_round(r) for r in rounds]


@router.get("/overview", response_model=ApiResponse[dict])
def admin_overview(db: DbSession, _: AdminUser):
    """Admin-only summary of platform counters."""
    return ApiResponse(
        data={
            "users": db.scalar(select(func.count()).select_from(User)) or 0,
            "participants": db.scalar(
                select(func.count()).select_from(User).where(User.role == UserRole.PARTICIPANT)
            )
            or 0,
            "competitions": db.scalar(select(func.count()).select_from(Competition)) or 0,
            "rounds": db.scalar(select(func.count()).select_from(Round)) or 0,
            "submissions": db.scalar(select(func.count()).select_from(Submission)) or 0,
        },
        message="OK",
    )


@router.get("/users", response_model=ApiResponse[list[dict]])
def list_participants(db: DbSession, _: AdminUser):
    users = db.scalars(
        select(User).where(User.role == UserRole.PARTICIPANT).order_by(User.created_at.desc())
    ).all()
    return ApiResponse(
        data=[
            {
                "id": u.id,
                "username": u.username,
                "email": u.email,
                "full_name": u.full_name,
                "is_active": u.is_active,
                "created_at": u.created_at,
            }
            for u in users
        ],
        message="OK",
    )


# --- Competitions ---

@router.get("/competitions", response_model=ApiResponse[list[CompetitionRead]])
def list_competitions(db: DbSession, _: AdminUser):
    competitions = db.scalars(
        select(Competition).order_by(Competition.created_at.desc())
    ).all()
    payload = []
    for competition in competitions:
        payload.append(_competition_read(competition))
    return ApiResponse(data=payload, message="OK")


@router.post("/competitions", response_model=ApiResponse[CompetitionRead])
def create_competition(payload: CompetitionCreate, db: DbSession, admin: AdminUser):
    try:
        competition = competition_service.create_competition(
            db,
            title=payload.title,
            description=payload.description,
            slug=payload.slug,
            scheduled_start=payload.scheduled_start,
            scheduled_end=payload.scheduled_end,
            created_by=admin.id,
        )
        db.commit()
        db.refresh(competition)
    except ApiError as exc:
        raise to_http_error(exc)
    return ApiResponse(data=_competition_read(competition), message="Competition created.")


@router.get("/competitions/{competition_id}", response_model=ApiResponse[CompetitionRead])
def get_competition(competition_id: str, db: DbSession, _: AdminUser):
    competition = _competition_or_404(db, competition_id)
    data = _competition_read(competition)
    return ApiResponse(data=data, message="OK")


@router.patch("/competitions/{competition_id}", response_model=ApiResponse[CompetitionRead])
def update_competition(
    competition_id: str, payload: CompetitionUpdate, db: DbSession, _: AdminUser
):
    competition = _competition_or_404(db, competition_id)
    try:
        competition_service.update_competition(
            db,
            competition,
            title=payload.title,
            description=payload.description,
            slug=payload.slug,
            scheduled_start=payload.scheduled_start,
            scheduled_end=payload.scheduled_end,
        )
        db.commit()
        db.refresh(competition)
    except ApiError as exc:
        raise to_http_error(exc)
    data = _competition_read(competition)
    return ApiResponse(data=data, message="Competition updated.")


@router.post("/competitions/{competition_id}/schedule", response_model=ApiResponse[CompetitionRead])
def schedule_competition(competition_id: str, db: DbSession, _: AdminUser):
    competition = _competition_or_404(db, competition_id)
    lifecycle.schedule_competition(db, competition)
    db.commit()
    db.refresh(competition)
    return ApiResponse(data=_competition_read(competition), message="Competition scheduled.")


@router.post("/competitions/{competition_id}/start", response_model=ApiResponse[CompetitionRead])
def start_competition(competition_id: str, db: DbSession, _: AdminUser):
    competition = _competition_or_404(db, competition_id)
    lifecycle.start_competition(db, competition)
    db.commit()
    db.refresh(competition)
    return ApiResponse(data=_competition_read(competition), message="Competition started.")


@router.post("/competitions/{competition_id}/pause", response_model=ApiResponse[CompetitionRead])
def pause_competition(competition_id: str, db: DbSession, _: AdminUser):
    competition = _competition_or_404(db, competition_id)
    lifecycle.pause_competition(db, competition)
    db.commit()
    db.refresh(competition)
    return ApiResponse(data=_competition_read(competition), message="Competition paused.")


@router.post("/competitions/{competition_id}/resume", response_model=ApiResponse[CompetitionRead])
def resume_competition(competition_id: str, db: DbSession, _: AdminUser):
    competition = _competition_or_404(db, competition_id)
    lifecycle.resume_competition(db, competition)
    db.commit()
    db.refresh(competition)
    return ApiResponse(data=_competition_read(competition), message="Competition resumed.")


@router.post("/competitions/{competition_id}/end", response_model=ApiResponse[CompetitionRead])
def end_competition(competition_id: str, db: DbSession, _: AdminUser):
    competition = _competition_or_404(db, competition_id)
    lifecycle.end_competition(db, competition)
    for round_ in competition.rounds:
        if round_.status != LifecycleStatus.ENDED:
            lifecycle.end_round(db, round_)
    db.commit()
    db.refresh(competition)
    return ApiResponse(data=_competition_read(competition), message="Competition ended.")


# --- Rounds ---

@router.post("/competitions/{competition_id}/rounds", response_model=ApiResponse[RoundRead])
def create_round(
    competition_id: str, payload: RoundCreate, db: DbSession, admin: AdminUser
):
    competition = _competition_or_404(db, competition_id)
    if competition.status == LifecycleStatus.ENDED:
        abort("Cannot add rounds to an ended competition.", 409)
    try:
        round_ = competition_service.create_round(
            db,
            competition,
            round_number=payload.round_number,
            title=payload.title,
            description=payload.description,
            secret_prompt=payload.secret_prompt,
            time_limit_seconds=payload.time_limit_seconds,
            max_submissions=payload.max_submissions,
        )
        db.commit()
        db.refresh(round_)
    except ApiError as exc:
        raise to_http_error(exc)
    return ApiResponse(data=RoundRead.from_round(round_), message="Round created.")


@router.get("/competitions/{competition_id}/rounds", response_model=ApiResponse[list[RoundRead]])
def list_rounds(competition_id: str, db: DbSession, _: AdminUser):
    competition = _competition_or_404(db, competition_id)
    rounds = sorted(competition.rounds, key=lambda r: r.round_number)
    return ApiResponse(data=_round_read_list(db, rounds), message="OK")


@router.patch("/rounds/{round_id}", response_model=ApiResponse[RoundRead])
def update_round(round_id: str, payload: RoundUpdate, db: DbSession, _: AdminUser):
    round_ = _round_or_404(db, round_id)
    try:
        competition_service.update_round(
            db,
            round_,
            title=payload.title,
            description=payload.description,
            secret_prompt=payload.secret_prompt,
            time_limit_seconds=payload.time_limit_seconds,
            max_submissions=payload.max_submissions,
        )
        db.commit()
        db.refresh(round_)
    except ApiError as exc:
        raise to_http_error(exc)
    return ApiResponse(data=RoundRead.from_round(round_), message="Round updated.")


@router.post("/rounds/{round_id}/start", response_model=ApiResponse[RoundRead])
def start_round(round_id: str, db: DbSession, _: AdminUser):
    round_ = _round_or_404(db, round_id)
    try:
        lifecycle.start_round(db, round_)
        lifecycle.ensure_competition_active(db, round_.competition)
        db.commit()
        db.refresh(round_)
    except ApiError as exc:
        raise to_http_error(exc)
    return ApiResponse(data=RoundRead.from_round(round_), message="Round started.")


@router.post("/rounds/{round_id}/pause", response_model=ApiResponse[RoundRead])
def pause_round(round_id: str, db: DbSession, _: AdminUser):
    round_ = _round_or_404(db, round_id)
    try:
        lifecycle.pause_round(db, round_)
        db.commit()
        db.refresh(round_)
    except ApiError as exc:
        raise to_http_error(exc)
    return ApiResponse(data=RoundRead.from_round(round_), message="Round paused.")


@router.post("/rounds/{round_id}/resume", response_model=ApiResponse[RoundRead])
def resume_round(round_id: str, db: DbSession, _: AdminUser):
    round_ = _round_or_404(db, round_id)
    try:
        lifecycle.resume_round(db, round_)
        db.commit()
        db.refresh(round_)
    except ApiError as exc:
        raise to_http_error(exc)
    return ApiResponse(data=RoundRead.from_round(round_), message="Round resumed.")


@router.post("/rounds/{round_id}/end", response_model=ApiResponse[RoundRead])
def end_round(round_id: str, db: DbSession, _: AdminUser):
    round_ = _round_or_404(db, round_id)
    try:
        lifecycle.end_round(db, round_)
        db.commit()
        db.refresh(round_)
    except ApiError as exc:
        raise to_http_error(exc)
    return ApiResponse(data=RoundRead.from_round(round_), message="Round ended.")


@router.post("/rounds/{round_id}/target-images")
def upload_target_image(
    round_id: str,
    db: DbSession,
    admin: AdminUser,
    file: UploadFile = File(...),
    alt_text: str | None = Form(default=None),
):
    round_ = _round_or_404(db, round_id)
    if round_.status == LifecycleStatus.ENDED:
        abort("Cannot upload images to an ended round.", 409)
    data = file.file.read()
    storage = get_storage_provider()
    try:
        url = storage.save(
            data=data,
            folder=f"rounds/{round_.id}",
            filename=file.filename or "target.png",
        )
    except ApiError as exc:
        raise to_http_error(exc)
    image = TargetImage(
        round_id=round_.id,
        image_url=url,
        alt_text=alt_text,
        created_by=admin.id,
    )
    db.add(image)
    db.commit()
    db.refresh(image)
    return ApiResponse(data=TargetImageRead.model_validate(image), message="Target image uploaded.")


@router.get("/rounds/{round_id}/target-images", response_model=ApiResponse[list[TargetImageRead]])
def list_target_images(round_id: str, db: DbSession, _: AdminUser):
    _round_or_404(db, round_id)
    images = db.scalars(
        select(TargetImage).where(TargetImage.round_id == round_id).order_by(TargetImage.created_at.desc())
    ).all()
    return ApiResponse(data=[TargetImageRead.model_validate(i) for i in images], message="OK")


@router.get("/rounds/{round_id}/submissions", response_model=ApiResponse[list[AdminSubmissionRead]])
def list_round_submissions(round_id: str, db: DbSession, _: AdminUser):
    round_ = _round_or_404(db, round_id)
    rows = db.execute(
        select(Submission, User.username)
        .join(User, User.id == Submission.user_id)
        .where(Submission.round_id == round_id)
        .order_by(Submission.created_at.asc())
    ).all()
    payload = []
    for sub, username in rows:
        score = sub.score
        payload.append(
            AdminSubmissionRead(
                id=sub.id,
                user_id=sub.user_id,
                username=username,
                full_name=sub.user.full_name,
                round_id=sub.round_id,
                round_title=round_.title,
                prompt_used=sub.prompt_used,
                image_url=sub.image_url,
                status=sub.status,
                started_at_elapsed=sub.started_at_elapsed,
                deadline_elapsed=sub.deadline_elapsed,
                submitted_at=sub.submitted_at,
                created_at=sub.created_at,
                scoring_status=score.status.value if score else None,
                semantic_score=score.semantic_score if score else None,
                composition_score=score.composition_score if score else None,
                objects_score=score.objects_score if score else None,
                color_score=score.color_score if score else None,
                details_score=score.details_score if score else None,
                total_score=score.total_score if score else None,
            )
        )
    return ApiResponse(data=payload, message="OK")