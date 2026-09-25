from fastapi import APIRouter, Query
from pydantic import BaseModel

from app.db.crud import FirestoreCRUD
from app.models.domain_enums import ScoringStatus
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
def get_leaderboard(round_id: str | None = Query(default=None)):
    """Retrieve leaderboard rankings based on total AI scores (/80) from Firestore repository."""
    scores = FirestoreCRUD.list_scores()
    valid_scores = [
        sc for sc in scores
        if sc.get("status") == ScoringStatus.SCORED.value
        and sc.get("evaluation_stage", "FINAL") == "FINAL"
    ]

    if round_id:
        valid_scores = [sc for sc in valid_scores if sc.get("round_id") == round_id]

    # Group scores by user_id and select max total_score
    user_scores = {}
    for sc in valid_scores:
        uid = sc.get("user_id")
        if not uid:
            continue
        if uid not in user_scores or sc.get("total_score", 0) > user_scores[uid]["total_score"]:
            user_scores[uid] = sc

    sorted_scores = sorted(user_scores.values(), key=lambda x: x.get("total_score", 0), reverse=True)

    entries = []
    rank = 1
    for sc in sorted_scores:
        u = FirestoreCRUD.get_user(sc["user_id"]) or {}
        entries.append(
            LeaderboardEntry(
                rank=rank,
                user_id=sc["user_id"],
                username=u.get("username", "Participant"),
                full_name=u.get("full_name") or u.get("displayName"),
                total_score=sc.get("total_score", 0.0),
                semantic_score=sc.get("semantic_score", 0.0),
                composition_score=sc.get("composition_score", 0.0),
                objects_score=sc.get("objects_score", 0.0),
                color_score=sc.get("color_score", 0.0),
                details_score=sc.get("details_score", 0.0),
                rounds_played=1,
            )
        )
        rank += 1

    return ApiResponse(data=entries, message="OK")
