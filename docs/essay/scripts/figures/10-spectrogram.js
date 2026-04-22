// Figure 10 — Spectrogram of the chirp.
//
// A 2D heatmap with time across, frequency up, intensity = energy.
// The chirp shows up as a bright diagonal line whose slope is B/τ.
// Slider: bandwidth B. The diagonal tilts.

import { mountCanvas } from "../core/canvas.js";
import { makeSlider } from "../core/slider.js";
import { lfmChirpReal } from "../core/dsp.js";

const W = 720;
const H = 280;
const PAD_L = 60;
const PAD_R = 24;
const PAD_T = 14;
const PAD_B = 30;
const PLOT_W = W - PAD_L - PAD_R;
const PLOT_H = H - PAD_T - PAD_B;

const FS = 8000;
const F0 = 200;
const F_MAX = 2400;
const TAU_MS = 80;

const NPERSEG = 128;
const NOVERLAP = 96;

export function mount(root) {
  const { ctx } = mountCanvas(root, W, H);
  const controls = document.createElement("div");
  controls.className = "scene-controls";
  root.appendChild(controls);

  const state = { B_Hz: 1200 };

  makeSlider(controls, {
    min: 100, max: 1800, value: state.B_Hz, step: 50,
    label: "bandwidth B", unit: " Hz",
    onInput: (v) => { state.B_Hz = v; redraw(); },
  });

  function redraw() {
    ctx.clearRect(0, 0, W, H);
    const tauS = TAU_MS / 1000;
    const sig = lfmChirpReal(state.B_Hz, tauS, FS, F0, 0);
    // Pad signal so spectrogram has some "before/after" empty space.
    const Npre = Math.round(0.02 * FS);
    const Npost = Math.round(0.02 * FS);
    const padded = new Float32Array(sig.length + Npre + Npost);
    padded.set(sig, Npre);

    const cols = Math.floor((padded.length - NPERSEG) / (NPERSEG - NOVERLAP)) + 1;
    const half = NPERSEG / 2;
    // Compute the full spectrogram into a rows-by-cols array of dB
    const grid = new Array(half);
    for (let r = 0; r < half; r++) grid[r] = new Float32Array(cols);

    const win = hann(NPERSEG);
    let gMin = Infinity, gMax = -Infinity;
    for (let c = 0; c < cols; c++) {
      const start = c * (NPERSEG - NOVERLAP);
      const re = new Float32Array(NPERSEG);
      const im = new Float32Array(NPERSEG);
      for (let i = 0; i < NPERSEG; i++) re[i] = padded[start + i] * win[i];
      // tiny in-place FFT (avoid pulling dsp.fftInPlace import to keep
      // this self-contained — same routine, just inlined for clarity)
      smallFFT(re, im);
      for (let r = 0; r < half; r++) {
        const m = Math.hypot(re[r], im[r]);
        const db = m > 0 ? 20 * Math.log10(m) : -120;
        grid[r][c] = db;
        if (db > gMax) gMax = db;
        if (db < gMin) gMin = db;
      }
    }
    const dynRange = 50;
    const lo = gMax - dynRange;

    // backdrop
    ctx.fillStyle = "#fff";
    ctx.fillRect(PAD_L, PAD_T, PLOT_W, PLOT_H);

    // draw heatmap as filled rects (not super efficient but plenty
    // fast at this resolution: cols ~ 60, rows ~ 64)
    const cellW = PLOT_W / cols;
    const cellH = PLOT_H / half;
    for (let c = 0; c < cols; c++) {
      const x = PAD_L + c * cellW;
      for (let r = 0; r < half; r++) {
        const v = (grid[r][c] - lo) / dynRange;
        const t = Math.max(0, Math.min(1, v));
        const y = PAD_T + (half - 1 - r) * cellH;
        ctx.fillStyle = viridis(t);
        ctx.fillRect(x, y, cellW + 0.5, cellH + 0.5);
      }
    }

    // axes
    ctx.strokeStyle = "rgba(0,0,0,0.3)";
    ctx.strokeRect(PAD_L, PAD_T, PLOT_W, PLOT_H);

    // axis labels (time and frequency)
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.font = '11px -apple-system, sans-serif';
    const totalMs = (padded.length / FS) * 1000;
    for (let s = 0; s <= 4; s++) {
      const t = (s / 4) * totalMs;
      const x = PAD_L + (s / 4) * PLOT_W;
      ctx.fillRect(x, PAD_T + PLOT_H, 1, 4);
      ctx.fillText(`${t.toFixed(0)} ms`, x - 16, PAD_T + PLOT_H + 14);
    }
    for (let kHz = 0; kHz <= 2; kHz += 0.5) {
      const f = kHz * 1000;
      if (f > F_MAX) break;
      const yFrac = f / (FS / 2);
      const y = PAD_T + (1 - yFrac) * PLOT_H;
      ctx.fillRect(PAD_L - 4, y, 4, 1);
      ctx.fillText(`${kHz} kHz`, 8, y + 4);
    }
    ctx.fillText("time", PAD_L + PLOT_W / 2 - 10, H - 6);

    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.font = 'bold 12px -apple-system, sans-serif';
    ctx.fillText(`B = ${state.B_Hz} Hz, τ = ${TAU_MS} ms`, PAD_L + 10, PAD_T + 16);
  }

  redraw();
}

function hann(N) {
  const w = new Float32Array(N);
  for (let i = 0; i < N; i++) w[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (N - 1)));
  return w;
}

// Very small in-place radix-2 FFT (duplicate of core/dsp.js for the
// spectrogram cell, to keep this module self-contained).
function smallFFT(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wlR = Math.cos(ang), wlI = Math.sin(ang);
    const half = len >> 1;
    for (let i = 0; i < n; i += len) {
      let wR = 1, wI = 0;
      for (let k = 0; k < half; k++) {
        const a = i + k, b = a + half;
        const tR = re[b] * wR - im[b] * wI;
        const tI = re[b] * wI + im[b] * wR;
        re[b] = re[a] - tR; im[b] = im[a] - tI;
        re[a] += tR; im[a] += tI;
        const nR = wR * wlR - wI * wlI;
        wI = wR * wlI + wI * wlR; wR = nR;
      }
    }
  }
}

// Viridis colormap (5-stop linear interpolation, good enough)
function viridis(t) {
  const stops = [
    [0.000, [68, 1, 84]],
    [0.250, [59, 82, 139]],
    [0.500, [33, 144, 141]],
    [0.750, [93, 201, 99]],
    [1.000, [253, 231, 37]],
  ];
  for (let i = 0; i < stops.length - 1; i++) {
    if (t >= stops[i][0] && t <= stops[i + 1][0]) {
      const u = (t - stops[i][0]) / (stops[i + 1][0] - stops[i][0]);
      const a = stops[i][1], b = stops[i + 1][1];
      const r = a[0] + (b[0] - a[0]) * u;
      const g = a[1] + (b[1] - a[1]) * u;
      const bl = a[2] + (b[2] - a[2]) * u;
      return `rgb(${r|0},${g|0},${bl|0})`;
    }
  }
  return "#000";
}
