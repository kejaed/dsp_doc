// Figure 16 — Coherent integration.
//
// One figure with two stacked panels:
//   Top:  the receive trace from a single ping at user-set SNR. The
//         target peak is mostly buried.
//   Bot:  the *coherent average* of N consecutive matched-filter
//         outputs. As N grows, the target peak rises by 10 log10(N) dB
//         above the noise floor while its position stays fixed.
// Sliders: input SNR, N pulses (1, 4, 16, 64).

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

export function mount(root) {
  const { ctx } = mountCanvas(root, W, H);
  const controls = document.createElement("div");
  controls.className = "scene-controls";
  root.appendChild(controls);

  const range_max_m = (N_OUT / FS) * C_WATER / 2;

  const state = { snrDB: -15, R0: range_max_m * 0.55, N: 16 };

  makeSlider(controls, {
    min: -25, max: 5, value: state.snrDB, step: 1,
    label: "input SNR", unit: " dB",
    onInput: (v) => { state.snrDB = v; redraw(); },
  });
  makeSlider(controls, {
    min: 1, max: 64, value: state.N, step: 1,
    label: "N pulses", unit: "",
    onInput: (v) => { state.N = v; redraw(); },
  });

  function rToX(R) { return PAD + (R / range_max_m) * (W - 2 * PAD); }

  function redraw() {
    ctx.clearRect(0, 0, W, H);
    const chirp = lfmChirp(B_HZ, TAU_S, FS);

    // Build N independent noisy receive traces; same target on all,
    // independent noise realisations. Coherently sum them.
    let pE = 0;
    {
      const tmp = echo({ chirp, R0: state.R0, fc: 0, Fs: FS, nOut: N_OUT, amplitude: 1 });
      for (let i = 0; i < N_OUT; i++) pE += tmp.re[i] * tmp.re[i] + tmp.im[i] * tmp.im[i];
      pE /= chirp.re.length;
    }
    if (pE < 1e-12) pE = 1e-12;
    const sigma = Math.sqrt(pE / Math.pow(10, state.snrDB / 10));

    // Single-ping MF (top panel)
    {
      const ech = echo({ chirp, R0: state.R0, fc: 0, Fs: FS, nOut: N_OUT, amplitude: 1 });
      const nz = whiteNoise(N_OUT, sigma);
      const x = { re: ech.re.slice(), im: ech.im.slice() };
      addInPlace(x, nz);
      const mfMag = magnitude(xcorrFFT(x, chirp));
      drawTrace(0, "single-pulse MF output", "#888", mfMag);
    }

    // Coherent average of N MF outputs (bottom panel). For complex
    // signals we sum the *complex* MF outputs, then take magnitude —
    // that's the only way the noise actually decorrelates while the
    // signal phase stays put.
    const sumRe = new Float32Array(N_OUT);
    const sumIm = new Float32Array(N_OUT);
    for (let n = 0; n < state.N; n++) {
      const ech = echo({ chirp, R0: state.R0, fc: 0, Fs: FS, nOut: N_OUT, amplitude: 1 });
      const nz = whiteNoise(N_OUT, sigma);
      const x = { re: ech.re.slice(), im: ech.im.slice() };
      addInPlace(x, nz);
      const mf = xcorrFFT(x, chirp);
      for (let i = 0; i < N_OUT; i++) {
        sumRe[i] += mf.re[i];
        sumIm[i] += mf.im[i];
      }
    }
    const mfMagN = new Float32Array(N_OUT);
    for (let i = 0; i < N_OUT; i++) mfMagN[i] = Math.hypot(sumRe[i], sumIm[i]) / state.N;
    drawTrace(1, `coherent average of N = ${state.N} pulses`, "#cd3a2a", mfMagN);

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

    // axis ticks
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.font = '11px -apple-system, sans-serif';
    for (let R = 0; R <= range_max_m; R += 20) {
      const x = rToX(R);
      ctx.fillRect(x, H - 22, 1, 4);
      if (R % 40 === 0) ctx.fillText(`${R}`, x - 8, H - 8);
    }
    ctx.fillText("range (m)", W - 60, H - 8);

    // gain readout
    const gainDB = 10 * Math.log10(state.N);
    ctx.fillStyle = "rgba(0,0,0,0.7)";
    ctx.font = '12px -apple-system, sans-serif';
    ctx.fillText(`coherent integration gain  10·log₁₀ N  =  ${gainDB.toFixed(1)} dB`,
      W - 320, 18);
  }

  function drawTrace(row, label, color, samples) {
    const yTop = 30 + row * ROW_H;
    const yBot = yTop + ROW_H - 10;

    ctx.fillStyle = "rgba(0,0,0,0.02)";
    ctx.fillRect(PAD, yTop, W - 2 * PAD, ROW_H - 10);
    ctx.strokeStyle = "rgba(0,0,0,0.10)";
    ctx.strokeRect(PAD, yTop, W - 2 * PAD, ROW_H - 10);

    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.font = '11px -apple-system, sans-serif';
    ctx.fillText(label, PAD + 4, yTop + 12);

    let mx = 0;
    for (let i = 0; i < samples.length; i++) if (samples[i] > mx) mx = samples[i];
    if (mx < 1e-12) mx = 1;
    const amp = (yBot - yTop) * 0.7;

    ctx.strokeStyle = color;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    for (let xi = 0; xi <= W - 2 * PAD; xi++) {
      const u = xi / (W - 2 * PAD);
      const i = Math.min(samples.length - 1, Math.floor(u * samples.length));
      const v = samples[i] / mx;
      const y = yBot - v * amp;
      if (xi === 0) ctx.moveTo(PAD + xi, y); else ctx.lineTo(PAD + xi, y);
    }
    ctx.stroke();
  }

  redraw();
}
