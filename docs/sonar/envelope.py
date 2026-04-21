"""Step 8 — envelope detection and time-varying gain."""

from __future__ import annotations

import numpy as np

from .constants import C_WATER
from .propagation import transmission_loss


def envelope_dB(x: np.ndarray, eps: float = 1e-12) -> np.ndarray:
    """20 log10 |x|, floored to avoid -inf."""
    return 20.0 * np.log10(np.abs(x) + eps)


def tvg(env_dB: np.ndarray, Fs: float, fc_hz: float) -> np.ndarray:
    """Add one-way TL back along the range axis.

    Index n corresponds to round-trip time n/Fs and range R = c n / (2 Fs).
    We compensate for one-way spreading + absorption (a common operational
    convention; matches "20 log R" TVG).
    """
    n = env_dB.size
    t = np.arange(n) / Fs
    R = np.maximum(C_WATER * t / 2.0, 1.0)
    return env_dB + transmission_loss(R, fc_hz)
