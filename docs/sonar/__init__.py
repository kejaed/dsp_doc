"""Textbook active-sonar DSP chain.

Each module implements one stage of the chain. The same code runs
under CPython for `pytest` and under Pyodide for the live report.
"""

from .constants import C_WATER
from . import (
    waveform,
    propagation,
    targets,
    reverberation,
    noise,
    receive,
    matched_filter,
    envelope,
    range_doppler,
    detection,
)

__all__ = [
    "C_WATER",
    "waveform",
    "propagation",
    "targets",
    "reverberation",
    "noise",
    "receive",
    "matched_filter",
    "envelope",
    "range_doppler",
    "detection",
]
