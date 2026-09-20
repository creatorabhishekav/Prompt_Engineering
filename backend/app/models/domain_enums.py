from enum import Enum


class UserRole(str, Enum):
    PARTICIPANT = "PARTICIPANT"
    ADMIN = "ADMIN"


class LifecycleStatus(str, Enum):
    """Shared lifecycle for competitions and rounds.

    Transitions are enforced in app.services.lifecycle and must follow
    the allowed state machine (e.g. a round cannot jump straight from
    DRAFT to PAUSED).
    """

    DRAFT = "draft"
    SCHEDULED = "scheduled"
    ACTIVE = "active"
    PAUSED = "paused"
    ENDED = "ended"


class SubmissionStatus(str, Enum):
    """Lifecycle of a participant's attempt for a single round."""

    IN_PROGRESS = "in_progress"
    SUBMITTED = "submitted"
    SCORED = "scored"
    REJECTED = "rejected"


class ScoringStatus(str, Enum):
    PENDING = "PENDING"
    PROCESSING = "PROCESSING"
    SCORED = "SCORED"
    FAILED = "FAILED"