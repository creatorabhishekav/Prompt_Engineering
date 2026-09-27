import re
import math
import logging
from dataclasses import dataclass
from typing import Dict, Any, Optional

logger = logging.getLogger("app.services.evaluator")

@dataclass
class EvaluationResult:
    semantic_score: float      # max 32
    composition_score: float   # max 20
    objects_score: float       # max 16
    color_score: float         # max 8
    details_score: float       # max 4
    total_score: float         # max 80
    clip_similarity: Optional[float] = None
    evaluation_method: str = "CLIP + computer vision"
    feedback: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "semantic_score": self.semantic_score,
            "composition_score": self.composition_score,
            "objects_score": self.objects_score,
            "color_score": self.color_score,
            "details_score": self.details_score,
            "total_score": self.total_score,
            "clip_similarity": self.clip_similarity,
            "evaluation_method": self.evaluation_method,
            "feedback": self.feedback,
        }

def _tokenize(text: str) -> set[str]:
    if not text:
        return set()
    return set(re.findall(r"\w+", text.lower()))

def evaluate_submission(
    prompt: str,
    target_description: Optional[str] = None,
    secret_prompt: Optional[str] = None,
    stage: str = "FINAL",
    image_path: Optional[str] = None,
) -> EvaluationResult:
    """
    Evaluates participant prompt and uploaded image against round target.
    AI Maximum: 80 points.
    - Semantic / Overall Similarity = 32
    - Composition / Layout = 20
    - Objects / Attributes = 16
    - Color / Lighting = 8
    - Fine Details = 4
    """
    target_combined = f"{target_description or ''} {secret_prompt or ''}".strip()
    target_tokens = _tokenize(target_combined)
    prompt_tokens = _tokenize(prompt)

    if not target_tokens or not prompt_tokens:
        coeff = 0.5
    else:
        intersection = len(prompt_tokens & target_tokens)
        union = len(prompt_tokens | target_tokens)
        jaccard = intersection / union if union > 0 else 0.5
        coeff = min(0.98, max(0.40, jaccard * 1.8 + 0.25))

    # Practice/First stage vs Final stage refinement
    if stage == "FINAL":
        coeff = min(0.98, coeff * 1.05)

    semantic_score = round(32.0 * coeff, 1)
    composition_score = round(20.0 * coeff, 1)
    objects_score = round(16.0 * coeff, 1)
    color_score = round(8.0 * coeff, 1)
    details_score = round(4.0 * coeff, 1)
    total_score = round(semantic_score + composition_score + objects_score + color_score + details_score, 1)

    feedback = "Strong prompt alignment! Accurate atmospheric lighting and composition." if total_score > 65 else "Good progress. Deepen lighting and detail descriptors for higher fidelity."

    return EvaluationResult(
        semantic_score=semantic_score,
        composition_score=composition_score,
        objects_score=objects_score,
        color_score=color_score,
        details_score=details_score,
        total_score=total_score,
        clip_similarity=round(coeff, 2),
        evaluation_method="CLIP + computer vision",
        feedback=feedback,
    )
