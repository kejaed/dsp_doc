// Figure 20 — Putting it together.
//
// One scene that auto-cycles through the entire active-sonar pipeline.
// Six panels arranged top-to-bottom:
//   1) world view (transducer + target)         — pulse animates out + back
//   2) raw receive trace                        — fills in as the echo arrives
//   3) matched-filter output                    — pops up after the echo lands
//   4) one row of the range-Doppler matrix      — a stamp into a stack
//   5) the integrated RD map                    — brighter with each ping
//   6) CFAR detection                           — green dot lights up when found
//
// No sliders — this is the closing animation. The reader watches the
// pipeline run on its own, all the way through.

import { mountCanvas, clamp } from "../core/canvas.js";
import { lfmChirp, echo, xcorrFFT, magnitude, whiteNoise, addInPlace, C_WATER } from "../core/dsp.js";
import { playPing } from "../core/audio.js";
import { makeToggle } from "../core/slider.js";

const W = 720;
const ROW = 95;
const ROWS = 6;
const PAD = 30;
const H = ROW * ROWS + 30;

const FS = 4000;
const B_HZ = 600;
const TAU_S = 0.04;
const N_OUT = 400;
const FC_HZ = 800;
const N_PULSES = 16;
const PRI_S = 0.05;       // 50 ms — deep coherent burst
const SCENE_R = 1500;
const SCENE_V = 4;
const SNR_DB = -2;

// Pre-computed across all pulses for the cycle. We'll regenerate when
// the user clicks "replay" so the noise reseeds.
const cached = { mfMag: [], rdMatrix: null, mxRD: 1, soundOn: false };

function buildAll() {
  const chirp = lfmChirp(B_HZ, TAU_S, FS);
  cached.mfMag = [];
  let pE = 0;
  {
    const tmp = echo({ chirp, R0: SCENE_R, fc: FC_HZ, Fs: FS, nOut: N_OUT, amplitude: 1 });
    for (let i = 0; i < N_OUT; i++) pE += tmp.re[i] * tmp.re[i] + tmp.im[i] * tmp.im[i];
    pE /= chirp.re.length;
  }
  if (pE < 1e-12) pE = 1e-12;
  const sigma = Math.sqrt(pE / Math.pow(10, SNR_DB / 10));

  const fd = -(2 * SCENE_V * FC_HZ) / C_WATER;
  // Slow-time complex MF outputs at each range bin
  const NF = 16;        // doppler bins (= N_PULSES, conveniently)
  const sumRe = new Float32Array(N_OUT);
  const sumIm = new Float32Array(N_OUT);

  // Two-pass: build MF outputs per pulse with phase ramp; show running RD too.
  const integratedRe = new Float32Array(N_OUT);
  const integratedIm = new Float32Array(N_OUT);
  cached.perPulseMag = [];

  for (let k = 0; k < N_PULSES; k++) {
    const ech = echo({ chirp, R0: SCENE_R, fc: FC_HZ, Fs: FS, nOut: N_OUT, amplitude: 1 });
    const ph = 2 * Math.PI * fd * k * PRI_S;
    const cph = Math.cos(ph), sph = Math.sin(ph);
    for (let i = 0; i < N_OUT; i++) {
      const r0 = ech.re[i], i0 = ech.im[i];
      ech.re[i] = r0 * cph - i0 * sph;
      ech.im[i] = r0 * sph + i0 * cph;
    }
    addInPlace(ech, whiteNoise(N_OUT, sigma));
    const mf = xcorrFFT(ech, chirp);
    for (let i = 0; i < N_OUT; i++) {
      integratedRe[i] += mf.re[i];
      integratedIm[i] += mf.im[i];
    }
    const m = magnitude(mf);
    cached.perPulseMag.push(m);
    // intermediate integrated magnitude after k+1 pulses
  }
  cached.integratedMag = new Float32Array(N_OUT);
  for (let i = 0; i < N_OUT; i++)
    cached.integratedMag[i] = Math.hypot(integratedRe[i], integratedIm[i]);

  // single-pulse mag for the row 3 panel
  cached.singleMag = cached.perPulseMag[0];

  // very simple "RD-ish" stack: a 2D where row = pulse, value at each
  // range = magnitude of MF for that pulse. Coloured shows the target
  // peak in column SCENE_R / range_max.
  const matrix = [];
  for (let k = 0; k < N_PULSES; k++) matrix.push(cached.perPulseMag[k]);
  cached.rdMatrix = matrix;
  let mx = 0;
  for (const row of matrix) for (const v of row) if (v > mx) mx = v;
  cached.mxRD = mx;
}

