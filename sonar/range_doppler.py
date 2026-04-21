"""Step 9 — range/Doppler map from a stack of pulses."""

from __future__ import annotations

import numpy as np


def range_doppler_map(
    pulses: np.ndarray,  # shape (N_pulse, n_range), complex
    PRI: float,
    window: bool = True,
) -> tuple[np.ndarray, np.ndarray]:
    """FFT across slow time. Returns (rd_map_dB, doppler_freqs_Hz).

    `rd_map_dB` is shape (N_pulse, n_range), `doppler_freqs_Hz` is fftshifted.
    """
    N, _ = pulses.shape
    if window:
        w = np.hanning(N)[:, None]
    else:
        w = np.ones((N, 1))
    X = np.fft.fftshift(np.fft.fft(pulses * w, axis=0), axes=0)
    rd_dB = 20.0 * np.log10(np.abs(X) + 1e-12)
    f_d = np.fft.fftshift(np.fft.fftfreq(N, d=PRI))
    return rd_dB, f_d


def doppler_axis_velocity(f_d_Hz: np.ndarray, fc_hz: float, c: float = 1500.0) -> np.ndarray:
    """Convert Doppler frequency to radial velocity (m/s).  v = -c f_d / (2 fc)."""
    return -c * f_d_Hz / (2.0 * fc_hz)
