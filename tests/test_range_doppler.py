"""Doppler-bin localisation in the range/Doppler map."""

import numpy as np

from sonar.range_doppler import range_doppler_map


def test_doppler_bin_localisation():
    """A complex tone at f_d puts its peak at the expected Doppler bin (within 1)."""
    N_pulse = 64
    n_range = 32
    PRI = 0.1  # s -> 10 Hz Doppler bin width

    fd_true = 1.7  # Hz, deliberately not on a bin centre
    pulses = np.zeros((N_pulse, n_range), dtype=np.complex128)
    p = np.arange(N_pulse)
    tone = np.exp(2j * np.pi * fd_true * p * PRI)
    pulses[:, n_range // 2] = tone

    rd_dB, fd_axis = range_doppler_map(pulses, PRI, window=False)
    col = rd_dB[:, n_range // 2]
    peak_bin = int(np.argmax(col))
    expected_bin = int(np.argmin(np.abs(fd_axis - fd_true)))
    assert abs(peak_bin - expected_bin) <= 1, (
        f"peak bin {peak_bin} vs expected {expected_bin} (fd={fd_axis[peak_bin]:.2f})"
    )
