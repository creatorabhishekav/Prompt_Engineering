from datetime import datetime

from sqlalchemy.orm import Session

from app.core.time import utcnow
from app.models.competition import Competition
from app.models.domain_enums import LifecycleStatus, SubmissionStatus
from app.models.round import Round
from app.models.submission import Submission
from app.services.errors import abort

# Allowed lifecycle transitions shared by competitions and rounds.
LIFECYCLE_TRANSITIONS: dict[LifecycleStatus, set[LifecycleStatus]] = {
    LifecycleStatus.DRAFT: {LifecycleStatus.SCHEDULED, LifecycleStatus.ACTIVE, LifecycleStatus.ENDED},
    LifecycleStatus.SCHEDULED: {LifecycleStatus.ACTIVE, LifecycleStatus.ENDED},
    LifecycleStatus.ACTIVE: {LifecycleStatus.PAUSED, LifecycleStatus.ENDED},
    LifecycleStatus.PAUSED: {LifecycleStatus.ACTIVE, LifecycleStatus.ENDED},
    LifecycleStatus.ENDED: set(),
}


def ensure_transition(
    entity_name: str, current: LifecycleStatus, target: LifecycleStatus
) -> None:
    if target not in LIFECYCLE_TRANSITIONS.get(current, set()):
        abort(
            f"{entity_name} cannot move from '{current.value}' to '{target.value}'.",
            409,
        )


def round_server_elapsed(round_: Round, now: datetime | None = None) -> int:
    """Authoritative time the round has been live.

    Freezes while PAUSED/ENDED (only ``elapsed_seconds`` counts then) and
    keeps accruing while ACTIVE from ``segment_started_at``.
    """
    now = now or utcnow()
    base = round_.elapsed_seconds or 0
    if (
        round_.status == LifecycleStatus.ACTIVE
        and round_.segment_started_at is not None
    ):
        base += max(0, int((now - round_.segment_started_at).total_seconds()))
    return base


def round_remaining_seconds(round_: Round, now: datetime | None = None) -> int:
    return max(0, (round_.time_limit_seconds or 0) - round_server_elapsed(round_, now))


def round_is_expired(round_: Round, now: datetime | None = None) -> bool:
    return round_remaining_seconds(round_, now) <= 0


def personal_remaining_seconds(round_: Round, submission: Submission, now=None) -> int:
    """Seconds left for this participant, independent of page refresh.

    ``submission.started_at_elapsed`` is the server elapsed time at start, so
    the personal window always rides the authoritative server clock.
    """
    if submission.status != SubmissionStatus.IN_PROGRESS:
        return 0
    elapsed = round_server_elapsed(round_, now)
    consumed = max(0, elapsed - (submission.started_at_elapsed or 0))
    return max(0, (round_.time_limit_seconds or 0) - consumed)


def start_round(db: Session, round_: Round) -> Round:
    ensure_transition("Round", round_.status, LifecycleStatus.ACTIVE)
    if not round_.target_images:
        abort("A round needs at least one target image before it can start.", 409)
    round_.status = LifecycleStatus.ACTIVE
    round_.started_at = round_.started_at or utcnow()
    round_.paused_at = None
    round_.segment_started_at = utcnow()
    return round_


def pause_round(db: Session, round_: Round) -> Round:
    ensure_transition("Round", round_.status, LifecycleStatus.PAUSED)
    round_.elapsed_seconds = round_server_elapsed(round_)
    round_.segment_started_at = None
    round_.status = LifecycleStatus.PAUSED
    round_.paused_at = utcnow()
    return round_


def resume_round(db: Session, round_: Round) -> Round:
    ensure_transition("Round", round_.status, LifecycleStatus.ACTIVE)
    round_.status = LifecycleStatus.ACTIVE
    round_.segment_started_at = utcnow()
    round_.paused_at = None
    return round_


def end_round(db: Session, round_: Round) -> Round:
    ensure_transition("Round", round_.status, LifecycleStatus.ENDED)
    if round_.status == LifecycleStatus.ACTIVE:
        round_.elapsed_seconds = round_server_elapsed(round_)
    round_.segment_started_at = None
    round_.status = LifecycleStatus.ENDED
    round_.ended_at = utcnow()
    # Lock every in-progress attempt with its last autosaved prompt.
    for submission in round_.submissions:
        _force_finalize(submission, round_)
    return round_


def _force_finalize(submission: Submission, round_: Round) -> None:
    if submission.status != SubmissionStatus.IN_PROGRESS:
        return
    elapsed = round_server_elapsed(round_)
    submission.status = SubmissionStatus.SUBMITTED
    submission.submitted_at = submission.submitted_at or utcnow()
    consumed = max(0, elapsed - (submission.started_at_elapsed or 0))
    submission.deadline_elapsed = min(
        consumed, round_.time_limit_seconds or 0
    )
    submission.image_url = submission.image_url or None


# --- Competition transitions ---

def schedule_competition(db: Session, competition: Competition) -> Competition:
    ensure_transition("Competition", competition.status, LifecycleStatus.SCHEDULED)
    competition.status = LifecycleStatus.SCHEDULED
    return competition


def start_competition(db: Session, competition: Competition) -> Competition:
    ensure_transition("Competition", competition.status, LifecycleStatus.ACTIVE)
    competition.status = LifecycleStatus.ACTIVE
    competition.started_at = competition.started_at or utcnow()
    competition.paused_at = None
    return competition


def pause_competition(db: Session, competition: Competition) -> Competition:
    ensure_transition("Competition", competition.status, LifecycleStatus.PAUSED)
    competition.status = LifecycleStatus.PAUSED
    competition.paused_at = utcnow()
    return competition


def resume_competition(db: Session, competition: Competition) -> Competition:
    ensure_transition("Competition", competition.status, LifecycleStatus.ACTIVE)
    competition.status = LifecycleStatus.ACTIVE
    competition.paused_at = None
    return competition


def end_competition(db: Session, competition: Competition) -> Competition:
    ensure_transition("Competition", competition.status, LifecycleStatus.ENDED)
    competition.status = LifecycleStatus.ENDED
    competition.ended_at = utcnow()
    competition.paused_at = None
    return competition


def ensure_competition_active(db: Session, competition: Competition) -> Competition:
    """A started round brings its competition along into ACTIVE."""
    if competition.status in (LifecycleStatus.DRAFT, LifecycleStatus.SCHEDULED):
        return start_competition(db, competition)
    return competition