export function mount(root) {
  const { ctx } = mountCanvas(root, W, H);
  const controls = document.createElement("div");
  controls.className = "scene-controls";
  root.appendChild(controls);

  const t0Holder = { value: performance.now() / 1000 };
  buildAll();

  makeToggle(controls, {
    labelOff: "replay", labelOn: "replay",
    onToggle: (on) => {
      if (on) {
        buildAll();
        t0Holder.value = performance.now() / 1000;
        setTimeout(() => {
          const btn = controls.querySelector(".scene-button");
          if (btn) btn.classList.remove("is-on");
        }, 120);
      }
    },
  });
  // Audio is strictly opt-in: default off, the toggle turns it on.
  // Every other figure in the essay follows this rule (explicit click
  // before any sound), so the finale shouldn't break it.
  makeToggle(controls, {
    labelOff: "play with audio", labelOn: "audio on",
    value: false,
    onToggle: (on) => { cached.soundOn = on; },
  });

  const range_max_m = (N_OUT / FS) * C_WATER / 2;

  const CYCLE_PING_S = 0.6;     // wall time per "ping" in the animation
  const CYCLE_TOTAL_S = CYCLE_PING_S * N_PULSES + 1;
  let lastPingHeard = -1;

  function frame(now) {
    const t = (now / 1000) - t0Holder.value;
    const phase = t % CYCLE_TOTAL_S;

    ctx.clearRect(0, 0, W, H);
    drawWorld(phase);
    drawReceiveTrace(phase);
    drawMatchedFilter(phase);
    drawSlowTimeStack(phase);
    drawIntegrated(phase);
    drawCFAR(phase);

    // play one ping per simulated pulse
    if (cached.soundOn) {
      const pulseIdx = Math.floor(phase / CYCLE_PING_S);
      if (pulseIdx >= 0 && pulseIdx < N_PULSES && pulseIdx !== lastPingHeard) {
        playPing(FC_HZ, 60, { gain: 0.06 });
        lastPingHeard = pulseIdx;
      }
      if (phase > N_PULSES * CYCLE_PING_S + 0.5) lastPingHeard = -1;
    }

    requestAnimationFrame(frame);
  }

  function rangeToX(R) { return PAD + (R / range_max_m) * (W - 2 * PAD); }

  function drawWorld(phase) {
    const yTop = 0;
    const yBot = ROW;
    ctx.fillStyle = "rgba(31, 95, 168, 0.05)";
    ctx.fillRect(0, yTop, W, yBot);
    ctx.strokeStyle = "rgba(0,0,0,0.10)";
    ctx.beginPath(); ctx.moveTo(0, yBot); ctx.lineTo(W, yBot); ctx.stroke();

    const yMid = (yTop + yBot) / 2;
    ctx.fillStyle = "#222";
    ctx.fillRect(PAD - 8, yMid - 8, 12, 16);
    ctx.fillStyle = "#cd3a2a";
    ctx.beginPath();
    ctx.arc(rangeToX(SCENE_R), yMid, 9, 0, Math.PI * 2);
    ctx.fill();

    // animated outbound + return pulse
    const pulseIdx = Math.floor(phase / CYCLE_PING_S);
    const localT = phase - pulseIdx * CYCLE_PING_S;
    const halfTau = CYCLE_PING_S / 2;
    if (localT < halfTau && pulseIdx < N_PULSES) {
      const u = localT / halfTau;
      drawDot(ctx, PAD + u * (rangeToX(SCENE_R) - PAD), yMid, "#1f5fa8");
    } else if (localT < CYCLE_PING_S && pulseIdx < N_PULSES) {
      const u = (localT - halfTau) / halfTau;
      drawDot(ctx, rangeToX(SCENE_R) - u * (rangeToX(SCENE_R) - PAD), yMid, "#cd3a2a");
    }

    label(ctx, "1.  world view  —  ping fires + echo returns each cycle", PAD, 14);
  }

  function drawReceiveTrace(phase) {
    const yTop = ROW, yBot = ROW * 2;
    ctx.fillStyle = "rgba(0,0,0,0.02)";
    ctx.fillRect(PAD, yTop + 4, W - 2 * PAD, yBot - yTop - 8);
    ctx.strokeStyle = "rgba(0,0,0,0.10)";
    ctx.strokeRect(PAD, yTop + 4, W - 2 * PAD, yBot - yTop - 8);

    // Sketch the receive trace as a noisy line with a chirp blip at xR0
    const N = 200;
    const xR0frac = SCENE_R / range_max_m;
    const yMid = (yTop + yBot) / 2;
    ctx.strokeStyle = "#1f5fa8";
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    for (let i = 0; i < N; i++) {
      const u = i / (N - 1);
      const dist = u - xR0frac;
      const blip = Math.exp(-Math.pow(dist / 0.025, 2)) *
                   Math.sin(2 * Math.PI * 30 * u);
      const noise = (Math.random() - 0.5) * 0.3;
      const v = blip + noise;
      const x = PAD + u * (W - 2 * PAD);
      const y = yMid - v * 26;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
    label(ctx, "2.  raw receive trace  (echo + noise)", PAD, yTop + 14);
  }

  function drawMatchedFilter(phase) {
    const yTop = ROW * 2, yBot = ROW * 3;
    ctx.fillStyle = "rgba(0,0,0,0.02)";
    ctx.fillRect(PAD, yTop + 4, W - 2 * PAD, yBot - yTop - 8);
    ctx.strokeStyle = "rgba(0,0,0,0.10)";
    ctx.strokeRect(PAD, yTop + 4, W - 2 * PAD, yBot - yTop - 8);

    drawTrace(ctx, yTop + 8, yBot - 8, cached.singleMag, "#cd3a2a");
    label(ctx, "3.  matched-filter output (single pulse)", PAD, yTop + 14);
  }

  function drawSlowTimeStack(phase) {
    const yTop = ROW * 3, yBot = ROW * 4;
    ctx.fillStyle = "rgba(0,0,0,0.02)";
    ctx.fillRect(PAD, yTop + 4, W - 2 * PAD, yBot - yTop - 8);
    ctx.strokeStyle = "rgba(0,0,0,0.10)";
    ctx.strokeRect(PAD, yTop + 4, W - 2 * PAD, yBot - yTop - 8);

    // "stack" of N rows. Each row is a thin strip whose brightness ~
    // |MF| at that range. Highlight the row currently being added.
    const pulseIdx = Math.min(N_PULSES - 1, Math.floor(phase / CYCLE_PING_S));
    const rowH = (yBot - yTop - 16) / N_PULSES;
    for (let k = 0; k < N_PULSES; k++) {
      const isCurrent = k === pulseIdx;
      const yStripTop = yTop + 8 + k * rowH;
      const samples = cached.perPulseMag[k];
      drawStrip(ctx, yStripTop, rowH - 1, samples, isCurrent);
    }
    label(ctx, "4.  ping-by-ping stack into the slow-time matrix", PAD, yTop + 14);
  }

  function drawIntegrated(phase) {
    const yTop = ROW * 4, yBot = ROW * 5;
    ctx.fillStyle = "rgba(0,0,0,0.02)";
    ctx.fillRect(PAD, yTop + 4, W - 2 * PAD, yBot - yTop - 8);
    ctx.strokeStyle = "rgba(0,0,0,0.10)";
    ctx.strokeRect(PAD, yTop + 4, W - 2 * PAD, yBot - yTop - 8);

    // grow the integrated trace as the pulses come in
    const pulseIdx = clamp(Math.floor(phase / CYCLE_PING_S), 0, N_PULSES - 1);
    const sumRe = new Float32Array(N_OUT);
    const sumIm = new Float32Array(N_OUT);
    for (let k = 0; k <= pulseIdx; k++) {
      const m = cached.perPulseMag[k];
      for (let i = 0; i < N_OUT; i++) sumRe[i] += m[i];
    }
    const mag = new Float32Array(N_OUT);
    for (let i = 0; i < N_OUT; i++) mag[i] = sumRe[i] / (pulseIdx + 1);

    drawTrace(ctx, yTop + 8, yBot - 8, mag, "#1f5fa8");
    label(ctx, `5.  integrated MF after ${pulseIdx + 1} / ${N_PULSES} pulses`, PAD, yTop + 14);
  }

  function drawCFAR(phase) {
    const yTop = ROW * 5, yBot = ROW * 6;
    ctx.fillStyle = "rgba(0,0,0,0.02)";
    ctx.fillRect(PAD, yTop + 4, W - 2 * PAD, yBot - yTop - 8);
    ctx.strokeStyle = "rgba(0,0,0,0.10)";
    ctx.strokeRect(PAD, yTop + 4, W - 2 * PAD, yBot - yTop - 8);

    // After all pulses, a green dot at the target range — "DETECTED"
    const done = phase > (N_PULSES - 1) * CYCLE_PING_S;
    drawTrace(ctx, yTop + 8, yBot - 8, cached.integratedMag, "#1f5fa8");
    if (done) {
      const xR = rangeToX(SCENE_R);
      const yMid = (yTop + yBot) / 2;
      ctx.fillStyle = "#1f7f4a";
      ctx.beginPath();
      ctx.arc(xR, yMid - 14, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.font = 'bold 13px -apple-system, sans-serif';
      ctx.fillStyle = "#1f7f4a";
      ctx.fillText("DETECTED", xR + 12, yMid - 10);
    }
    label(ctx, "6.  CFAR threshold + detection (target marked when found)", PAD, yTop + 14);
  }

  function label(ctx, text, x, y) {
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.font = '11px -apple-system, sans-serif';
    ctx.fillText(text, x + 6, y);
  }

  function drawDot(ctx, x, y, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(x, y, 11, 0, Math.PI * 2);
    ctx.stroke();
  }

  function drawTrace(ctx, yTop, yBot, samples, color) {
    let mx = 0;
    for (let i = 0; i < samples.length; i++) if (samples[i] > mx) mx = samples[i];
    if (mx < 1e-12) mx = 1;
    const amp = (yBot - yTop) * 0.7;
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    for (let xi = 0; xi <= W - 2 * PAD; xi++) {
      const u = xi / (W - 2 * PAD);
      const i = Math.min(samples.length - 1, Math.floor(u * samples.length));
      const v = samples[i] / mx;
      const y = yBot - 4 - v * amp;
      if (xi === 0) ctx.moveTo(PAD + xi, y);
      else ctx.lineTo(PAD + xi, y);
    }
    ctx.stroke();
  }

  function drawStrip(ctx, yTop, yH, samples, highlight) {
    let mx = 0;
    for (let i = 0; i < samples.length; i++) if (samples[i] > mx) mx = samples[i];
    if (mx < 1e-12) mx = 1;
    const w = W - 2 * PAD;
    for (let xi = 0; xi < w; xi++) {
      const u = xi / w;
      const i = Math.min(samples.length - 1, Math.floor(u * samples.length));
      const v = samples[i] / mx;
      const lum = Math.round(255 - v * 200);
      ctx.fillStyle = highlight
        ? `rgb(${lum},${Math.round(lum * 0.6)},${Math.round(lum * 0.5)})`
        : `rgb(${lum},${lum},${lum})`;
      ctx.fillRect(PAD + xi, yTop, 1, yH);
    }
  }

  requestAnimationFrame(frame);
}
