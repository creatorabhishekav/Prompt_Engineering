from abc import ABC, abstractmethod
from dataclasses import dataclass, field


@dataclass
class GeneratedImage:
    url: str
    provider: str
    demo: bool = False
    prompt: str = field(default="")


class BaseAIProvider(ABC):
    """Abstraction over image-generation providers.

    Later phases add concrete providers (e.g. stable-diffusion, DALL·E,
    Together, Ideogram). The rest of the app depends only on this interface.
    """

    name: str = "base"

    def is_configured(self) -> bool:
        return True

    @abstractmethod
    def generate(self, prompt: str) -> GeneratedImage:
        raise NotImplementedError


class UnconfiguredProvider(BaseAIProvider):
    """Fallback used when a non-demo provider has no API key configured."""

    name = "unconfigured"

    def is_configured(self) -> bool:
        return False

    def generate(self, prompt: str) -> GeneratedImage:
        from app.services.ai.demo import DemoAIProvider

        return DemoAIProvider().generate(prompt)