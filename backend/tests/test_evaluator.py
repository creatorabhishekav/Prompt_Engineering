from app.services.evaluator import evaluate_submission


def test_evaluator_bounds_and_sum():
    res = evaluate_submission(
        target_image_path=None,
        uploaded_image_path=None,
        participant_prompt="cyberpunk neon city in the rain with glowing signs",
        reference_prompt="cyberpunk neon city in the rain",
    )

    assert 0.0 <= res.semantic_score <= 32.0
    assert 0.0 <= res.composition_score <= 20.0
    assert 0.0 <= res.objects_score <= 16.0
    assert 0.0 <= res.color_score <= 8.0
    assert 0.0 <= res.details_score <= 4.0
    assert 0.0 <= res.total_score <= 80.0

    # Total must strictly equal sum of sub-scores
    expected_sum = round(
        res.semantic_score
        + res.composition_score
        + res.objects_score
        + res.color_score
        + res.details_score,
        2,
    )
    assert abs(res.total_score - expected_sum) < 0.01


def test_evaluator_reproducibility():
    res1 = evaluate_submission(
        target_image_path=None,
        uploaded_image_path=None,
        participant_prompt="test prompt for reproducibility",
        reference_prompt="test prompt for reproducibility",
    )

    res2 = evaluate_submission(
        target_image_path=None,
        uploaded_image_path=None,
        participant_prompt="test prompt for reproducibility",
        reference_prompt="test prompt for reproducibility",
    )

    assert res1.total_score == res2.total_score
