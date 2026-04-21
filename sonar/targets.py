"""Step 3 — point targets and their echoes."""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np

from .constants import C_WATER
from .propagation import transmission_loss


@dataclass(frozen=True)
class Target:
    R0_m: float       # range in metres
    v_mps: float      # radial velocity, +ve = receding
    TS_dB: float      # target strength in dB


def echo(
    s_baseband: np.ndarray,
    Fs: float,
    fc_hz: float,
    target: Target,
    SL_dB: float = 200.0,
    n_out: int | None = None,
) -> np.ndarray:
    """Single-pulse complex baseband echo from one point target.

    Models: round-trip delay tau_d = 2 R0 / c, narrow-band Doppler shift
    f_d = -2 v fc / c (negative for receding under our sign convention),
    amplitude SL - 2 TL + TS in dB.

    Returns an array of length n_out (defaults to a few times the pulse length).
    """
    n_in = s_baseband.size
    if n_out is None:
        n_out = max(n_in * 8, int(2 * target.R0_m / C_WATER * Fs) + n_in + 64)

    tau_d = 2.0 * target.R0_m / C_WATER
    delay_samples = tau_d * Fs

    out = np.zeros(n_out, dtype=np.complex128)
    i0 = int(np.floor(delay_samples))
    frac = delay_samples - i0
    if i0 >= n_out:
        return out

    # fractional-delay via FFT phase ramp on the chirp itself
    n = n_in
    S = np.fft.fft(s_baseband)
    k = np.fft.fftfreq(n, d=1.0)  # cycles/sample
    s_shift = np.fft.ifft(S * np.exp(-2j * np.pi * k * frac))

    # narrow-band Doppler at baseband: f_d relative to carrier
    fd = -2.0 * target.v_mps * fc_hz / C_WATER
    t_local = np.arange(n) / Fs
    s_dop = s_shift * np.exp(2j * np.pi * fd * t_local)

    # amplitude
    one_way_TL = transmission_loss(target.R0_m, fc_hz)
    amp_dB = SL_dB - 2.0 * one_way_TL + target.TS_dB
    amp = 10.0 ** (amp_dB / 20.0)

    end = min(i0 + n, n_out)
    out[i0:end] += amp * s_dop[: end - i0]
    return out
