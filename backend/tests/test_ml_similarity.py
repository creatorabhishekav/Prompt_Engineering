import os
import pytest
from unittest.mock import MagicMock, patch
from PIL import Image

from app.services.ml_image_similarity import MLImageSimilarityService, get_ml_similarity_service
from app.services.evaluator import evaluate_submission, EvaluationResult

@pytest.fixture
def sample_images():
    img1 = Image.new("RGB", (100, 100), color="red")
    img2 = Image.new("RGB", (100, 100), color="blue")
    return img1, img2

def test_singleton_pattern():
    s1 = get_ml_similarity_service()
    s2 = get_ml_similarity_service()
    assert s1 is s2
    assert isinstance(s1, MLImageSimilarityService)

def test_get_status():
    service = MLImageSimilarityService.get_instance()
    status = service.get_status()
    assert status["mode"] == "ml"
    assert status["model"] == "openai/clip-vit-base-patch32"
    assert "device" in status
    assert "loaded" in status

@patch.object(MLImageSimilarityService, "load_model", return_value=True)
def test_compare_images_mocked(mock_load, sample_images):
    img1, img2 = sample_images
    service = MLImageSimilarityService()
    service.loaded = True

    # Mock get_image_embedding to return synthetic normalized tensors
    import torch
    target_tensor = torch.tensor([[1.0, 0.0, 0.0]])
    participant_tensor = torch.tensor([[0.8, 0.6, 0.0]]) # Cosine similarity = 0.8

    with patch.object(service, "get_image_embedding", side_effect=[target_tensor, participant_tensor]):
        raw_sim, calibrated_pct = service.compare_images(img1, img2)
        assert raw_sim == pytest.approx(0.8, abs=1e-3)
        # Calibrated pct: (0.8 - 0.5) / 0.5 * 100 = 60.0%
        assert calibrated_pct == pytest.approx(60.0, abs=1e-1)

def test_fallback_lightweight_mode(tmp_path):
    img1_path = str(tmp_path / "img1.png")
    img2_path = str(tmp_path / "img2.png")
    Image.new("RGB", (50, 50), "white").save(img1_path)
    Image.new("RGB", (50, 50), "white").save(img2_path)

    res = evaluate_submission(
        target_image_path=img1_path,
        uploaded_image_path=img2_path,
        participant_prompt="test prompt",
        reference_prompt="test prompt",
        mode_override="lightweight"
    )

    assert isinstance(res, EvaluationResult)
    assert res.evaluation_method == "Lightweight Computer Vision"
    assert res.total_score >= 0.0 and res.total_score <= 80.0
