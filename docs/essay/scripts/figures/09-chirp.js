// Figure 9 — The chirp trick.
//
// A linear-FM (LFM) chirp: instantaneous frequency sweeps linearly
// from f0 to f0 + B over duration tau. Two stacked plots: time-domain
// real waveform on top, frequency-domain magnitude spectrum below.
// Two sliders: bandwidth B and pulse duration tau. The product B*tau
// is the time-bandwidth product — the "energy concentration" gain
// the matched filter is about to extract.

import { mountCanvas } from "../core/canvas.js";
import { makeSlider, makeToggle } from "../core/slider.js";
import { fft, lfmChirpReal, nextPow2 } from "../core/dsp.js";
import { playChirp } from "../core/audio.js";

const W = 720;
const H = 320;
const TOP_H = 130;
const BOT_H = 130;
const GAP = 16;

const F0 = 600;       // start frequency, Hz, for visualisation/audio
const FS = 8000;      // sample rate for the FFT

export function mount(root) {
  const { ctx } = mountCanvas(root, W, H);
  const controls = document.createElement("div");
  controls.className = "scene-controls";
  root.appendChild(controls);

  const state = { B_Hz: 800, tauMs: 30 };

  makeSlider(controls, {
    min: 50, max: 1500, value: state.B_Hz, step: 25,
    label: "bandwidth B", unit: " Hz",
    format: (v) => `${v.toFixed(0)} Hz`,
    onInput: (v) => { state.B_Hz = v; redraw(); },
  });
  makeSlider(controls, {
    min: 5, max: 100, value: state.tauMs, step: 1,
    label: "duration τ", unit: " ms",
    onInput: (v) => { state.tauMs = v; redraw(); },
  });
  makeToggle(controls, {
    labelOff: "play chirp", labelOn: "play chirp",
    onToggle: (on) => {
      if (on) {
        playChirp(F0, F0 + state.B_Hz, state.tauMs);
        setTimeout(() => {
          const btn = controls.querySelectorAll(".scene-button")[0];
          if (btn) btn.classList.remove("is-on");
        }, 120);
      }
    },
  });

  function redraw() {
    ctx.clearRect(0, 0, W, H);
    drawTime();
    drawSpec();
  }

  function drawTime() {
    ctx.save();
    ctx.translate(14, 16);
    const w = W - 28, h = TOP_H;
    ctx.strokeStyle = "rgba(0,0,0,0.12)";
    ctx.strokeRect(0, 0, w, h);

    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.font = '12px -apple-system, sans-serif';
    ctx.fillText("real LFM chirp (time)", 6, 14);

    const tauS = state.tauMs / 1000;
    const sig = lfmChirpReal(state.B_Hz, tauS, FS, F0, 0);
    const yMid = h / 2;
    const amp = h * 0.4;

    ctx.strokeStyle = "#1f5fa8";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    for (let xi = 0; xi <= w; xi++) {
      const u = xi / w;
      const i = Math.min(sig.length - 1, Math.floor(u * sig.length));
      const v = sig[i];
      const y = yMid - v * amp;
      if (xi === 0) ctx.moveTo(xi, y); else ctx.lineTo(xi, y);
    }
    ctx.stroke();

    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.font = '11px -apple-system, sans-serif';
    ctx.fillText(`τ = ${state.tauMs} ms`, 6, h - 6);
    ctx.fillText(`f sweeps ${F0} Hz → ${F0 + state.B_Hz} Hz`, 200, h - 6);
    ctx.fillText(`B·τ = ${(state.B_Hz * tauS).toFixed(0)}`, w - 80, h - 6);
    ctx.restore();
  }

  function drawSpec() {
    ctx.save();
    ctx.translate(14, 16 + TOP_H + GAP);
    const w = W - 28, h = BOT_H;
    ctx.strokeStyle = "rgba(0,0,0,0.12)";
    ctx.strokeRect(0, 0, w, h);

    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.font = '12px -apple-system, sans-serif';
    ctx.fillText("magnitude spectrum", 6, 14);

    const tauS = state.tauMs / 1000;
    const sig = lfmChirpReal(state.B_Hz, tauS, FS, F0, 0);
    const N = nextPow2(Math.max(sig.length, 4096));
    const padded = new Float32Array(N);
    padded.set(sig);
    const { re, im } = fft(padded);
    const half = N / 2;
    const mag = new Float32Array(half);
    let mx = 0;
    for (let i = 0; i < half; i++) {
      mag[i] = Math.hypot(re[i], im[i]);
      if (mag[i] > mx) mx = mag[i];
    }

    const xMaxHz = 2400;
    const yBase = h - 8;
    const ampPx = h - 26;

    ctx.strokeStyle = "#cd3a2a";
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    for (let xi = 0; xi <= w; xi++) {
      const u = xi / w;
      const f = u * xMaxHz;
      const idx = Math.round((f / FS) * N);
      const v = mag[Math.min(half - 1, idx)] / mx;
      const y = yBase - v * ampPx;
      if (xi === 0) ctx.moveTo(xi, y); else ctx.lineTo(xi, y);
    }
    ctx.stroke();

    // mark f0 and f0+B
    for (const [f, lab] of [[F0, "f₀"], [F0 + state.B_Hz, "f₀+B"]]) {
      const x = (f / xMaxHz) * w;
      ctx.strokeStyle = "rgba(0,0,0,0.18)";
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      ctx.font = '11px -apple-system, sans-serif';
      ctx.fillText(lab, x + 3, 26);
    }

    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.font = '11px -apple-system, sans-serif';
    ctx.fillText(`${(xMaxHz / 1000).toFixed(1)} kHz`, w - 50, h - 6);
    ctx.restore();
  }

  redraw();
}
