import logging
import threading
from typing import Tuple, Optional
import torch
from PIL import Image

try:
    from transformers import CLIPProcessor, CLIPModel
    HAS_TRANSFORMERS = True
except ImportError:
    HAS_TRANSFORMERS = False

logger = logging.getLogger("app.services.ml_image_similarity")

class MLImageSimilarityService:
    _instance: Optional["MLImageSimilarityService"] = None
    _lock = threading.Lock()

    def __init__(self, model_name: str = "openai/clip-vit-base-patch32"):
        self.model_name = model_name
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        self.processor = None
        self.model = None
        self.loaded = False
        self.load_error: Optional[str] = None
        self.inference_lock = threading.Lock()

    @classmethod
    def get_instance(cls) -> "MLImageSimilarityService":
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = cls()
        return cls._instance

    def load_model(self) -> bool:
        if self.loaded:
            return True
        if self.load_error:
            return False

        with self._lock:
            if self.loaded:
                return True
            if not HAS_TRANSFORMERS:
                self.load_error = "transformers package is not installed."
                return False

            try:
                logger.info(f"Loading CLIP model '{self.model_name}' on device '{self.device}'...")
                self.processor = CLIPProcessor.from_pretrained(self.model_name)
                self.model = CLIPModel.from_pretrained(self.model_name)
                self.model.to(self.device)
                self.model.eval()
                self.loaded = True
                logger.info(f"CLIP model '{self.model_name}' successfully loaded on '{self.device}'.")
                return True
            except Exception as e:
                logger.error(f"Failed to load CLIP model '{self.model_name}': {e}")
                self.load_error = str(e)
                self.loaded = False
                return False

    def get_image_embedding(self, image: Image.Image) -> torch.Tensor:
        """Extract L2-normalized image embedding using CLIP."""
        if not self.loaded:
            if not self.load_model():
                raise RuntimeError(f"CLIP model not loaded: {self.load_error}")

        if image.mode != "RGB":
            image = image.convert("RGB")

        inputs = self.processor(images=image, return_tensors="pt")
        pixel_values = inputs["pixel_values"].to(self.device)

        with torch.inference_mode():
            outputs = self.model.get_image_features(pixel_values)
            if hasattr(outputs, "image_embeds"):
                image_features = outputs.image_embeds
            elif hasattr(outputs, "pooler_output"):
                image_features = outputs.pooler_output
            else:
                image_features = outputs
            # L2 normalize
            normalized_features = image_features / image_features.norm(p=2, dim=-1, keepdim=True)

        return normalized_features

    def compare_images(self, target_image: Image.Image, participant_image: Image.Image) -> Tuple[float, float]:
        """Compute cosine similarity and calibrated visual similarity percentage (0-100).
        
        Bounded execution using inference_lock to ensure thread-safe single-inference pass.
        Returns: (raw_cosine_similarity, calibrated_similarity_pct)
        """
        with self.inference_lock:
            emb_target = self.get_image_embedding(target_image)
            emb_participant = self.get_image_embedding(participant_image)

            # Cosine similarity of normalized vectors is dot product
            raw_sim = torch.mm(emb_target, emb_participant.T).item()
            raw_sim = max(-1.0, min(1.0, float(raw_sim)))

            # Calibration: CLIP image-image cosine similarity for different natural images
            # typically ranges between 0.50 (completely unrelated) and 1.0 (identical image).
            # We map range [0.50, 1.0] deterministically to [0.0, 100.0] %.
            # Any raw_sim <= 0.50 maps to 0.0%.
            min_thresh = 0.50
            if raw_sim <= min_thresh:
                calibrated_pct = 0.0
            else:
                calibrated_pct = ((raw_sim - min_thresh) / (1.0 - min_thresh)) * 100.0
            
            calibrated_pct = max(0.0, min(100.0, float(calibrated_pct)))
            return raw_sim, round(calibrated_pct, 2)

    def get_status(self) -> dict:
        return {
            "mode": "ml",
            "model": self.model_name,
            "device": self.device,
            "loaded": self.loaded,
            "load_error": self.load_error,
        }

def get_ml_similarity_service() -> MLImageSimilarityService:
    return MLImageSimilarityService.get_instance()

