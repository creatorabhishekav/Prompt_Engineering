from pathlib import Path
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.time import utcnow
from app.models.competition import Competition
from app.models.domain_enums import LifecycleStatus, SubmissionStatus, ScoringStatus
from app.models.round import Round
from app.models.score import Score
from app.models.submission import Submission
from app.services.evaluator import evaluate_submission
from app.services.errors import abort
from app.services.lifecycle import personal_remaining_seconds, round_server_elapsed
from app.services.storage.factory import get_storage_provider

settings = get_settings()


def target_image_for(round_: Round):
    """Most recent target image of a round, if any."""
    if not round_.target_images:
        return None
    return max(round_.target_images, key=lambda img: (img.created_at or utcnow()))


def get_active_competitions(db: Session) -> list[Competition]:
    stmt = (
        select(Competition)
        .where(Competition.status.in_([LifecycleStatus.ACTIVE, LifecycleStatus.PAUSED]))
        .order_by(Competition.created_at.desc())
    )
    return list(db.scalars(stmt).all())


def get_playable_rounds(db: Session) -> list[Round]:
    """Rounds a participant can see: live (or paused) rounds in a live competition."""
    stmt = (
        select(Round)
        .join(Competition, Competition.id == Round.competition_id)
        .where(
            Round.status.in_([LifecycleStatus.ACTIVE, LifecycleStatus.PAUSED]),
            Competition.status.in_([LifecycleStatus.ACTIVE, LifecycleStatus.PAUSED]),
        )
        .order_by(Round.round_number.asc())
    )
    return list(db.scalars(stmt).all())


def get_round_for_participant_or_404(db: Session, round_id: str) -> Round:
    round_ = db.get(Round, round_id)
    if round_ is None:
        abort("Round not found.", 404)
    if round_.status not in (LifecycleStatus.ACTIVE, LifecycleStatus.PAUSED):
        abort("That round is not currently open to participants.", 409)
    return round_


def find_attempt(db: Session, user_id: str, round_id: str) -> Submission | None:
    return db.scalar(
        select(Submission).where(
            Submission.user_id == user_id, Submission.round_id == round_id
        )
    )


def start_challenge(db: Session, user_id: str, round_: Round) -> Submission:
    if round_.status != LifecycleStatus.ACTIVE:
        abort("This round is not live right now.", 409)
    if target_image_for(round_) is None:
        abort("This round has no target image yet.", 409)

    existing = find_attempt(db, user_id, round_.id)
    if existing is not None:
        if existing.status not in (SubmissionStatus.IN_PROGRESS,):
            # Already submitted or scored
            return existing
        # Idempotent: a refresh resumes the same attempt.
        submission = existing
        _finalize_if_expired(submission, round_)
        return submission

    if round_server_elapsed(round_) >= (round_.time_limit_seconds or 0):
        abort("This round has already ended.", 409)

    submission = Submission(
        user_id=user_id,
        round_id=round_.id,
        target_image_id=target_image_for(round_).id,
        prompt_used="",
        status=SubmissionStatus.IN_PROGRESS,
        started_at_elapsed=round_server_elapsed(round_),
    )
    db.add(submission)
    return submission


def save_prompt(db: Session, submission: Submission, prompt: str) -> Submission:
    if submission.status != SubmissionStatus.IN_PROGRESS:
        abort("This submission is locked and can no longer be edited.", 409)
    if len(prompt) > 4000:
        abort("Prompt must be 4000 characters or fewer.")
    submission.prompt_used = prompt
    return submission


def upload_participant_image(
    db: Session, submission: Submission, file_bytes: bytes, filename: str
) -> Submission:
    if submission.status != SubmissionStatus.IN_PROGRESS:
        abort("This submission is locked and cannot receive uploads.", 409)
    _finalize_if_expired(submission, submission.round)
    if submission.status != SubmissionStatus.IN_PROGRESS:
        abort("Your time for this attempt has expired.", 409)

    storage = get_storage_provider()
    relative_url = storage.save(
        data=file_bytes,
        folder=f"submissions/{submission.id}",
        filename=filename,
    )
    submission.image_url = relative_url
    return submission


