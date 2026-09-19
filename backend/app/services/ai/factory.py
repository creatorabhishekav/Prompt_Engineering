from app.core.config import get_settings
from app.services.ai.base import BaseAIProvider, UnconfiguredProvider
from app.services.ai.demo import DemoAIProvider

_real_providers: dict[str, type[BaseAIProvider]] = {}


def _register_provider(name: str, cls: type[BaseAIProvider]) -> None:
    _real_providers[name] = cls


def get_ai_provider() -> BaseAIProvider:
    """Return the configured AI provider for the current AI_MODE.

    demo (default) requires no API key and returns deterministic placeholders,
    so the application runs out of the box.
    """
    settings = get_settings()
    mode = (settings.AI_MODE or "").lower()
    provider_name = (settings.AI_PROVIDER or "").lower()

    if mode == "demo":
        return DemoAIProvider()

    if provider_name in _real_providers:
        provider = _real_providers[provider_name]()
        if settings.AI_API_KEY and provider.is_configured():
            return provider
        return UnconfiguredProvider()

    # Unknown or not implemented yet -> gracefully fall back to demo.
    return UnconfiguredProvider()