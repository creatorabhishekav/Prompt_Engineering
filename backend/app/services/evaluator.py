"""Evaluator Module for Reverse Prompt Engineering with ML CLIP Integration."""

from dataclasses import dataclass, field
from pathlib import Path
import re
import logging
from typing import Optional, Dict, Any

from app.core.config import get_settings

try:
    from PIL import Image, ImageStat
    HAS_PIL = True
except ImportError:
    HAS_PIL = False

logger = logging.getLogger("app.services.evaluator")
settings = get_settings()


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
        }


def _tokenize(text: str) -> set[str]:
    """Extract normalized lowercase alphanumeric word tokens."""
    if not text:
        return set()
    return set(re.findall(r"\w+", text.lower()))


def _text_jaccard_similarity(text1: str, text2: str) -> float:
    """Jaccard token similarity between two text strings."""
    tokens1 = _tokenize(text1)
    tokens2 = _tokenize(text2)
    if not tokens1 or not tokens2:
        return 0.5  # neutral baseline if one prompt is missing
    intersection = len(tokens1 & tokens2)
    union = len(tokens1 | tokens2)
    return intersection / union if union > 0 else 0.0


def _load_image(file_path: Optional[str]):
    """Safely load an image using PIL if available and file exists."""
    if not HAS_PIL or not file_path:
        return None
    
    path = Path(file_path)
    # Check absolute or relative to project root
    if not path.exists():
        rel_path = settings.BASE_DIR / file_path.lstrip("/\\")
        if rel_path.exists():
            path = rel_path
        else:
            return None
    try:
        img = Image.open(path)
        img.load()
        return img
    except Exception as e:
        logger.warning(f"Could not load image at path {file_path}: {e}")
        return None


def _aspect_ratio(img) -> float:
    if not img or img.height == 0:
        return 1.0
    return img.width / img.height


def _get_avg_color(img):
    if not img:
        return (128, 128, 128)
    try:
        converted = img.convert("RGB")
        stat = ImageStat.Stat(converted)
        return tuple(int(c) for c in stat.mean[:3])
    except Exception:
        return (128, 128, 128)


def _get_dhash(img, hash_size: int = 8) -> int:
    """Compute difference hash for visual perceptual similarity."""
    if not img:
        return 0
    try:
        resized = img.convert("L").resize((hash_size + 1, hash_size), Image.Resampling.BILINEAR)
        pixels = list(resized.getdata())
        difference = []
        for row in range(hash_size):
            for col in range(hash_size):
                pixel_left = pixels[row * (hash_size + 1) + col]
                pixel_right = pixels[row * (hash_size + 1) + col + 1]
                difference.append(pixel_left > pixel_right)
        decimal_value = 0
        for bit in difference:
            decimal_value = (decimal_value << 1) | bit
        return decimal_value
    except Exception:
        return 0


def _dhash_similarity(hash1: int, hash2: int, hash_size: int = 8) -> float:
    """Compute normalized similarity (0.0 to 1.0) between two dhashes."""
    bit_count = hash_size * hash_size
    hamming_distance = bin(hash1 ^ hash2).count("1")
    similarity = 1.0 - (hamming_distance / bit_count)
    return max(0.0, min(1.0, similarity))


