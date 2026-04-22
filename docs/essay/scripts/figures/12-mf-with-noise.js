// Figure 12 — Matched filtering with noise.
//
// Same setup as Figure 11, but the receiver now sees echo + Gaussian
// noise. Two stacked traces:
//   1) raw received signal — at low SNR you genuinely cannot see the
//      target by eye
//   2) MF output — the target reappears as a sharp peak even when the
//      raw signal looks like static.
// Slider: input SNR in dB.

import { mountCanvas } from "../core/canvas.js";
import { makeSlider } from "../core/slider.js";
import { lfmChirp, echo, xcorrFFT, magnitude, whiteNoise, addInPlace, C_WATER } from "../core/dsp.js";

const W = 720;
const ROW_H = 130;
const ROWS = 2;
const PAD = 30;
const H = ROW_H * ROWS + 50;

const FS = 4000;
const B_HZ = 600;
const TAU_S = 0.04;
const N_OUT = 512;
const FC = 0;

export function mount(root) {
  const { ctx } = mountCanvas(root, W, H);
  const controls = document.createElement("div");
  controls.className = "scene-controls";
  root.appendChild(controls);

  const range_axis_max_m = (N_OUT / FS) * C_WATER / 2;

  const state = { snrDB: -10, R0: range_axis_max_m * 0.55 };

  makeSlider(controls, {
    min: 50, max: range_axis_max_m * 0.95, value: state.R0, step: 1,
    label: "target range R₀", unit: " m",
    onInput: (v) => { state.R0 = v; redraw(); },
  });
  makeSlider(controls, {
    min: -25, max: 10, value: state.snrDB, step: 1,
    label: "input SNR", unit: " dB",
    onInput: (v) => { state.snrDB = v; redraw(); },
  });

  function rToX(R) { return PAD + (R / range_axis_max_m) * (W - 2 * PAD); }

  function redraw() {
    ctx.clearRect(0, 0, W, H);
    const chirp = lfmChirp(B_HZ, TAU_S, FS);
    const ech = echo({ chirp, R0: state.R0, fc: FC, Fs: FS, nOut: N_OUT, amplitude: 1 });

    // measure echo power (sum of squares over the echo's support)
    let pE = 0;
    for (let i = 0; i < N_OUT; i++) pE += ech.re[i] * ech.re[i] + ech.im[i] * ech.im[i];
    pE /= chirp.re.length;
    if (pE < 1e-12) pE = 1e-12;
    const sigma = Math.sqrt(pE / Math.pow(10, state.snrDB / 10));

    const nz = whiteNoise(N_OUT, sigma);
    const x = { re: ech.re.slice(), im: ech.im.slice() };
    addInPlace(x, nz);

    const mf = xcorrFFT(x, chirp);
    const mfMag = magnitude(mf);

    drawPanel(0, "received  echo + noise (real part)", "#1f5fa8", x.re, false);
    drawPanel(1, "matched-filter output  |y(t)|", "#cd3a2a", mfMag, true);

    // marker
    const xR0 = rToX(state.R0);
    ctx.strokeStyle = "rgba(0,0,0,0.45)";
    ctx.setLineDash([4, 3]);
    for (let r = 0; r < ROWS; r++) {
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

    // gain readout
    const gainDB = 10 * Math.log10(B_HZ * TAU_S);
    ctx.fillStyle = "rgba(0,0,0,0.7)";
    ctx.font = '12px -apple-system, sans-serif';
    ctx.fillText(`MF processing gain ≈ 10·log₁₀(Bτ) = ${gainDB.toFixed(1)} dB`,
      W - 320, 18);
  }

  function drawPanel(row, label, color, samples, isEnvelope) {
    const yTop = 30 + row * ROW_H;
    const yBot = yTop + ROW_H - 10;
    const yMid = (yTop + yBot) / 2;

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

    ctx.strokeStyle = color;
    ctx.lineWidth = isEnvelope ? 1.4 : 1.0;
    ctx.beginPath();
    for (let xi = 0; xi <= W - 2 * PAD; xi++) {
      const u = xi / (W - 2 * PAD);
      const i = Math.min(samples.length - 1, Math.floor(u * samples.length));
      const v = samples[i] / mx;
      const y = isEnvelope ? yBot - Math.max(0, v) * amp * 1.6
                            : yMid - v * amp;
      if (xi === 0) ctx.moveTo(PAD + xi, y);
      else ctx.lineTo(PAD + xi, y);
    }
    ctx.stroke();
  }

  redraw();
}
