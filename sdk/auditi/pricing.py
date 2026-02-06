"""
Pricing manager for LLM cost calculation.

Supports three pricing sources in priority order:
1. User overrides (configured via configure_pricing)
2. Remote pricing from Auditi API
3. Hardcoded defaults (from each provider)
"""

from typing import Dict, Optional, Tuple

# Type alias for pricing: (input_price_per_1M, output_price_per_1M)
PricingTuple = Tuple[float, float]


class PricingManager:
    """
    Manages model pricing with support for user overrides and remote pricing.
    """

    def __init__(self):
        self._base_url: Optional[str] = None
        self._overrides: Dict[str, Dict[str, PricingTuple]] = {}
        self._remote_cache: Dict[str, PricingTuple] = {}

    def set_base_url(self, base_url: str) -> None:
        """Set the base URL for remote pricing API lookups."""
        self._base_url = base_url

    def get_pricing(
        self,
        provider: str,
        model: str,
        default: PricingTuple = (0.0, 0.0),
    ) -> PricingTuple:
        """
        Get pricing for a provider/model combination.

        Priority: user override > remote cache > default

        Args:
            provider: Provider name (e.g., 'openai', 'anthropic')
            model: Model name (e.g., 'gpt-4o')
            default: Fallback pricing tuple (input_price, output_price) per 1M tokens

        Returns:
            Tuple of (input_price, output_price) per 1M tokens in USD
        """
        # 1. Check user overrides
        provider_overrides = self._overrides.get(provider, {})
        if model in provider_overrides:
            return provider_overrides[model]

        # 2. Check remote cache
        cache_key = f"{provider}:{model}"
        if cache_key in self._remote_cache:
            return self._remote_cache[cache_key]

        # 3. Return default
        return default

    def set_override(self, provider: str, model: str, pricing: PricingTuple) -> None:
        """
        Set a user override for a specific provider/model.

        Args:
            provider: Provider name
            model: Model name
            pricing: Tuple of (input_price, output_price) per 1M tokens in USD
        """
        if provider not in self._overrides:
            self._overrides[provider] = {}
        self._overrides[provider][model] = pricing


# Singleton instance
_pricing_manager: Optional[PricingManager] = None


def get_pricing_manager() -> PricingManager:
    """Get or create the singleton PricingManager instance."""
    global _pricing_manager
    if _pricing_manager is None:
        _pricing_manager = PricingManager()
    return _pricing_manager


def configure_pricing(overrides: Optional[Dict[str, Dict[str, PricingTuple]]] = None) -> PricingManager:
    """
    Configure pricing with optional user overrides.

    Args:
        overrides: Nested dict of {provider: {model: (input_price, output_price)}}

    Returns:
        The configured PricingManager instance

    Example:
        >>> configure_pricing({
        ...     "openai": {"gpt-4o": (2.50, 10.00)},
        ...     "anthropic": {"claude-3-5-sonnet-20241022": (3.00, 15.00)},
        ... })
    """
    manager = get_pricing_manager()
    if overrides:
        for provider, models in overrides.items():
            for model, pricing in models.items():
                manager.set_override(provider, model, pricing)
    return manager
