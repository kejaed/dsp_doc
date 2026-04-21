"""CA-CFAR empirical Pfa converges to the design value."""

import numpy as np

from sonar.detection import ca_cfar_threshold


def test_cfar_pfa_converges():
    """Over ~1e6 noise-only cells, empirical Pfa tracks design within 20%."""
    rng = np.random.default_rng(0)
    N = 1_000_000
    design_pfa = 1e-3  # pick a rate that gives meaningful statistics at 1e6 cells

    # complex-Gaussian noise -> exponential power
    n = (rng.standard_normal(N) + 1j * rng.standard_normal(N)) / np.sqrt(2.0)
    power = np.abs(n) ** 2

    train, guard = 16, 2
    th, _ = ca_cfar_threshold(power, train=train, guard=guard, Pfa=design_pfa)
    edge = train + guard
    interior = slice(edge, N - edge)
    emp_pfa = float(np.mean(power[interior] > th[interior]))

    ratio = emp_pfa / design_pfa
    assert 0.8 < ratio < 1.2, f"empirical Pfa ratio {ratio:.3f} outside [0.8,1.2]"
