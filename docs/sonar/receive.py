"""Step 6 — receive conditioning (bandpass + quadrature demod).

Inputs are already at complex baseband for the rest of the chain, so the
"bandpass" here is implemented as a baseband lowpass that keeps the chirp
band [-B/2, +B/2]. The function still returns complex baseband; we expose the
filter and a "passband view" for plotting.
"""

from __future__ import annotations

import numpy as np
from scipy import signal


def baseband_filter(
    x: np.ndarray, Fs: float, B: float, numtaps: int = 129
) -> np.ndarray:
    """FIR lowpass that retains the chirp band at baseband.

    Uses direct convolution rather than fftconvolve: Pyodide's scipy
    (1.14) has a pathological memory overshoot on fftconvolve with long
    buffers that triggers "array is too big". np.convolve is O(N + M)
    and fast enough for a 129-tap FIR.
    """
    cutoff = min(0.49, max(B / Fs, 1e-3))
    h = signal.firwin(numtaps=numtaps, cutoff=cutoff, window="hamming")
    return np.convolve(x, h, mode="same")


def quadrature_demod(x_passband: np.ndarray, Fs: float, fc: float, B: float) -> np.ndarray:
    """Mix a real passband signal down to complex baseband and lowpass."""
    t = np.arange(x_passband.size) / Fs
    z = x_passband * np.exp(-2j * np.pi * fc * t)
    return baseband_filter(z, Fs, B)
