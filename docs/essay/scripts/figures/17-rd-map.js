// Figure 17 — The range–Doppler map.
//
// The 2-D heatmap that pulls the whole story together. Build N pulses
// of MF output (one per ping), apply a slow-time FFT across them at
// each range bin, and display |result| in dB as a heatmap with range
// across and Doppler velocity up. A bright spot marks the true target
// at (R0, v).
// Sliders: target range R0, target velocity v, N pulses, PRI.

import { mountCanvas } from "../core/canvas.js";
import { makeSlider } from "../core/slider.js";
import {
  lfmChirp, echo, xcorrFFT, whiteNoise, addInPlace,
  rangeDopplerMap, C_WATER,
} from "../core/dsp.js";

const W = 720;
const PAD_L = 60;
const PAD_R = 24;
const PAD_T = 28;
const PAD_B = 36;
const H = 360;
const PLOT_W = W - PAD_L - PAD_R;
const PLOT_H = H - PAD_T - PAD_B;

const FS = 4000;
const B_HZ = 600;
const TAU_S = 0.04;
const FC_HZ = 800;        // sonar carrier (drives Doppler axis)
const N_RANGE = 256;      // range bins per pulse
const SNR_DB = 0;         // input SNR per pulse — easy to see, demo target

export function mount(root) {
  const { ctx } = mountCanvas(root, W, H);
  const controls = document.createElement("div");
  controls.className = "scene-controls";
  root.appendChild(controls);

  const range_max_m = (N_RANGE / FS) * C_WATER / 2;

  const state = { R0: range_max_m * 0.55, v: 4, N: 16, PRI_ms: 4 };

  makeSlider(controls, {
    min: 30, max: range_max_m * 0.9, value: state.R0, step: 1,
    label: "target range R₀", unit: " m",
    onInput: (v) => { state.R0 = v; redraw(); },
  });
  makeSlider(controls, {
    min: -10, max: 10, value: state.v, step: 0.5,
    label: "target velocity v", unit: " m/s",
    onInput: (v) => { state.v = v; redraw(); },
  });
  makeSlider(controls, {
    min: 4, max: 64, value: state.N, step: 4,
    label: "N pulses", unit: "",
    onInput: (v) => { state.N = v; redraw(); },
  });
  makeSlider(controls, {
    min: 1, max: 12, value: state.PRI_ms, step: 0.5,
    label: "PRI", unit: " ms",
    onInput: (v) => { state.PRI_ms = v; redraw(); },
  });

  function redraw() {
    ctx.clearRect(0, 0, W, H);

    const chirp = lfmChirp(B_HZ, TAU_S, FS);

    // calibrate noise once based on the echo's energy
    let pE = 0;
    {
      const tmp = echo({ chirp, R0: state.R0, fc: FC_HZ, Fs: FS, nOut: N_RANGE, amplitude: 1 });
      for (let i = 0; i < N_RANGE; i++) pE += tmp.re[i] * tmp.re[i] + tmp.im[i] * tmp.im[i];
      pE /= chirp.re.length;
    }
    if (pE < 1e-12) pE = 1e-12;
    const sigma = Math.sqrt(pE / Math.pow(10, SNR_DB / 10));

    // Build N pulses: each has the SAME echo (we model amplitude
    // identical from ping to ping) plus an inter-pulse Doppler phase
    // ramp exp(j 2π fd k PRI). After matched filtering, slow-time FFT
    // reveals the Doppler tone.
    const PRI = state.PRI_ms / 1000;
    const fd = -(2 * state.v * FC_HZ) / C_WATER;
    const pulses = [];
    for (let k = 0; k < state.N; k++) {
      const ech = echo({ chirp, R0: state.R0, fc: FC_HZ, Fs: FS, nOut: N_RANGE, amplitude: 1 });
      // inter-pulse phase ramp
      const ph = 2 * Math.PI * fd * k * PRI;
      const cph = Math.cos(ph), sph = Math.sin(ph);
      for (let i = 0; i < N_RANGE; i++) {
        const r0 = ech.re[i], i0 = ech.im[i];
        ech.re[i] = r0 * cph - i0 * sph;
        ech.im[i] = r0 * sph + i0 * cph;
      }
      const nz = whiteNoise(N_RANGE, sigma);
      addInPlace(ech, nz);
      pulses.push(xcorrFFT(ech, chirp));
    }

    const rd = rangeDopplerMap(pulses, PRI, FC_HZ);
    const rdDB = rd.rdDB;
    const NF = rdDB.length;

    // dynamic range
    let mx = -Infinity;
    for (let f = 0; f < NF; f++)
      for (let r = 0; r < N_RANGE; r++)
        if (rdDB[f][r] > mx) mx = rdDB[f][r];
    const dyn = 35;
    const lo = mx - dyn;

    // heatmap
    const cellW = PLOT_W / N_RANGE;
    const cellH = PLOT_H / NF;
    for (let f = 0; f < NF; f++) {
      const y = PAD_T + (NF - 1 - f) * cellH;
      for (let r = 0; r < N_RANGE; r++) {
        const v = (rdDB[f][r] - lo) / dyn;
        const t = Math.max(0, Math.min(1, v));
        ctx.fillStyle = viridis(t);
        ctx.fillRect(PAD_L + r * cellW, y, cellW + 0.6, cellH + 0.6);
      }
    }

    // axes box
    ctx.strokeStyle = "rgba(0,0,0,0.3)";
    ctx.strokeRect(PAD_L, PAD_T, PLOT_W, PLOT_H);

    // x ticks (range, m)
    ctx.fillStyle = "rgba(0,0,0,0.7)";
    ctx.font = '11px -apple-system, sans-serif';
    for (let R = 0; R <= range_max_m; R += 20) {
      const x = PAD_L + (R / range_max_m) * PLOT_W;
      ctx.fillRect(x, PAD_T + PLOT_H, 1, 4);
      if (R % 40 === 0) ctx.fillText(`${R}`, x - 10, PAD_T + PLOT_H + 14);
    }
    ctx.fillText("range (m)", PAD_L + PLOT_W / 2 - 22, H - 8);

    // y ticks (velocity, m/s) — symmetric +/-
    const vMin = rd.vAxis[0];
    const vMax = rd.vAxis[NF - 1];
    const vRange = vMax - vMin;
    for (let yp = 0; yp <= 4; yp++) {
      const y = PAD_T + (yp / 4) * PLOT_H;
      const vVal = vMin + (1 - yp / 4) * vRange;
      ctx.fillRect(PAD_L - 4, y, 4, 1);
      ctx.fillText(vVal.toFixed(1), 8, y + 4);
    }
    ctx.save();
    ctx.translate(14, PAD_T + PLOT_H / 2 + 60);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText("radial velocity (m/s)", 0, 0);
    ctx.restore();

    // overlay: true target ring
    const xR = PAD_L + (state.R0 / range_max_m) * PLOT_W;
    const yV = PAD_T + ((vMax - state.v) / vRange) * PLOT_H;
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(xR, yV, 12, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.font = '11px -apple-system, sans-serif';
    ctx.fillText(`true (${state.R0.toFixed(0)} m, ${state.v.toFixed(1)} m/s)`,
      xR + 16, yV - 6);

    // header
    ctx.fillStyle = "#222";
    ctx.font = '12px -apple-system, sans-serif';
    ctx.fillText(
      `range–Doppler map  ·  N = ${state.N}, PRI = ${state.PRI_ms.toFixed(1)} ms, fc = ${FC_HZ} Hz`,
      PAD_L, 18
    );
  }

  function viridis(t) {
    const stops = [
      [0, [68, 1, 84]], [0.25, [59, 82, 139]], [0.5, [33, 144, 141]],
      [0.75, [93, 201, 99]], [1, [253, 231, 37]],
    ];
    for (let i = 0; i < stops.length - 1; i++) {
      if (t >= stops[i][0] && t <= stops[i + 1][0]) {
        const u = (t - stops[i][0]) / (stops[i + 1][0] - stops[i][0]);
        const a = stops[i][1], b = stops[i + 1][1];
        return `rgb(${(a[0]+(b[0]-a[0])*u)|0},${(a[1]+(b[1]-a[1])*u)|0},${(a[2]+(b[2]-a[2])*u)|0})`;
      }
    }
    return "#000";
  }

  redraw();
}
