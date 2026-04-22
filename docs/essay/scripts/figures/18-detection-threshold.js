// Figure 18 — Detection threshold.
//
// One-dimensional MF magnitude trace with a draggable horizontal
// threshold line. Reader drags it up and down with the slider; the
// figure live-counts how many "true detections" (the inserted target)
// and how many "false alarms" (other peaks above the line) we get.
// The plot makes the missed-detection / false-alarm tradeoff
// visceral.

import { mountCanvas, clamp } from "../core/canvas.js";
import { makeSlider } from "../core/slider.js";
import { lfmChirp, echo, xcorrFFT, magnitude, whiteNoise, addInPlace, C_WATER } from "../core/dsp.js";

const W = 720;
const H = 280;
const PAD = 30;
const FS = 4000;
const B_HZ = 600;
const TAU_S = 0.04;
const N_OUT = 600;

export function mount(root) {
  const { ctx, canvas } = mountCanvas(root, W, H);
  const controls = document.createElement("div");
  controls.className = "scene-controls";
  root.appendChild(controls);

  const range_max_m = (N_OUT / FS) * C_WATER / 2;

  // Pre-build a single fixed receive scene so the threshold slider
  // doesn't reroll noise each move (which would make the figure feel
  // jittery). We do recompute when the SNR slider changes.
  const state = { snrDB: -3, threshFrac: 0.5, scene: null, mxMF: 1, R0: range_max_m * 0.55 };

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
    let mx = 0;
    for (let i = 0; i < N_OUT; i++) if (mfMag[i] > mx) mx = mfMag[i];
    state.scene = mfMag;
    state.mxMF = mx;
  }

  makeSlider(controls, {
    min: -15, max: 10, value: state.snrDB, step: 1,
    label: "input SNR", unit: " dB",
    onInput: (v) => { state.snrDB = v; buildScene(); redraw(); },
  });
  makeSlider(controls, {
    min: 0.05, max: 1.2, value: state.threshFrac, step: 0.01,
    label: "threshold", unit: "",
    format: (v) => v.toFixed(2),
    onInput: (v) => { state.threshFrac = v; redraw(); },
  });

  function rToX(R) { return PAD + (R / range_max_m) * (W - 2 * PAD); }

  function redraw() {
    ctx.clearRect(0, 0, W, H);
    if (!state.scene) buildScene();

    ctx.fillStyle = "rgba(0,0,0,0.02)";
    ctx.fillRect(PAD, 26, W - 2 * PAD, H - 70);
    ctx.strokeStyle = "rgba(0,0,0,0.10)";
    ctx.strokeRect(PAD, 26, W - 2 * PAD, H - 70);

    const yTop = 30, yBot = H - 46;
    const amp = (yBot - yTop) - 4;
    const N = state.scene.length;
    const mx = state.mxMF;

    // bars below threshold: grey; above threshold + at target cell: green;
    // above threshold elsewhere: red (false alarms).
    const targetIdx = Math.round((state.R0 / range_max_m) * N);
    const targetWindow = 8;   // a few bins of "true" target neighbourhood
    const thresh = state.threshFrac * mx;

    let nTrue = 0, nFalse = 0;
    let truthHit = false;
    // Plot the trace
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

    // mark exceedances above threshold
    for (let i = 0; i < N; i++) {
      if (state.scene[i] > thresh && (i === 0 || state.scene[i - 1] <= thresh)) {
        const isTarget = Math.abs(i - targetIdx) < targetWindow;
        const x = PAD + (i / N) * (W - 2 * PAD);
        ctx.fillStyle = isTarget ? "#1f7f4a" : "#cd3a2a";
        ctx.beginPath();
        ctx.arc(x, yBot - (state.scene[i] / mx) * amp, 4, 0, Math.PI * 2);
        ctx.fill();
        if (isTarget) { truthHit = true; }
        else nFalse += 1;
      }
    }
    if (truthHit) nTrue = 1;

    // threshold line
    const yT = yBot - state.threshFrac * amp;
    ctx.strokeStyle = "#222";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(PAD, yT);
    ctx.lineTo(W - PAD, yT);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "#222";
    ctx.font = '12px -apple-system, sans-serif';
    ctx.fillText(`threshold = ${state.threshFrac.toFixed(2)} (relative to peak)`,
      W - 240, yT - 4);

    // dashed marker at true target range
    const xTarget = rToX(state.R0);
    ctx.strokeStyle = "rgba(0,0,0,0.4)";
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(xTarget, yTop); ctx.lineTo(xTarget, yBot);
    ctx.stroke();
    ctx.setLineDash([]);

    // axis ticks
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
      `target: ${truthHit ? "DETECTED" : "MISSED"}    ·    false alarms: ${nFalse}`,
      PAD + 4, 18
    );
  }

  buildScene();
  redraw();
}
