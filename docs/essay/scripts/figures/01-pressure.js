// Figure 1 — A pressure wave in water.
//
// Top half: a row of "water particles" oscillating LONGITUDINALLY (back
// and forth along the wave direction) so the reader sees that sound is
// a compression wave — particles don't travel, they jiggle in place
// while the pattern travels.
// Bottom half: pressure as a function of position at the current moment
// in time. Compressions show as positive pressure peaks, rarefactions
// as troughs. Reader should notice that high particle density in the
// top half lines up with positive-pressure regions in the bottom half.
//
// Slider: frequency (in Hz of the visualised wave). Changes wavelength
// on screen and (when the tone button is on) the audio pitch.

import { mountCanvas } from "../core/canvas.js";
import { makeSlider, makeToggle } from "../core/slider.js";
import { playTone } from "../core/audio.js";

const W = 720;
const H_PARTICLES = 180;
const H_PRESSURE = 150;
const GAP = 6;
const H = H_PARTICLES + GAP + H_PRESSURE;

const N_PARTICLES = 60;
const PARTICLE_R = 3;
const AMP_PX = 7;            // longitudinal displacement amplitude
const PRESSURE_AMP_PX = 50;  // pressure curve amplitude in canvas px
const SPEED_PX_PER_S = 110;  // wave phase speed on the canvas

// Slider goes 0.5 -> 4 visual Hz. Map to 220 -> 880 Hz audio so
// reader can hear "higher slider = higher pitch".
const audioFreq = (vis) => 220 + (vis - 0.5) * (880 - 220) / (4 - 0.5);

export function mount(root) {
  const { ctx } = mountCanvas(root, W, H);

  const controls = document.createElement("div");
  controls.className = "scene-controls";
  root.appendChild(controls);

  const state = {
    freq: 1.2,           // visual cycles per second across the canvas
    audioOn: false,
    audio: null,
  };

  const slider = makeSlider(controls, {
    min: 0.5, max: 4, value: state.freq, step: 0.1,
    label: "frequency", unit: " Hz",
    onInput: (v) => {
      state.freq = v;
      if (state.audio) state.audio.setFrequency(audioFreq(v));
    },
  });

  makeToggle(controls, {
    labelOff: "play tone", labelOn: "stop tone",
    onToggle: (on) => {
      if (on) {
        state.audio = playTone(audioFreq(state.freq));
        state.audioOn = !!state.audio;
      } else if (state.audio) {
        state.audio.stop();
        state.audio = null;
      }
    },
  });

  // ---- drawing ----------------------------------------------------------
  const PITCH = W / N_PARTICLES;

  function drawParticles(t) {
    ctx.clearRect(0, 0, W, H_PARTICLES);
    const yMid = H_PARTICLES / 2;
    const wavelength = SPEED_PX_PER_S / state.freq;
    const k = (2 * Math.PI) / wavelength;
    const omega = 2 * Math.PI * state.freq;

    // Shaded "water" background — very subtle.
    ctx.fillStyle = "rgba(31, 95, 168, 0.04)";
    ctx.fillRect(0, 0, W, H_PARTICLES);

    // Reference centre line.
    ctx.strokeStyle = "rgba(0,0,0,0.06)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, yMid);
    ctx.lineTo(W, yMid);
    ctx.stroke();

    for (let i = 0; i < N_PARTICLES; i++) {
      const xRest = (i + 0.5) * PITCH;
      const dx = AMP_PX * Math.sin(k * xRest - omega * t);
      ctx.beginPath();
      ctx.arc(xRest + dx, yMid, PARTICLE_R, 0, Math.PI * 2);
      ctx.fillStyle = "#1f5fa8";
      ctx.fill();
    }

    // Caption-ish label inside the canvas.
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.font = 'italic 12px Charter, "Iowan Old Style", Georgia, serif';
    ctx.fillText("water particles (longitudinal motion)", 10, 18);
  }

  function drawPressure(t) {
    ctx.save();
    ctx.translate(0, H_PARTICLES + GAP);
    ctx.clearRect(0, 0, W, H_PRESSURE);
    const yMid = H_PRESSURE / 2;
    const wavelength = SPEED_PX_PER_S / state.freq;
    const k = (2 * Math.PI) / wavelength;
    const omega = 2 * Math.PI * state.freq;

    // Zero line.
    ctx.strokeStyle = "rgba(0,0,0,0.18)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, yMid);
    ctx.lineTo(W, yMid);
    ctx.stroke();

    // Pressure curve. We use cos so the high-pressure peaks line up
    // with the densest particle regions in the top panel (the spatial
    // derivative of displacement).
    ctx.strokeStyle = "#cd3a2a";
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    for (let x = 0; x <= W; x++) {
      const p = PRESSURE_AMP_PX * Math.cos(k * x - omega * t);
      const y = yMid - p;
      if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // + / - labels at the y axis.
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.font = 'italic 12px Charter, "Iowan Old Style", Georgia, serif';
    ctx.fillText("pressure", 10, 18);
    ctx.fillText("+", 10, yMid - PRESSURE_AMP_PX + 4);
    ctx.fillText("−", 10, yMid + PRESSURE_AMP_PX + 4);

    ctx.restore();
  }

  // Animation loop. We use absolute clock time so dragging the slider
  // never causes a phase jump.
  function frame(now) {
    const t = now / 1000;
    drawParticles(t);
    drawPressure(t);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
