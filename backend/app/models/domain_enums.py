import enum

class UserRole(str, enum.Enum):
    PARTICIPANT = "PARTICIPANT"
    ADMIN = "ADMIN"

class LifecycleStatus(str, enum.Enum):
    DRAFT = "draft"
    SCHEDULED = "scheduled"
    ACTIVE = "active"
    PAUSED = "paused"
    ENDED = "ended"
    ARCHIVED = "archived"

class SubmissionStatus(str, enum.Enum):
    IN_PROGRESS = "in_progress"
    PROMPT1_SUBMITTED = "prompt1_submitted"
    FIRST_UPLOADED = "first_uploaded"
    PROMPT2_SUBMITTED = "prompt2_submitted"
    COMPLETED = "completed"
    SUBMITTED = "submitted"
    SCORED = "scored"
    REJECTED = "rejected"
    DISQUALIFIED = "disqualified"

class ScoringStatus(str, enum.Enum):
    PENDING = "pending"
    SCORED = "scored"
    FAILED = "failed"

class EvaluationStage(str, enum.Enum):
    FIRST = "FIRST"
    FINAL = "FINAL"
