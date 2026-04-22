// Figure 11 — The matched filter (the moment).
//
// Three stacked traces in one canvas:
//   1) the transmit chirp (the "reference")
//   2) the received echo from a single target — a delayed copy of the
//      same chirp
//   3) the matched-filter output: cross-correlation of (2) with (1).
//      A long, smeared chirp turns into a single sharp peak at the
//      echo's true delay.
// Slider: target range R0. Drag it; the echo slides, the MF peak
// follows it.

import { mountCanvas } from "../core/canvas.js";
import { makeSlider } from "../core/slider.js";
import { lfmChirp, echo, xcorrFFT, magnitude, C_WATER } from "../core/dsp.js";

const W = 720;
const ROW_H = 90;
const ROWS = 3;
const PAD = 30;
const H = ROW_H * ROWS + 50;

// chirp + sample-rate parameters used everywhere in the essay's MF
// figures. Numbers picked so the chirp is ~tens of samples long, fast
// to FFT, and the time axis maps to ~1 km of range.
const FS = 4000;            // Hz
const B_HZ = 600;
const TAU_S = 0.04;         // 40 ms — long pulse
const FC = 0;               // baseband — we plot real part of complex echo
const N_OUT = 512;          // total receive buffer length (=> ~96 m of range)

export function mount(root) {
  const { ctx } = mountCanvas(root, W, H);
  const controls = document.createElement("div");
  controls.className = "scene-controls";
  root.appendChild(controls);

  const range_axis_max_m = (N_OUT / FS) * C_WATER / 2;

  const state = { R0: range_axis_max_m * 0.55 };

  makeSlider(controls, {
    min: 10, max: range_axis_max_m * 0.95, value: state.R0, step: 1,
    label: "target range R₀", unit: " m",
    onInput: (v) => { state.R0 = v; redraw(); },
  });

  function rToX(R) { return PAD + (R / range_axis_max_m) * (W - 2 * PAD); }

  function redraw() {
    ctx.clearRect(0, 0, W, H);
    const chirp = lfmChirp(B_HZ, TAU_S, FS);
    const ech = echo({ chirp, R0: state.R0, fc: FC, Fs: FS, nOut: N_OUT, amplitude: 0.6 });
    const mf = xcorrFFT(ech, chirp);
    const mfMag = magnitude(mf);

    // Row 1: reference chirp (real part), drawn in its own time slot
    drawTrace(ctx, 0, "transmit chirp (reference)",
      "#1f5fa8", chirp.re, chirp.re.length / FS, false);

    // Row 2: received echo (real part), full receive buffer
    drawTrace(ctx, 1, "received echo (raw)",
      "#1f5fa8", ech.re, N_OUT / FS, true);

    // Row 3: |MF output| over the same receive buffer
    drawTrace(ctx, 2, "matched-filter output  |y(t)|",
      "#cd3a2a", mfMag, N_OUT / FS, true);

    // marker on rows 2 & 3 at the true target's delay
    const xR0 = rToX(state.R0);
    ctx.strokeStyle = "rgba(0,0,0,0.45)";
    ctx.setLineDash([4, 3]);
    for (let r = 1; r < ROWS; r++) {
      const yTop = 30 + r * ROW_H;
      ctx.beginPath();
      ctx.moveTo(xR0, yTop);
      ctx.lineTo(xR0, yTop + ROW_H - 10);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // range axis at bottom
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.font = '11px -apple-system, sans-serif';
    for (let R = 0; R <= range_axis_max_m; R += 20) {
      const x = rToX(R);
      ctx.fillRect(x, H - 22, 1, 4);
      if (R % 40 === 0) ctx.fillText(`${R}`, x - 8, H - 8);
    }
    ctx.fillText("range (m)", W - 60, H - 8);
  }

  function drawTrace(ctx, row, label, color, samples, useReceiveAxis, isMag) {
    const yTop = 30 + row * ROW_H;
    const yBot = yTop + ROW_H - 10;
    const yMid = (yTop + yBot) / 2;

    // panel background
    ctx.fillStyle = "rgba(0,0,0,0.02)";
    ctx.fillRect(PAD, yTop, W - 2 * PAD, ROW_H - 10);
    ctx.strokeStyle = "rgba(0,0,0,0.10)";
    ctx.strokeRect(PAD, yTop, W - 2 * PAD, ROW_H - 10);

    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.font = '11px -apple-system, sans-serif';
    ctx.fillText(label, PAD + 4, yTop + 12);

    let mx = 0;
    for (let i = 0; i < samples.length; i++) {
      const v = Math.abs(samples[i]);
      if (v > mx) mx = v;
    }
    if (mx < 1e-12) mx = 1;
    const amp = (yBot - yTop) * 0.42;
    const isEnvelope = label.startsWith("matched-filter");

    ctx.strokeStyle = color;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    if (useReceiveAxis) {
      // sample i ↔ receive time i/FS ↔ range C*t/2
      for (let xi = 0; xi <= W - 2 * PAD; xi++) {
        const u = xi / (W - 2 * PAD);
        const i = Math.min(samples.length - 1, Math.floor(u * samples.length));
        const v = samples[i] / mx;
        const y = isEnvelope ? yBot - Math.max(0, v) * amp * 1.6
                              : yMid - v * amp;
        if (xi === 0) ctx.moveTo(PAD + xi, y);
        else ctx.lineTo(PAD + xi, y);
      }
    } else {
      // chirp on its own time axis; squeeze it into the panel
      for (let xi = 0; xi <= W - 2 * PAD; xi++) {
        const u = xi / (W - 2 * PAD);
        const i = Math.min(samples.length - 1, Math.floor(u * samples.length));
        const v = samples[i] / mx;
        const y = yMid - v * amp;
        if (xi === 0) ctx.moveTo(PAD + xi, y);
        else ctx.lineTo(PAD + xi, y);
      }
    }
    ctx.stroke();
  }

  redraw();
}
