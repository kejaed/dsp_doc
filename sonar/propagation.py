"""Step 2 — two-way propagation loss.

Spherical spreading + Thorp absorption. Frequencies in Hz, ranges in metres,
loss in dB re 1 m.
"""

from __future__ import annotations

import numpy as np


def thorp_absorption(f_hz: float | np.ndarray) -> np.ndarray:
    """Thorp absorption coefficient in dB/km for frequency f (Hz).

    alpha(f) = 0.11 f^2 / (1 + f^2) + 44 f^2 / (4100 + f^2)
             + 2.75e-4 f^2 + 0.003,   f in kHz
    """
    f_khz = np.asarray(f_hz, dtype=float) / 1e3
    f2 = f_khz * f_khz
    return (
        0.11 * f2 / (1.0 + f2)
        + 44.0 * f2 / (4100.0 + f2)
        + 2.75e-4 * f2
        + 0.003
    )


def transmission_loss(R_m: float | np.ndarray, fc_hz: float) -> np.ndarray:
    """One-way TL in dB: 20 log10(R) + alpha(fc) * R / 1000."""
    R = np.asarray(R_m, dtype=float)
    R = np.where(R <= 0, 1.0, R)  # avoid log(0); spherical spreading from 1 m
    alpha = thorp_absorption(fc_hz)
    return 20.0 * np.log10(R) + alpha * R * 1e-3


def two_way_loss(R_m: float | np.ndarray, fc_hz: float) -> np.ndarray:
    """Two-way TL = 2 * one-way TL (dB)."""
    return 2.0 * transmission_loss(R_m, fc_hz)
