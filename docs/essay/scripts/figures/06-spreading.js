// Figure 6 — Spreading and absorption.
//
// One curve: echo amplitude (in dB relative to 1 m) against range,
// from 10 m to 10 km. Two contributions to the loss:
//   - spherical spreading: 20 log10 R
//   - Thorp absorption:    α(f) · R / 1000  dB/km
// Slider: carrier frequency. As frequency rises, the absorption term
// dominates and the curve bends down faster — that's why ASW sonars
// pick lower frequencies than fish-finders.

import { mountCanvas } from "../core/canvas.js";
import { makeSlider } from "../core/slider.js";
import { transmissionLossDb, thorpDbPerKm } from "../core/dsp.js";

const W = 720;
const H = 280;
const PAD_L = 60;
const PAD_R = 24;
const PAD_T = 18;
const PAD_B = 40;
const PLOT_W = W - PAD_L - PAD_R;
const PLOT_H = H - PAD_T - PAD_B;

const R_MIN = 10;
const R_MAX = 10000;
const TL_MIN = 0;
const TL_MAX = 220;

export function mount(root) {
  const { ctx } = mountCanvas(root, W, H);
  const controls = document.createElement("div");
  controls.className = "scene-controls";
  root.appendChild(controls);

  const state = { fHz: 5000 };

  makeSlider(controls, {
    min: 1000, max: 100000, value: state.fHz, step: 500,
    label: "frequency", unit: " Hz",
    format: (v) => `${(v / 1000).toFixed(1)} kHz`,
    onInput: (v) => { state.fHz = v; redraw(); },
  });

  function rToX(R) {
    const u = (Math.log10(R) - Math.log10(R_MIN)) /
              (Math.log10(R_MAX) - Math.log10(R_MIN));
    return PAD_L + u * PLOT_W;
  }
  function tlToY(tl) {
    const u = (tl - TL_MIN) / (TL_MAX - TL_MIN);
    return PAD_T + (1 - u) * PLOT_H;
  }

  function redraw() {
    ctx.clearRect(0, 0, W, H);

    // gridlines (decade x, every 40 dB y)
    ctx.strokeStyle = "rgba(0,0,0,0.08)";
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.font = '11px -apple-system, sans-serif';
    ctx.lineWidth = 1;
    for (const R of [10, 100, 1000, 10000]) {
      const x = rToX(R);
      ctx.beginPath();
      ctx.moveTo(x, PAD_T);
      ctx.lineTo(x, PAD_T + PLOT_H);
      ctx.stroke();
      ctx.fillText(R >= 1000 ? `${R/1000} km` : `${R} m`, x - 16, PAD_T + PLOT_H + 14);
    }
    for (let tl = TL_MIN; tl <= TL_MAX; tl += 40) {
      const y = tlToY(tl);
      ctx.beginPath();
      ctx.moveTo(PAD_L, y);
      ctx.lineTo(PAD_L + PLOT_W, y);
      ctx.stroke();
      ctx.fillText(`${tl}`, PAD_L - 28, y + 4);
    }

    // axes
    ctx.strokeStyle = "rgba(0,0,0,0.3)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(PAD_L, PAD_T);
    ctx.lineTo(PAD_L, PAD_T + PLOT_H);
    ctx.lineTo(PAD_L + PLOT_W, PAD_T + PLOT_H);
    ctx.stroke();

    // labels
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillText("range (log scale)", PAD_L + PLOT_W / 2 - 40, H - 8);
    ctx.save();
    ctx.translate(14, PAD_T + PLOT_H / 2 + 60);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText("transmission loss (dB)", 0, 0);
    ctx.restore();

    // spreading-only baseline (cool grey for reference)
    ctx.strokeStyle = "rgba(0,0,0,0.35)";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    for (let xi = 0; xi <= PLOT_W; xi++) {
      const u = xi / PLOT_W;
      const R = R_MIN * Math.pow(R_MAX / R_MIN, u);
      const tl = 20 * Math.log10(R);
      const y = tlToY(tl);
      if (xi === 0) ctx.moveTo(PAD_L + xi, y);
      else ctx.lineTo(PAD_L + xi, y);
    }
    ctx.stroke();
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillText("spherical spreading only (20 log R)",
      PAD_L + PLOT_W * 0.55, tlToY(20 * Math.log10(R_MAX * 0.4)) - 4);

    // total TL with absorption (the hot curve, slider-driven)
    ctx.strokeStyle = "#cd3a2a";
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let xi = 0; xi <= PLOT_W; xi++) {
      const u = xi / PLOT_W;
      const R = R_MIN * Math.pow(R_MAX / R_MIN, u);
      const tl = transmissionLossDb(R, state.fHz);
      const y = tlToY(Math.min(tl, TL_MAX));
      if (xi === 0) ctx.moveTo(PAD_L + xi, y);
      else ctx.lineTo(PAD_L + xi, y);
    }
    ctx.stroke();

    // readout
    ctx.fillStyle = "#222";
    ctx.font = '13px -apple-system, sans-serif';
    const a = thorpDbPerKm(state.fHz);
    ctx.fillText(
      `f = ${(state.fHz / 1000).toFixed(1)} kHz   →   α(f) = ${a.toFixed(2)} dB/km`,
      PAD_L + 8, PAD_T + 16
    );
  }

  redraw();
}
