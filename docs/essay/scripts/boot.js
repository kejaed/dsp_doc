// Page-load entry point. Each <figure data-figure="<key>"> in the
// essay HTML is a mount point — we look up the matching module in
// the registry and call its mount(rootEl) once.

import * as fig01 from "./figures/01-pressure.js";

const registry = {
  "pressure-wave": fig01,
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