def submit_challenge(db: Session, submission: Submission, round_: Round) -> Submission:
    if submission.status != SubmissionStatus.IN_PROGRESS:
        abort("You have already submitted for this round.", 409)
    final = _finalize_if_expired(submission, round_)
    if final.status != SubmissionStatus.IN_PROGRESS:
        abort("Time limit expired for this submission.", 409)

    if not submission.prompt_used or len(submission.prompt_used.strip()) == 0:
        abort("Write a prompt before submitting.")
    if not submission.image_url:
        abort("Upload your generated image before submitting.")

    submission.status = SubmissionStatus.SUBMITTED
    submission.submitted_at = utcnow()
    consumed = max(
        0, round_server_elapsed(round_) - (submission.started_at_elapsed or 0)
    )
    submission.deadline_elapsed = min(consumed, round_.time_limit_seconds or 0)

    # Perform automated AI evaluation out of 80
    evaluate_and_score(db, submission)
    return submission


def evaluate_and_score(db: Session, submission: Submission) -> Score:
    """Run evaluator service on submission and create/update Score record."""
    target_img = submission.target_image or target_image_for(submission.round)
    target_path = None
    if target_img and target_img.image_url and target_img.image_url.startswith("/media/"):
        rel = target_img.image_url[len("/media/") :]
        target_path = str(Path(settings.MEDIA_ROOT) / rel)

    uploaded_path = None
    if submission.image_url and submission.image_url.startswith("/media/"):
        rel = submission.image_url[len("/media/") :]
        uploaded_path = str(Path(settings.MEDIA_ROOT) / rel)

    ref_prompt = submission.round.secret_prompt if submission.round else None

    # Check for existing score
    existing_score = db.scalar(
        select(Score).where(Score.submission_id == submission.id)
    )
    if not existing_score:
        score_record = Score(
            submission_id=submission.id,
            round_id=submission.round_id,
            user_id=submission.user_id,
            status=ScoringStatus.PROCESSING,
        )
        db.add(score_record)
        db.flush()
    else:
        score_record = existing_score
        score_record.status = ScoringStatus.PROCESSING

    try:
        res = evaluate_submission(
            target_image_path=target_path,
            uploaded_image_path=uploaded_path,
            participant_prompt=submission.prompt_used,
            reference_prompt=ref_prompt,
        )
        score_record.semantic_score = res.semantic_score
        score_record.composition_score = res.composition_score
        score_record.objects_score = res.objects_score
        score_record.color_score = res.color_score
        score_record.details_score = res.details_score
        score_record.total_score = res.total_score
        score_record.status = ScoringStatus.SCORED
        submission.status = SubmissionStatus.SCORED
    except Exception as exc:
        score_record.status = ScoringStatus.FAILED
        score_record.feedback = f"Evaluation error: {str(exc)}"

    return score_record


def _finalize_if_expired(submission: Submission, round_: Round) -> Submission:
    if submission.status != SubmissionStatus.IN_PROGRESS:
        return submission
    if personal_remaining_seconds(round_, submission) > 0:
        return submission
    submission.status = SubmissionStatus.SUBMITTED
    submission.submitted_at = submission.submitted_at or utcnow()
    submission.deadline_elapsed = round_.time_limit_seconds or 0
    return submission


def finalize_all_expired(db: Session, round_: Round) -> int:
    count = 0
    for submission in round_.submissions:
        before = submission.status
        _finalize_if_expired(submission, round_)
        if before != submission.status:
            count += 1
    return count


# Public aliases used by route handlers / schemas.
def ensure_fresh(submission: Submission, round_: Round) -> Submission:
    return _finalize_if_expired(submission, round_)


def participant_remaining(round_: Round, submission: Submission) -> int:
    return personal_remaining_seconds(round_, submission)


def target_image_url(round_: Round) -> str | None:
    image = target_image_for(round_)
    return image.image_url if image else None


def round_server_elapsed_for(round_: Round) -> int:
    return round_server_elapsed(round_)


def get_round_or_404_status(db: Session, round_id: str) -> Round:
    round_ = db.get(Round, round_id)
    if round_ is None:
        abort("Round not found.", 404)
    return round_