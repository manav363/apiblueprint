"""Optional error-tracking and metrics wiring.

Sentry is opt-in: it only initializes when ``SENTRY_DSN`` is set, and the SDK
import is guarded so the app still runs if ``sentry-sdk`` isn't installed (e.g.
in the lightweight test environment).
"""

from .config import settings
from .logging import get_logger

logger = get_logger("observability")


def init_sentry() -> bool:
    """Initialize Sentry if a DSN is configured. Returns True when enabled."""
    if not settings.SENTRY_DSN:
        return False
    try:
        import sentry_sdk
    except ImportError:
        logger.warning("sentry_dsn_set_but_sdk_missing", hint="pip install 'sentry-sdk[fastapi]'")
        return False

    sentry_sdk.init(
        dsn=settings.SENTRY_DSN,
        environment=settings.ENVIRONMENT,
        traces_sample_rate=settings.SENTRY_TRACES_SAMPLE_RATE,
        release="apiblueprint@1.0.0",
    )
    logger.info("sentry_initialized", environment=settings.ENVIRONMENT)
    return True
