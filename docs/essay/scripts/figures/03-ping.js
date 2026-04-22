// Figure 3 — A single ping.
//
// Time-domain plot of a tone burst (the simplest possible "ping") and
// its narrow Fourier spectrum, side by side. Slider: pulse duration τ
// in milliseconds. As the pulse gets longer, the spectrum gets
// narrower — the first hint of the time-bandwidth tradeoff that drives
// the rest of the essay.

import { mountCanvas } from "../core/canvas.js";
import { makeSlider, makeToggle } from "../core/slider.js";
import { fft, nextPow2 } from "../core/dsp.js";
import { playPing } from "../core/audio.js";

const W = 720;
const H = 280;
const TOP_H = 130;
const BOT_H = 130;
const GAP = 20;

const FC = 800;     // displayed centre frequency in Hz (audio uses same)
const FS = 8000;    // sample rate for the FFT only
const PLOT_W = W / 2 - 30;

export function mount(root) {
  const { ctx } = mountCanvas(root, W, H);
  const controls = document.createElement("div");
  controls.className = "scene-controls";
  root.appendChild(controls);

  const state = { tauMs: 20 };

  makeSlider(controls, {
    min: 2, max: 60, value: state.tauMs, step: 1,
    label: "pulse duration τ", unit: " ms",
    onInput: (v) => { state.tauMs = v; redraw(); },
  });

  makeToggle(controls, {
    labelOff: "play ping", labelOn: "play ping",
    onToggle: (on) => {
      if (on) {
        playPing(FC, state.tauMs);
        setTimeout(() => {
          const btn = controls.querySelector(".scene-button");
          if (btn) btn.classList.remove("is-on");
        }, 120);
      }
    },
  });

  function redraw() {
    ctx.clearRect(0, 0, W, H);
    drawTime();
    drawSpectrum();
  }

  function drawTime() {
    const x0 = 14, y0 = 16;
    const w = PLOT_W, h = TOP_H;
    ctx.save();
    ctx.translate(x0, y0);
    ctx.strokeStyle = "rgba(0,0,0,0.12)";
    ctx.lineWidth = 1;
    ctx.strokeRect(0, 0, w, h);

    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.font = '12px -apple-system, sans-serif';
    ctx.fillText("time domain", 6, 14);

    // Plot the tone burst over a 80 ms window
    const windowMs = 80;
    const tauS = state.tauMs / 1000;
    const yMid = h / 2;
    const amp = h * 0.4;
    ctx.strokeStyle = "#1f5fa8";
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    for (let xi = 0; xi <= w; xi++) {
      const tMs = (xi / w) * windowMs;
      const t = tMs / 1000;
      const inside = t >= 0 && t < tauS ? 1 : 0;
      const v = inside * Math.sin(2 * Math.PI * FC * t);
      const y = yMid - v * amp;
      if (xi === 0) ctx.moveTo(xi, y); else ctx.lineTo(xi, y);
    }
    ctx.stroke();

    // axis label
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.font = '11px -apple-system, sans-serif';
    ctx.fillText(`${windowMs} ms window`, w - 90, h - 6);
    ctx.fillText(`τ = ${state.tauMs} ms`, 6, h - 6);
    ctx.restore();
  }

  function drawSpectrum() {
    const x0 = W / 2 + 16, y0 = 16;
    const w = PLOT_W, h = BOT_H;
    ctx.save();
    ctx.translate(x0, y0);
    ctx.strokeStyle = "rgba(0,0,0,0.12)";
    ctx.lineWidth = 1;
    ctx.strokeRect(0, 0, w, h);

    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.font = '12px -apple-system, sans-serif';
    ctx.fillText("magnitude spectrum", 6, 14);

    // Build the time signal at FS = 8000 Hz, FFT it
    const winS = 0.2;          // 200 ms total — fine resolution
    const N = nextPow2(Math.round(winS * FS));
    const sig = new Float32Array(N);
    const tauS = state.tauMs / 1000;
    const tauN = Math.min(N, Math.round(tauS * FS));
    for (let i = 0; i < tauN; i++) {
      const t = i / FS;
      sig[i] = Math.sin(2 * Math.PI * FC * t);
    }
    const { re, im } = fft(sig);
    // half spectrum, magnitude
    const half = N / 2;
    const mag = new Float32Array(half);
    let mx = 0;
    for (let i = 0; i < half; i++) {
      mag[i] = Math.hypot(re[i], im[i]);
      if (mag[i] > mx) mx = mag[i];
    }

    // x maps 0..2 kHz, y maps 0..mx
    const xMaxHz = 1600;
    const yMid = h - 8;
    const amp = h - 26;
    ctx.strokeStyle = "#cd3a2a";
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    for (let xi = 0; xi <= w; xi++) {
      const f = (xi / w) * xMaxHz;
      const idx = Math.round((f / FS) * N);
      const v = mag[Math.min(half - 1, idx)] / mx;
      const y = yMid - v * amp;
      if (xi === 0) ctx.moveTo(xi, y); else ctx.lineTo(xi, y);
    }
    ctx.stroke();

    // marker at centre frequency
    const xFc = (FC / xMaxHz) * w;
    ctx.strokeStyle = "rgba(0,0,0,0.18)";
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(xFc, 0);
    ctx.lineTo(xFc, h);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.font = '11px -apple-system, sans-serif';
    ctx.fillText(`fc = ${FC} Hz`, xFc + 4, 14 + 12);
    ctx.fillText(`bandwidth ≈ ${(1000 / state.tauMs).toFixed(0)} Hz`, 6, h - 6);
    ctx.fillText(`${(xMaxHz / 1000).toFixed(1)} kHz`, w - 50, h - 6);
    ctx.restore();
  }

  redraw();
}
