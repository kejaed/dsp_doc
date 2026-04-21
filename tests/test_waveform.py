"""LFM instantaneous frequency recovered from analytic-signal phase derivative."""

import numpy as np

from sonar.waveform import lfm_chirp


def test_lfm_instantaneous_frequency():
    B = 4_000.0      # Hz
    tau = 0.05       # s
    Fs = 40_000.0    # Hz, ~5x B keeps the baseband well-sampled
    t, s = lfm_chirp(B, tau, Fs)

    # baseband instantaneous frequency from unwrapped phase
    phase = np.unwrap(np.angle(s))
    inst_freq = np.gradient(phase, 1.0 / Fs) / (2.0 * np.pi)

    # f(t) = (B/tau) * t at baseband
    expected = (B / tau) * t

    # check within 1% at midpoint (avoid endpoint edge effects)
    mid = len(t) // 2
    rel_err = abs(inst_freq[mid] - expected[mid]) / expected[mid]
    assert rel_err < 0.01, f"midpoint inst freq err = {rel_err:.4f}"
