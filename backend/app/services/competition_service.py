from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.competition import Competition
from app.models.domain_enums import LifecycleStatus
from app.models.round import Round
from app.models.uuid import new_uuid
from app.services.errors import abort


def sluggify(title: str) -> str:
    slug = "".join(c if c.isalnum() else "-" for c in title.lower()).strip("-")
    return (slug or "competition") + "-" + new_uuid()[:8]


def unique_competition_slug(db: Session, title: str) -> str:
    for _ in range(20):
        slug = sluggify(title)
        if db.scalar(select(Competition).where(Competition.slug == slug)) is None:
            return slug
    return new_uuid()


def get_competition_or_404(db: Session, competition_id: str) -> Competition:
    competition = db.get(Competition, competition_id)
    if competition is None:
        abort("Competition not found.", 404)
    return competition


def get_round_or_404(db: Session, round_id: str) -> Round:
    round_ = db.get(Round, round_id)
    if round_ is None:
        abort("Round not found.", 404)
    return round_


def next_round_number(db: Session, competition_id: str) -> int:
    existing = db.scalars(
        select(Round.round_number).where(Round.competition_id == competition_id)
    ).all()
    return max(existing, default=0) + 1


def create_competition(
    db: Session,
    *,
    title: str,
    description: str | None,
    slug: str | None,
    scheduled_start=None,
    scheduled_end=None,
    created_by: str | None,
) -> Competition:
    if slug:
        norm = slug.strip().lower()
        if db.scalar(select(Competition).where(Competition.slug == norm)) is not None:
            abort("That slug is already in use.", 409)
        final_slug = norm
    else:
        final_slug = unique_competition_slug(db, title)
    competition = Competition(
        title=title,
        description=description,
        slug=final_slug,
        scheduled_start=scheduled_start,
        scheduled_end=scheduled_end,
        status=LifecycleStatus.DRAFT,
        created_by=created_by,
    )
    db.add(competition)
    return competition


def update_competition(
    db: Session,
    competition: Competition,
    *,
    title: str | None,
    description: str | None,
    slug: str | None,
    scheduled_start,
    scheduled_end,
) -> Competition:
    if title is not None:
        competition.title = title
    if description is not None:
        competition.description = description
    if slug is not None:
        norm = slug.strip().lower()
        taken = db.scalar(
            select(Competition).where(Competition.slug == norm, Competition.id != competition.id)
        )
        if taken is not None:
            abort("That slug is already in use.", 409)
        competition.slug = norm
    if scheduled_start is not None:
        competition.scheduled_start = scheduled_start
    if scheduled_end is not None:
        competition.scheduled_end = scheduled_end
    return competition


def create_round(
    db: Session,
    competition: Competition,
    *,
    round_number: int | None,
    title: str,
    description: str | None,
    secret_prompt: str,
    time_limit_seconds: int,
    max_submissions: int,
) -> Round:
    number = round_number or next_round_number(db, competition.id)
    existing = db.scalars(
        select(Round).where(
            Round.competition_id == competition.id, Round.round_number == number
        )
    ).first()
    if existing is not None:
        abort(
            f"Round #{number} already exists for this competition. "
            "Choose a different round number.",
            409,
        )
    if time_limit_seconds not in range(10, 7 * 24 * 60 * 60 + 1):
        abort("Time limit must be between 10 seconds and 7 days.")

    round_ = Round(
        competition_id=competition.id,
        round_number=number,
        title=title,
        description=description,
        secret_prompt=secret_prompt,
        time_limit_seconds=time_limit_seconds,
        max_submissions=max_submissions,
        status=LifecycleStatus.DRAFT,
    )
    db.add(round_)
    return round_


def update_round(
    db: Session,
    round_: Round,
    *,
    title: str | None,
    description: str | None,
    secret_prompt: str | None,
    time_limit_seconds: int | None,
    max_submissions: int | None,
) -> Round:
    if round_.status not in (LifecycleStatus.DRAFT, LifecycleStatus.SCHEDULED):
        abort("Only draft or scheduled rounds can be edited.", 409)
    if title is not None:
        round_.title = title
    if description is not None:
        round_.description = description
    if secret_prompt is not None:
        round_.secret_prompt = secret_prompt
    if time_limit_seconds is not None:
        if time_limit_seconds not in range(10, 7 * 24 * 60 * 60 + 1):
            abort("Time limit must be between 10 seconds and 7 days.")
        round_.time_limit_seconds = time_limit_seconds
    if max_submissions is not None:
        round_.max_submissions = max_submissions
    return round_