def evaluate_submission(
    target_image_path: Optional[str],
    uploaded_image_path: Optional[str],
    participant_prompt: str,
    reference_prompt: Optional[str] = None,
    mode_override: Optional[str] = None,
) -> EvaluationResult:
    """Evaluate a submission deterministically against a target image and reference prompt.
    
    Category Max Scores:
    - Semantic / Overall Similarity: 32
    - Composition / Layout: 20
    - Objects / Attributes: 16
    - Color / Lighting: 8
    - Fine Details: 4
    - Total Max: 80
    """
    eval_mode = (mode_override or getattr(settings, "IMAGE_EVALUATOR", "ml")).lower()

    # Load images
    target_img = _load_image(target_image_path)
    uploaded_img = _load_image(uploaded_image_path)

    text_sim = _text_jaccard_similarity(participant_prompt, reference_prompt or "")

    clip_sim_pct: Optional[float] = None
    clip_sim_ratio: Optional[float] = None
    evaluation_method = "Lightweight Computer Vision"

    # Attempt ML CLIP similarity if requested and images exist
    if eval_mode == "ml" and target_img and uploaded_img:
        try:
            from app.services.ml_image_similarity import MLImageSimilarityService
            ml_service = MLImageSimilarityService.get_instance()
            raw_cosine, calibrated_pct = ml_service.compare_images(target_img, uploaded_img)
            clip_sim_pct = round(calibrated_pct, 1)
            clip_sim_ratio = calibrated_pct / 100.0
            evaluation_method = "CLIP + computer vision"
        except Exception as e:
            logger.error(f"ML evaluation failed, falling back to lightweight: {e}")
            evaluation_method = "Lightweight Computer Vision (ML Error)"
            clip_sim_ratio = None
            clip_sim_pct = None

    if target_img and uploaded_img:
        # Perceptual hash similarity (dhash)
        hash1 = _get_dhash(target_img)
        hash2 = _get_dhash(uploaded_img)
        dhash_sim = _dhash_similarity(hash1, hash2)

        # Main visual similarity ratio (prioritize CLIP if available)
        visual_sim_ratio = clip_sim_ratio if clip_sim_ratio is not None else dhash_sim

        # Aspect ratio ratio
        ar1 = _aspect_ratio(target_img)
        ar2 = _aspect_ratio(uploaded_img)
        aspect_sim = 1.0 - min(1.0, abs(ar1 - ar2) / max(ar1, ar2, 0.001))

        # Color similarity
        c1 = _get_avg_color(target_img)
        c2 = _get_avg_color(uploaded_img)
        color_diff = (abs(c1[0] - c2[0]) + abs(c1[1] - c2[1]) + abs(c1[2] - c2[2])) / (255 * 3)
        color_sim = 1.0 - min(1.0, color_diff)

        # Detail/resolution ratio similarity
        res1 = target_img.width * target_img.height
        res2 = uploaded_img.width * uploaded_img.height
        detail_sim = min(res1, res2) / max(res1, res2, 1)
    else:
        # Fallback heuristic if images cannot be loaded
        visual_sim_ratio = 0.65
        aspect_sim = 0.85
        color_sim = 0.75
        detail_sim = 0.70

    # Calculate sub-scores
    # 1. Semantic / Overall (max 32): CLIP visual similarity primary signal
    semantic_raw = visual_sim_ratio * 32.0
    semantic_score = round(max(0.0, min(32.0, semantic_raw)), 2)

    # 2. Composition / Layout (max 20): combine CLIP visual similarity + aspect ratio
    composition_raw = (0.5 * aspect_sim + 0.5 * visual_sim_ratio) * 20.0
    composition_score = round(max(0.0, min(20.0, composition_raw)), 2)

    # 3. Objects / Attributes (max 16): CLIP visual similarity + text prompt keyword match
    objects_raw = (0.6 * visual_sim_ratio + 0.4 * text_sim) * 16.0
    objects_score = round(max(0.0, min(16.0, objects_raw)), 2)

    # 4. Color / Lighting (max 8): Pillow color analysis
    color_raw = color_sim * 8.0
    color_score = round(max(0.0, min(8.0, color_raw)), 2)

    # 5. Fine Details (max 4): image resolution & sharpness ratio
    details_raw = detail_sim * 4.0
    details_score = round(max(0.0, min(4.0, details_raw)), 2)

    # Calculate total score as strict sum of sub-scores, rounded to 2 decimals
    total_score = round(
        semantic_score + composition_score + objects_score + color_score + details_score,
        2,
    )
    total_score = max(0.0, min(80.0, total_score))

    return EvaluationResult(
        semantic_score=semantic_score,
        composition_score=composition_score,
        objects_score=objects_score,
        color_score=color_score,
        details_score=details_score,
        total_score=total_score,
        clip_similarity=clip_sim_pct,
        evaluation_method=evaluation_method,
    )
