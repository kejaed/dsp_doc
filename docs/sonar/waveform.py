"""Step 1 — transmit waveform (LFM chirp at complex baseband)."""

from __future__ import annotations

import numpy as np


def lfm_chirp(B: float, tau: float, Fs: float) -> tuple[np.ndarray, np.ndarray]:
    """Complex-baseband LFM chirp.

    s(t) = exp(j * pi * (B/tau) * t**2),   t in [0, tau)

    The instantaneous frequency sweeps from 0 to B over the pulse.
    """
    n = int(round(tau * Fs))
    t = np.arange(n) / Fs
    k = B / tau
    s = np.exp(1j * np.pi * k * t * t).astype(np.complex128)
    return t, s


def passband_chirp(B: float, tau: float, Fs: float, fc: float) -> tuple[np.ndarray, np.ndarray]:
    """Passband (real) version of the LFM chirp, centred on fc.

    Useful for plotting "what the transducer actually radiates".
    """
    t, s = lfm_chirp(B, tau, Fs)
    return t, np.real(s * np.exp(2j * np.pi * fc * t))
