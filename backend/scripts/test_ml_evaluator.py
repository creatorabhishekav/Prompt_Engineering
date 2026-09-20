import os
import sys
import argparse
from PIL import Image, ImageDraw

# Add backend directory to sys.path
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app.services.ml_image_similarity import get_ml_similarity_service
from app.services.evaluator import evaluate_submission

def create_sample_images():
    os.makedirs(os.path.join(backend_dir, "temp_test_images"), exist_ok=True)
    img1_path = os.path.join(backend_dir, "temp_test_images", "target_sample.png")
    img2_path = os.path.join(backend_dir, "temp_test_images", "uploaded_sample.png")

    # Target: Red rectangle with blue circle
    img1 = Image.new("RGB", (300, 300), color=(240, 240, 240))
    draw1 = ImageDraw.Draw(img1)
    draw1.rectangle([50, 50, 250, 250], fill=(220, 50, 50))
    draw1.ellipse([100, 100, 200, 200], fill=(50, 50, 220))
    img1.save(img1_path)

    # Uploaded: Similar red rectangle with slightly shifted blue circle
    img2 = Image.new("RGB", (300, 300), color=(240, 240, 240))
    draw2 = ImageDraw.Draw(img2)
    draw2.rectangle([55, 45, 245, 255], fill=(210, 60, 50))
    draw2.ellipse([110, 90, 210, 190], fill=(40, 60, 230))
    img2.save(img2_path)

    return img1_path, img2_path

def main():
    parser = argparse.ArgumentParser(description="Test CLIP ML Image Similarity Evaluator")
    parser.add_argument("--img1", help="Path to target image")
    parser.add_argument("--img2", help="Path to participant image")
    args = parser.parse_args()

    if args.img1 and args.img2:
        img1_path, img2_path = args.img1, args.img2
    else:
        print("Generating temporary test sample images...")
        img1_path, img2_path = create_sample_images()

    print(f"Target Image: {img1_path}")
    print(f"Uploaded Image: {img2_path}")

    # Test ML Singleton Direct Service
    print("\n--- Testing ML Image Similarity Service (Direct CLIP) ---")
    ml_service = get_ml_similarity_service()
    status = ml_service.get_status()
    print(f"Initial Status: {status}")

    img1 = Image.open(img1_path)
    img2 = Image.open(img2_path)
    raw_sim, calibrated_pct = ml_service.compare_images(img1, img2)

    status_after = ml_service.get_status()
    print(f"Status After Inference: {status_after}")
    print(f"Raw Cosine Similarity: {raw_sim:.4f}")
    print(f"Calibrated Visual Similarity %: {calibrated_pct:.2f}%")

    # Test Full Platform Evaluator
    print("\n--- Testing Full Reverse Prompt Engineering Evaluator (/80 Rubric) ---")
    eval_res = evaluate_submission(
        target_image_path=img1_path,
        uploaded_image_path=img2_path,
        participant_prompt="A red square background with a dark blue circular core on light backdrop",
        reference_prompt="Red rectangle containing blue circle in the center"
    )

    print(f"Total Score: {eval_res.total_score} / 80")
    print(f"Evaluation Method: {eval_res.evaluation_method}")
    print(f"CLIP Similarity %: {eval_res.clip_similarity:.2f}%")
    print("Rubric Breakdown:")
    print(f"  - Semantic Score:    {eval_res.semantic_score} / 32")
    print(f"  - Composition Score: {eval_res.composition_score} / 20")
    print(f"  - Objects Score:     {eval_res.objects_score} / 16")
    print(f"  - Color Score:       {eval_res.color_score} / 8")
    print(f"  - Details Score:     {eval_res.details_score} / 4")

if __name__ == "__main__":
    main()
