"""DEMO/LOCAL Evaluator Module for Reverse Prompt Engineering.

Computes automated AI similarity scores out of 80 based on multiple visual
and textual comparison signals without external paid AI APIs.
"""

from dataclasses import dataclass
from pathlib import Path
import re
from typing import Optional

try:
    from PIL import Image, ImageStat
    HAS_PIL = True
except ImportError:
    HAS_PIL = False


@dataclass
class EvaluationResult:
    semantic_score: float     # max 32
    composition_score: float  # max 20
    objects_score: float      # max 16
    color_score: float        # max 8
    details_score: float      # max 4
    total_score: float        # max 80


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
    if not path.exists():
        return None
    try:
        img = Image.open(path)
        img.load()
        return img
    except Exception:
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
    # 1. Textual signal
    text_sim = _text_jaccard_similarity(participant_prompt, reference_prompt or "")

    # 2. Image loading
    target_img = _load_image(target_image_path)
    uploaded_img = _load_image(uploaded_image_path)

    if target_img and uploaded_img:
        # Perceptual hash similarity
        hash1 = _get_dhash(target_img)
        hash2 = _get_dhash(uploaded_img)
        visual_sim = _dhash_similarity(hash1, hash2)

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
        visual_sim = 0.65
        aspect_sim = 0.85
        color_sim = 0.75
        detail_sim = 0.70

    # Calculate sub-scores
    # Semantic: blend text & visual (max 32)
    semantic_raw = (0.55 * visual_sim + 0.45 * text_sim) * 32.0
    # Add small length incentive if prompt is detailed (>30 words)
    words_count = len(participant_prompt.split())
    prompt_bonus = min(2.0, words_count * 0.05) if words_count > 5 else 0.0
    semantic_score = round(max(0.0, min(32.0, semantic_raw + prompt_bonus)), 2)

    # Composition: aspect ratio + spatial hash (max 20)
    composition_raw = (0.6 * aspect_sim + 0.4 * visual_sim) * 20.0
    composition_score = round(max(0.0, min(20.0, composition_raw)), 2)

    # Objects / Attributes: text similarity + visual hash (max 16)
    objects_raw = (0.5 * text_sim + 0.5 * visual_sim) * 16.0
    objects_score = round(max(0.0, min(16.0, objects_raw)), 2)

    # Color / Lighting: color histogram/average similarity (max 8)
    color_raw = color_sim * 8.0
    color_score = round(max(0.0, min(8.0, color_raw)), 2)

    # Fine Details: perceptual resolution & sharpness similarity (max 4)
    details_raw = detail_sim * 4.0
    details_score = round(max(0.0, min(4.0, details_raw)), 2)

    # Calculate total score strictly as sum of components, capped at 80
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
    )
