"""MF processing-gain and delay-localisation tests."""

import numpy as np

from sonar.waveform import lfm_chirp
from sonar.matched_filter import matched_filter, mf_gain_dB


def test_mf_processing_gain():
    """MF processing gain equals 10 log10(B*tau) at critical sampling.

    Computed as (signal-only peak power) / (noise-only mean output power)
    divided by the input SNR. Separating signal and noise avoids any
    peak-of-a-noisy-signal bias.
    """
    rng = np.random.default_rng(0)
    B = 4_000.0
    tau = 0.05
    Fs = B  # critical sampling -> 10 log10(N) == 10 log10(B*tau)

    _, s = lfm_chirp(B, tau, Fs)
    n_chirp = s.size

    # signal-only MF response, peak picked analytically at the insertion sample
    x_sig = np.zeros(n_chirp * 4, dtype=np.complex128)
    x_sig[n_chirp : 2 * n_chirp] = s
    y_sig = matched_filter(x_sig, s)
    peak_pwr = float(np.max(np.abs(y_sig) ** 2))

    # noise-only MF response, mean output power averaged over a large buffer
    sigma2 = 1.0
    L = 300_000
    nz = (rng.standard_normal(L) + 1j * rng.standard_normal(L)) / np.sqrt(2.0)
    nz *= np.sqrt(sigma2)
    y_nz = matched_filter(nz, s)
    noise_floor = float(np.mean(np.abs(y_nz[n_chirp:]) ** 2))

    sig_pwr_in = float(np.mean(np.abs(s) ** 2))
    snr_in = sig_pwr_in / sigma2
    measured_gain = 10 * np.log10(peak_pwr / noise_floor / snr_in)
    expected_gain = mf_gain_dB(B, tau)

    assert abs(measured_gain - expected_gain) < 0.5, (
        f"MF gain {measured_gain:.2f} dB vs expected {expected_gain:.2f} dB"
    )


def test_mf_peak_localises_delay():
    """MF peak sits at the sample of the inserted delay (within 1 sample)."""
    B = 4_000.0
    tau = 0.02
    Fs = 40_000.0
    _, s = lfm_chirp(B, tau, Fs)

    delay_samples = 137  # arbitrary integer delay
    n_total = s.size + delay_samples + 100
    x = np.zeros(n_total, dtype=np.complex128)
    x[delay_samples : delay_samples + s.size] = s

    y = matched_filter(x, s)
    peak_idx = int(np.argmax(np.abs(y)))
    assert abs(peak_idx - delay_samples) <= 1, f"peak {peak_idx} vs delay {delay_samples}"
