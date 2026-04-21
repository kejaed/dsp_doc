"""Step 4 — diffuse reverberation.

Bottom/volume reverb modelled as a complex circular Gaussian process with an
exponentially decaying envelope and a flat spectrum across the chirp band.
"""

from __future__ import annotations

import numpy as np
from scipy import signal


def reverberation(
    n_samples: int,
    Fs: float,
    B: float,
    decay_tau_s: float = 0.4,
    rev_level: float = 1.0,
    rng: np.random.Generator | None = None,
) -> np.ndarray:
    """Generate one ping's worth of reverberation at complex baseband."""
    if rng is None:
        rng = np.random.default_rng()
    w = (rng.standard_normal(n_samples) + 1j * rng.standard_normal(n_samples)) / np.sqrt(2.0)

    # bandlimit to +/- B/2 around DC (chirp band, baseband). Use direct
    # convolution rather than fftconvolve — Pyodide's scipy (1.14) hits
    # an "array is too big" ceiling on the FFT-padded intermediate for
    # long buffers, while np.convolve only allocates O(N + M) and is
    # plenty fast for a 129-tap FIR.
    cutoff = min(0.49, max(B / Fs, 1e-3))
    h = signal.firwin(numtaps=129, cutoff=cutoff, window="hamming")
    w = np.convolve(w, h, mode="same")

    t = np.arange(n_samples) / Fs
    env = np.exp(-t / max(decay_tau_s, 1e-6))
    return rev_level * env * w
