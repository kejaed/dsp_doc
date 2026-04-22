// WebAudio helpers shared by every figure that makes a sound.
// Browsers require a user gesture before AudioContext.resume() will
// produce output, so getAudioContext() lazily creates the context and
// every play* function calls .resume() defensively.

let _ctx = null;
export function getAudioContext() {
  if (_ctx) return _ctx;
  const C = window.AudioContext || window.webkitAudioContext;
  if (!C) return null;
  _ctx = new C({ latencyHint: "interactive" });
  return _ctx;
}

const DEFAULT_GAIN = 0.12;
const FADE_S = 0.02;

// Continuous tone — returns { stop(), setFrequency(f) }. Use for
// "let me hear what 440 Hz sounds like in water".
export function playTone(frequency, { gain = DEFAULT_GAIN, type = "sine" } = {}) {
  const ac = getAudioContext();
  if (!ac) return null;
  if (ac.state === "suspended") ac.resume();
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = type;
  osc.frequency.value = frequency;
  g.gain.value = 0;
  osc.connect(g).connect(ac.destination);
  osc.start();
  g.gain.linearRampToValueAtTime(gain, ac.currentTime + FADE_S);
  let stopped = false;
  return {
    stop() {
      if (stopped) return;
      stopped = true;
      const t = ac.currentTime;
      g.gain.cancelScheduledValues(t);
      g.gain.setValueAtTime(g.gain.value, t);
      g.gain.linearRampToValueAtTime(0, t + FADE_S);
      osc.stop(t + FADE_S + 0.01);
    },
    setFrequency(f) {
      osc.frequency.setTargetAtTime(f, ac.currentTime, 0.015);
    },
    setGain(v) {
      g.gain.setTargetAtTime(v, ac.currentTime, 0.02);
    },
  };
}

// Fixed-duration ping. Used everywhere a sonar pulse is fired in the
// essay. Returns a Promise that resolves when the buffer has finished.
export function playPing(frequency, durationMs = 80, { gain = DEFAULT_GAIN } = {}) {
  const ac = getAudioContext();
  if (!ac) return Promise.resolve();
  if (ac.state === "suspended") ac.resume();
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = "sine";
  osc.frequency.value = frequency;
  osc.connect(g).connect(ac.destination);
  const t0 = ac.currentTime;
  const dur = durationMs / 1000;
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(gain, t0 + 0.005);
  g.gain.setValueAtTime(gain, t0 + dur - 0.01);
  g.gain.linearRampToValueAtTime(0, t0 + dur);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
  return new Promise((res) => setTimeout(res, durationMs + 30));
}

// LFM chirp ping (linear frequency sweep). Used for "play the chirp"
// in the chirp section.
export function playChirp(f0, f1, durationMs = 250, { gain = DEFAULT_GAIN } = {}) {
  const ac = getAudioContext();
  if (!ac) return Promise.resolve();
  if (ac.state === "suspended") ac.resume();
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = "sine";
  const t0 = ac.currentTime;
  const dur = durationMs / 1000;
  osc.frequency.setValueAtTime(f0, t0);
  osc.frequency.linearRampToValueAtTime(f1, t0 + dur);
  osc.connect(g).connect(ac.destination);
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(gain, t0 + 0.008);
  g.gain.setValueAtTime(gain, t0 + dur - 0.012);
  g.gain.linearRampToValueAtTime(0, t0 + dur);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
  return new Promise((res) => setTimeout(res, durationMs + 40));
}
