// Figure 14 — The Doppler spectrum.
//
// Magnitude spectrum of the echo, with a marker showing where the
// transmit carrier sat and where the Doppler-shifted echo is. As v
// changes, the echo line slides along the frequency axis. Slider: v.

import { mountCanvas } from "../core/canvas.js";
import { makeSlider } from "../core/slider.js";
import { C_WATER, fft, nextPow2 } from "../core/dsp.js";

const W = 720;
const H = 220;
const PAD = 30;
const FS = 6000;
const FC = 700;
const FMAX = 1500;
const TONE_DUR_S = 0.5;

export function mount(root) {
  const { ctx } = mountCanvas(root, W, H);
  const controls = document.createElement("div");
  controls.className = "scene-controls";
  root.appendChild(controls);

  const state = { v: 8 };

  makeSlider(controls, {
    min: -25, max: 25, value: state.v, step: 0.5,
    label: "target velocity v", unit: " m/s",
    onInput: (v) => { state.v = v; redraw(); },
  });

  function fToX(f) { return PAD + (f / FMAX) * (W - 2 * PAD); }

  function redraw() {
    ctx.clearRect(0, 0, W, H);
    ctx.strokeStyle = "rgba(0,0,0,0.12)";
    ctx.strokeRect(PAD, 30, W - 2 * PAD, H - 70);

    // axis ticks
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.font = '11px -apple-system, sans-serif';
    for (let f = 0; f <= FMAX; f += 200) {
      const x = fToX(f);
      ctx.fillRect(x, H - 42, 1, 5);
      ctx.fillText(`${f}`, x - 8, H - 28);
    }
    ctx.fillText("frequency (Hz)", W - 110, H - 10);

    // Doppler-shifted echo frequency
    const fd = -(2 * state.v * FC) / C_WATER;
    const fEcho = FC + fd;

    // Build a long tone burst at fEcho and FFT it; show the magnitude
    const N = nextPow2(Math.round(TONE_DUR_S * FS));
    const sig = new Float32Array(N);
    const span = Math.round(0.4 * FS);   // 400 ms tone, rest is zeros
    for (let i = 0; i < span; i++) {
      const t = i / FS;
      sig[i] = Math.sin(2 * Math.PI * fEcho * t);
    }
    const { re, im } = fft(sig);
    const half = N / 2;
    const mag = new Float32Array(half);
    let mx = 0;
    for (let i = 0; i < half; i++) {
      mag[i] = Math.hypot(re[i], im[i]);
      if (mag[i] > mx) mx = mag[i];
    }

    // plot magnitude
    const yBase = H - 44;
    const ampPx = H - 90;
    ctx.strokeStyle = "#cd3a2a";
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    for (let xi = 0; xi <= W - 2 * PAD; xi++) {
      const u = xi / (W - 2 * PAD);
      const f = u * FMAX;
      const idx = Math.round((f / FS) * N);
      const v = mag[Math.min(half - 1, idx)] / mx;
      const y = yBase - v * ampPx;
      if (xi === 0) ctx.moveTo(PAD + xi, y); else ctx.lineTo(PAD + xi, y);
    }
    ctx.stroke();

    // markers: transmit fc (cool), echo fc+fd (hot dashed)
    drawMarker(ctx, fToX(FC), 30, yBase, "#1f5fa8", `tx fc = ${FC} Hz`, false);
    drawMarker(ctx, fToX(fEcho), 30, yBase, "#cd3a2a",
      `echo fc + fd = ${fEcho.toFixed(1)} Hz`, true);

    // formula readout
    ctx.fillStyle = "#222";
    ctx.font = '13px -apple-system, sans-serif';
    ctx.fillText(`fd = −2·v·fc/c = ${fd.toFixed(2)} Hz`, PAD + 8, 22);
  }

  function drawMarker(ctx, x, yTop, yBot, color, label, dashed) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.2;
    if (dashed) ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.moveTo(x, yTop); ctx.lineTo(x, yBot);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = color;
    ctx.font = '11px -apple-system, sans-serif';
    ctx.fillText(label, x + 4, yTop + 12);
  }

  redraw();
}
