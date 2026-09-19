import base64
import hashlib
import urllib.parse

from app.services.ai.base import BaseAIProvider, GeneratedImage


class DemoAIProvider(BaseAIProvider):
    """Deterministic placeholder provider so the app runs without any API key."""

    name = "demo"

    def is_configured(self) -> bool:
        return True

    def generate(self, prompt: str) -> GeneratedImage:
        digest = hashlib.sha256(prompt.encode("utf-8")).hexdigest()

        c1 = f"#{digest[0:6]}"
        c2 = f"#{digest[6:12]}"
        cx = f"#{digest[12:18]}"
        angle = (int(digest[18:20], 16) * 8) % 360
        rows = 4 + (int(digest[20:22], 16) % 3)
        cols = 4 + (int(digest[22:24], 16) % 3)

        tile = ""
        for r in range(rows):
            for c in range(cols):
                off = (int(digest[(24 + ((r * cols + c) * 2)) % 62 : (24 + ((r * cols + c) * 2)) % 62 + 2], 16) % 40) - 20
                tile += f'<circle cx="{c*100+50+off}" cy="{r*100+50-off}" r="{18+off}" fill="{cx}" opacity="0.8"/>'

        svg = (
            f'<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" '
            f'viewBox="0 0 {cols*100} {rows*100}">'
            f'<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1" '
            f'gradientTransform="rotate({angle})">'
            f'<stop offset="0%" stop-color="{c1}"/>'
            f'<stop offset="100%" stop-color="{c2}"/>'
            f"</linearGradient></defs>"
            f'<rect width="100%" height="100%" fill="url(#g)"/>'
            f"{tile}"
            f"</svg>"
        )

        data_url = "data:image/svg+xml;base64," + base64.b64encode(svg.encode("utf-8")).decode("ascii")
        preview = prompt if len(prompt) <= 400 else f"{prompt[:397]}..."
        return GeneratedImage(url=data_url, provider=self.name, demo=True, prompt=preview)