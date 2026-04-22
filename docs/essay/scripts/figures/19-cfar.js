// Figure 19 — CFAR (constant false-alarm rate).
//
// Same MF magnitude trace as the previous figure, but the threshold is
// no longer a single horizontal line — it's an *adaptive* curve that
// tracks the local noise level. For each cell, we estimate the noise
// from a ring of "training cells" (with a small "guard band" around
// the cell-under-test, so the cell itself doesn't pollute its own
// noise estimate) and multiply by alpha = N (Pfa^(-1/N) - 1) to get
// the threshold.
//
// Sliders: design Pfa (10^-6 .. 10^-2), training-cell width.

import { mountCanvas } from "../core/canvas.js";
import { makeSlider } from "../core/slider.js";
import {
  lfmChirp, echo, xcorrFFT, magnitude, whiteNoise, addInPlace, powerOf,
  caCfarThreshold, C_WATER,
} from "../core/dsp.js";

const W = 720;
const H = 280;
const PAD = 30;
const FS = 4000;
const B_HZ = 600;
const TAU_S = 0.04;
const N_OUT = 600;

export function mount(root) {
  const { ctx } = mountCanvas(root, W, H);
  const controls = document.createElement("div");
  controls.className = "scene-controls";
  root.appendChild(controls);

  const range_max_m = (N_OUT / FS) * C_WATER / 2;
  const state = {
    snrDB: -3,
    pfaLog: -4,            // 10^-4
    train: 16,
    R0: range_max_m * 0.55,
    scene: null,
    mxMF: 1,
  };

  function buildScene() {
    const chirp = lfmChirp(B_HZ, TAU_S, FS);
    const ech = echo({ chirp, R0: state.R0, fc: 0, Fs: FS, nOut: N_OUT, amplitude: 1 });
    let pE = 0;
    for (let i = 0; i < N_OUT; i++) pE += ech.re[i] * ech.re[i] + ech.im[i] * ech.im[i];
    pE /= chirp.re.length;
    if (pE < 1e-12) pE = 1e-12;
    const sigma = Math.sqrt(pE / Math.pow(10, state.snrDB / 10));
    const nz = whiteNoise(N_OUT, sigma);
    addInPlace(ech, nz);
    const mfMag = magnitude(xcorrFFT(ech, chirp));
    state.scene = mfMag;
    let mx = 0;
    for (let i = 0; i < N_OUT; i++) if (mfMag[i] > mx) mx = mfMag[i];
    state.mxMF = mx;
  }

  makeSlider(controls, {
    min: -15, max: 10, value: state.snrDB, step: 1,
    label: "input SNR", unit: " dB",
    onInput: (v) => { state.snrDB = v; buildScene(); redraw(); },
  });
  makeSlider(controls, {
    min: -6, max: -2, value: state.pfaLog, step: 0.5,
    label: "design Pfa", unit: "",
    format: (v) => `1e${v.toFixed(1)}`,
    onInput: (v) => { state.pfaLog = v; redraw(); },
  });
  makeSlider(controls, {
    min: 4, max: 40, value: state.train, step: 1,
    label: "training cells", unit: "",
    onInput: (v) => { state.train = v; redraw(); },
  });

  function rToX(R) { return PAD + (R / range_max_m) * (W - 2 * PAD); }

  function redraw() {
    ctx.clearRect(0, 0, W, H);
    if (!state.scene) buildScene();

    // panel
    ctx.fillStyle = "rgba(0,0,0,0.02)";
    ctx.fillRect(PAD, 26, W - 2 * PAD, H - 70);
    ctx.strokeStyle = "rgba(0,0,0,0.10)";
    ctx.strokeRect(PAD, 26, W - 2 * PAD, H - 70);

    const yTop = 30, yBot = H - 46;
    const amp = (yBot - yTop) - 4;
    const N = state.scene.length;
    const mx = state.mxMF;
    const mxPwr = mx * mx;

    // run CFAR on power
    const pwr = powerOf({ re: state.scene, im: new Float32Array(N) });
    const pfa = Math.pow(10, state.pfaLog);
    const { threshold } = caCfarThreshold(pwr, state.train, 2, pfa);

    // signal trace
    ctx.strokeStyle = "#1f5fa8";
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    for (let xi = 0; xi <= W - 2 * PAD; xi++) {
      const u = xi / (W - 2 * PAD);
      const i = Math.min(N - 1, Math.floor(u * N));
      const v = state.scene[i] / mx;
      const y = yBot - v * amp;
      if (xi === 0) ctx.moveTo(PAD + xi, y);
      else ctx.lineTo(PAD + xi, y);
    }
    ctx.stroke();

    // threshold curve (sqrt for amplitude axis)
    ctx.strokeStyle = "#cd3a2a";
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    for (let xi = 0; xi <= W - 2 * PAD; xi++) {
      const u = xi / (W - 2 * PAD);
      const i = Math.min(N - 1, Math.floor(u * N));
      const v = Math.sqrt(threshold[i]) / mx;
      const y = yBot - Math.min(1.05, v) * amp;
      if (xi === 0) ctx.moveTo(PAD + xi, y);
      else ctx.lineTo(PAD + xi, y);
    }
    ctx.stroke();

    // detections (where mag exceeds threshold curve) with target-vs-FA colour
    const targetIdx = Math.round((state.R0 / range_max_m) * N);
    const targetWindow = 8;
    let truthHit = false;
    let nFalse = 0;
    for (let i = 0; i < N; i++) {
      if (pwr[i] > threshold[i] && (i === 0 || pwr[i - 1] <= threshold[i - 1])) {
        const isTarget = Math.abs(i - targetIdx) < targetWindow;
        const x = PAD + (i / N) * (W - 2 * PAD);
        ctx.fillStyle = isTarget ? "#1f7f4a" : "#cd3a2a";
        ctx.beginPath();
        ctx.arc(x, yBot - (state.scene[i] / mx) * amp, 4, 0, Math.PI * 2);
        ctx.fill();
        if (isTarget) truthHit = true; else nFalse++;
      }
    }

    // training-cell illustration around the centre of the trace, just
    // for visual context — coloured ribbons showing where the CFAR is
    // pulling its noise estimate.
    const cx = PAD + ((W - 2 * PAD) / 2);
    const cellW = (W - 2 * PAD) / N;
    const guard = 2;
    ctx.fillStyle = "rgba(31, 95, 168, 0.10)";
    ctx.fillRect(cx - (state.train + guard) * cellW, H - 38, state.train * cellW, 6);
    ctx.fillRect(cx + guard * cellW, H - 38, state.train * cellW, 6);
    ctx.fillStyle = "rgba(31, 95, 168, 0.4)";
    ctx.fillRect(cx - 0.5, H - 38, 2, 6);
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.font = '10px -apple-system, sans-serif';
    ctx.fillText("← training cells →                                                                ← training cells →",
      cx - 280, H - 41);

    // dashed marker at true target range
    const xTarget = rToX(state.R0);
    ctx.strokeStyle = "rgba(0,0,0,0.4)";
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(xTarget, yTop); ctx.lineTo(xTarget, yBot);
    ctx.stroke();
    ctx.setLineDash([]);

    // axis
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.font = '11px -apple-system, sans-serif';
    for (let R = 0; R <= range_max_m; R += 25) {
      const x = rToX(R);
      ctx.fillRect(x, H - 42, 1, 4);
      if (R % 50 === 0) ctx.fillText(`${R}`, x - 8, H - 28);
    }
    ctx.fillText("range (m)", W - 60, H - 28);

    // verdict
    ctx.fillStyle = "#222";
    ctx.font = 'bold 12px -apple-system, sans-serif';
    ctx.fillText(
      `target: ${truthHit ? "DETECTED" : "MISSED"}    ·    false alarms: ${nFalse}    ·    Pfa = 10^${state.pfaLog.toFixed(1)}`,
      PAD + 4, 18
    );
  }

  buildScene();
  redraw();
}
