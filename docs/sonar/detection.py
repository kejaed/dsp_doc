"""Step 10 — cell-averaging CFAR detection."""

from __future__ import annotations

import numpy as np


def ca_cfar_threshold(
    power: np.ndarray,
    train: int = 16,
    guard: int = 2,
    Pfa: float = 1e-4,
) -> tuple[np.ndarray, float]:
    """1-D cell-averaging CFAR.

    `power` is non-negative (e.g. |MF output|^2). Returns the per-cell
    threshold and the alpha multiplier used.

    For exponential noise (square-law detection of complex Gaussian noise),
    alpha = N (Pfa^(-1/N) - 1) where N = 2 * train.
    """
    N = 2 * train
    alpha = N * (Pfa ** (-1.0 / N) - 1.0)

    # Build a kernel that averages N training cells and skips the guard band.
    L = 2 * (train + guard) + 1
    kernel = np.zeros(L)
    kernel[:train] = 1.0
    kernel[-train:] = 1.0
    kernel /= N

    # Same-length convolution; edges fall back to the global mean of `power`.
    avg = np.convolve(power, kernel, mode="same")
    edge = np.mean(power)
    edge_w = train + guard
    avg[:edge_w] = edge
    avg[-edge_w:] = edge

    return alpha * avg, alpha


def detect(power: np.ndarray, threshold: np.ndarray) -> np.ndarray:
    """Boolean detection mask: power exceeds threshold."""
    return power > threshold


def empirical_pfa(noise_only: np.ndarray, train: int, guard: int, Pfa: float) -> float:
    """Empirical false-alarm rate of CA-CFAR over a noise-only sample."""
    th, _ = ca_cfar_threshold(noise_only, train=train, guard=guard, Pfa=Pfa)
    edge = train + guard
    interior = slice(edge, noise_only.size - edge)
    return float(np.mean(noise_only[interior] > th[interior]))


def roc_curve(
    snr_dB_range: np.ndarray, n_pulses: int = 1
) -> tuple[np.ndarray, np.ndarray]:
    """Closed-form ROC for non-fluctuating target in CA-CFAR-limited noise.

    Pd as a function of input SNR for a fixed Pfa = 1e-4 and N=32 reference cells.
    Uses the standard expression Pd = (1 + alpha / (1+SNR))^{-N}.
    """
    Pfa = 1e-4
    N = 32
    alpha = N * (Pfa ** (-1.0 / N) - 1.0)
    snr = 10.0 ** (snr_dB_range / 10.0) * n_pulses
    pd = (1.0 + alpha / (1.0 + snr)) ** (-N)
    return snr_dB_range, pd
