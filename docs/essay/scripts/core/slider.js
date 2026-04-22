// Tiny styled <input type=range> with a label and a live numeric
// readout. Native event firing on every drag pixel — figures redraw
// fast enough that we don't need to debounce.

export function makeSlider(parent, opts) {
  const {
    min, max, value, step = (max - min) / 100,
    label, unit = "", format,
    onInput,
  } = opts;

  const wrap = document.createElement("label");
  wrap.className = "slider-row";

  const labelEl = document.createElement("span");
  labelEl.className = "slider-label";
  labelEl.textContent = label;

  const input = document.createElement("input");
  input.type = "range";
  input.min = String(min);
  input.max = String(max);
  input.step = String(step);
  input.value = String(value);

  const readout = document.createElement("span");
  readout.className = "slider-readout";

  const fmt = format || ((v) => {
    const decimals = step < 1 ? Math.max(1, Math.ceil(-Math.log10(step))) : 0;
    return v.toFixed(decimals) + unit;
  });

  const paint = (v) => { readout.textContent = fmt(v); };
  paint(parseFloat(input.value));

  input.addEventListener("input", () => {
    const v = parseFloat(input.value);
    paint(v);
    if (onInput) onInput(v);
  });

  wrap.append(labelEl, input, readout);
  parent.appendChild(wrap);
  return {
    el: input,
    get value() { return parseFloat(input.value); },
    set value(v) { input.value = String(v); paint(v); },
  };
}

// Toggle button that flips between two visual states. On click, calls
// onToggle(isOn). Useful for play/stop, mute, bypass-MF.
export function makeToggle(parent, opts) {
  const { labelOff, labelOn, value = false, onToggle } = opts;
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "scene-button";
  let on = value;
  const paint = () => {
    btn.textContent = on ? labelOn : labelOff;
    btn.classList.toggle("is-on", on);
    btn.setAttribute("aria-pressed", String(on));
  };
  btn.addEventListener("click", () => {
    on = !on;
    paint();
    if (onToggle) onToggle(on);
  });
  paint();
  parent.appendChild(btn);
  return {
    el: btn,
    get value() { return on; },
    set value(v) { on = !!v; paint(); },
  };
}
