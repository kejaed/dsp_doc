"""Step 7 — matched filter (FFT cross-correlation with the chirp replica)."""

from __future__ import annotations

import numpy as np


def matched_filter(x: np.ndarray, replica: np.ndarray) -> np.ndarray:
    """Output of MF = correlation of x with replica (length len(x) + len(replica) - 1).

    Implementation: y[n] = sum_k x[n+k] conj(replica[k]).
    """
    n = x.size + replica.size - 1
    nfft = 1 << int(np.ceil(np.log2(n)))
    X = np.fft.fft(x, nfft)
    H = np.conj(np.fft.fft(replica, nfft))
    y = np.fft.ifft(X * H)[:n]
    # align peak so that index k corresponds to delay k samples
    return y[: x.size]


def mf_gain_dB(B: float, tau: float) -> float:
    """Theoretical processing gain of an MF for a TBP = B*tau pulse."""
    return 10.0 * np.log10(max(B * tau, 1e-12))
