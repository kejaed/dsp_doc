"""Step 5 — additive noise."""

from __future__ import annotations

import numpy as np


def white_noise(
    n_samples: int,
    sigma: float = 1.0,
    rng: np.random.Generator | None = None,
) -> np.ndarray:
    """Complex circular Gaussian noise, sample standard deviation = sigma."""
    if rng is None:
        rng = np.random.default_rng()
    n = (rng.standard_normal(n_samples) + 1j * rng.standard_normal(n_samples)) / np.sqrt(2.0)
    return sigma * n


def noise_sigma_for_snr(signal_power: float, snr_dB: float) -> float:
    """Noise std-dev that yields the requested input SNR vs `signal_power`."""
    return np.sqrt(signal_power / 10.0 ** (snr_dB / 10.0))
