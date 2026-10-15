"""
Fire-and-forget work (notifications, audit writes) that must not hold up the reply.

On hosts that throttle CPU once a response is sent (Google Cloud Run's default
request-based billing), a plain background thread can stall until the next
request arrives. BACKGROUND_WAIT_SECONDS lets the request wait briefly for the
work to finish while CPU is still allocated; anything slower carries on in the
background. 0 (the default) keeps pure fire-and-forget, as on Fly.io.
"""
import logging
import threading

from config import Config

logger = logging.getLogger("background")


def run(target, *args, **kwargs) -> None:
    def _safe():
        try:
            target(*args, **kwargs)
        except Exception as exc:
            logger.error("[BACKGROUND] %s failed: %s", getattr(target, "__name__", target), exc)

    thread = threading.Thread(target=_safe, daemon=True)
    thread.start()
    if Config.BACKGROUND_WAIT_SECONDS > 0:
        thread.join(timeout=Config.BACKGROUND_WAIT_SECONDS)
