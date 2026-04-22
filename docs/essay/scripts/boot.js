// Page-load entry point. Each <figure data-figure="<key>"> in the
// essay HTML is a mount point — we look up the matching module in
// the registry and call its mount(rootEl) once.

import * as fig01 from "./figures/01-pressure.js";
import * as fig02 from "./figures/02-speed-of-sound.js";
import * as fig03 from "./figures/03-ping.js";
import * as fig04 from "./figures/04-echo.js";
import * as fig05 from "./figures/05-time-of-flight.js";
import * as fig06 from "./figures/06-spreading.js";
import * as fig07 from "./figures/07-resolution-problem.js";
import * as fig08 from "./figures/08-bandwidth.js";
import * as fig09 from "./figures/09-chirp.js";
import * as fig10 from "./figures/10-spectrogram.js";
import * as fig11 from "./figures/11-matched-filter.js";
import * as fig12 from "./figures/12-mf-with-noise.js";
import * as fig13 from "./figures/13-doppler.js";
import * as fig14 from "./figures/14-doppler-spectrum.js";

const registry = {
  "pressure-wave": fig01,
  "speed-of-sound": fig02,
  "ping": fig03,
  "echo": fig04,
  "time-of-flight": fig05,
  "spreading": fig06,
  "resolution-problem": fig07,
  "bandwidth": fig08,
  "chirp": fig09,
  "spectrogram": fig10,
  "matched-filter": fig11,
  "mf-with-noise": fig12,
  "doppler": fig13,
  "doppler-spectrum": fig14,
};

function bootFigures() {
  const mounts = document.querySelectorAll("[data-figure]");
  for (const el of mounts) {
    const key = el.dataset.figure;
    const mod = registry[key];
    if (!mod || typeof mod.mount !== "function") {
      console.warn(`[essay] no figure module registered for "${key}"`);
      continue;
    }
    try {
      mod.mount(el);
    } catch (err) {
      console.error(`[essay] failed to mount figure "${key}":`, err);
    }
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootFigures);
} else {
  bootFigures();
}
