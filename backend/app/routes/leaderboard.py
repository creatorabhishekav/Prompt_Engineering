from fastapi import APIRouter, Query
from pydantic import BaseModel
from sqlalchemy import func, select

from app.core.deps import DbSession
from app.models.domain_enums import ScoringStatus, SubmissionStatus
from app.models.score import Score
from app.models.submission import Submission
from app.models.user import User
from app.schemas.common import ApiResponse

router = APIRouter(prefix="/leaderboard", tags=["leaderboard"])


class LeaderboardEntry(BaseModel):
    rank: int
    user_id: str
    username: str
    full_name: str | None = None
    total_score: float         # max 80
    semantic_score: float = 0  # max 32
    composition_score: float = 0 # max 20
    objects_score: float = 0   # max 16
    color_score: float = 0     # max 8
    details_score: float = 0   # max 4
    rounds_played: int = 1


@router.get("", response_model=ApiResponse[list[LeaderboardEntry]])
def get_leaderboard(
    db: DbSession,
    round_id: str | None = Query(default=None),
):
    """Retrieve leaderboard rankings based on total AI scores (/80)."""
    if round_id:
        stmt = (
            select(Score, User)
            .join(User, User.id == Score.user_id)
            .where(
                Score.round_id == round_id,
                Score.status == ScoringStatus.SCORED,
            )
            .order_by(Score.total_score.desc(), Score.created_at.asc())
        )
        rows = db.execute(stmt).all()
        entries = []
        rank = 1
        for score, user in rows:
            entries.append(
                LeaderboardEntry(
                    rank=rank,
                    user_id=user.id,
                    username=user.username,
                    full_name=user.full_name,
                    total_score=score.total_score,
                    semantic_score=score.semantic_score,
                    composition_score=score.composition_score,
                    objects_score=score.objects_score,
                    color_score=score.color_score,
                    details_score=score.details_score,
                    rounds_played=1,
                )
            )
            rank += 1
        return ApiResponse(data=entries, message="OK")

    # Overall leaderboard: highest single submission total_score or sum per participant
    stmt = (
        select(
            User,
            func.max(Score.total_score).label("max_score"),
            func.count(Score.id).label("rounds_played"),
        )
        .join(Score, Score.user_id == User.id)
        .where(Score.status == ScoringStatus.SCORED)
        .group_by(User.id)
        .order_by(func.max(Score.total_score).desc(), User.created_at.asc())
    )

    rows = db.execute(stmt).all()
    entries = []
    rank = 1
    for user, max_score, rounds_played in rows:
        entries.append(
            LeaderboardEntry(
                rank=rank,
                user_id=user.id,
                username=user.username,
                full_name=user.full_name,
                total_score=float(max_score or 0.0),
                rounds_played=int(rounds_played or 1),
            )
        )
        rank += 1

    return ApiResponse(data=entries, message="OK")
