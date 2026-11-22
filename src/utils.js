/**
 * Small dependency-free helpers shared by every module.
 * Nothing in here touches Anime.js, so it stays trivially testable.
 */

export const isBrowser = typeof window !== 'undefined' && typeof document !== 'undefined';

/** `document.querySelector` with a null-safe selector/element passthrough. */
export function resolveElement(target, scope = document) {
  if (!target) return null;
  if (typeof target === 'string') return scope.querySelector(target);
  if (target.nodeType === 1) return target;
  return null;
}

export const $ = (selector, scope = document) => resolveElement(selector, scope);
export const $$ = (selector, scope = document) =>
  typeof selector === 'string' ? Array.from(scope.querySelectorAll(selector)) : [];

export const clamp = (value, min, max) => (value < min ? min : value > max ? max : value);
export const lerp = (a, b, t) => a + (b - a) * t;
export const round = (value, precision = 2) => {
  const p = 10 ** precision;
  return Math.round(value * p) / p;
};

/** Wrap into [0, length). */
export const wrap = (value, length) => (length <= 0 ? 0 : ((value % length) + length) % length);

/** Wrap into [-length / 2, length / 2) — used for infinite offsets. */
export const signedWrap = (value, length) => (length <= 0 ? value : value - length * Math.round(value / length));

export function debounce(fn, wait = 120) {
  let timer = 0;
  const debounced = (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
  debounced.cancel = () => clearTimeout(timer);
  return debounced;
}

export function throttleRaf(fn) {
  let frame = 0;
  const throttled = (...args) => {
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      fn(...args);
    });
  };
  throttled.cancel = () => {
    cancelAnimationFrame(frame);
    frame = 0;
  };
  return throttled;
}

export function prefersReducedMotion() {
  if (!isBrowser || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Data attributes are strings; coerce them against the default's type. */
export function coerce(value, fallback) {
  if (value === '' || value == null) {
    return typeof fallback === 'boolean' ? true : value === '' ? '' : fallback;
  }
  if (typeof fallback === 'boolean') return !(value === 'false' || value === '0' || value === 'off');
  if (typeof fallback === 'number') {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }
  if (Array.isArray(fallback) || (fallback && typeof fallback === 'object')) {
    try {
      return JSON.parse(value);
    } catch {
      return fallback;
    }
  }
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (value !== '' && Number.isFinite(Number(value)) && String(Number(value)) === value.trim()) {
    return Number(value);
  }
  return value;
}

export const toCamel = (name) => name.replace(/-([a-z0-9])/gi, (_, c) => c.toUpperCase());
export const toKebab = (name) => name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();

/** `'12px'` / `12` / `'5%'` → `{ value, unit }` */
export function parseLength(input, fallback = 0) {
  if (typeof input === 'number') return { value: input, unit: 'px' };
  const match = String(input ?? '').trim().match(/^(-?[\d.]+)(px|%|rem|em|vw|vh)?$/);
  if (!match) return { value: fallback, unit: 'px' };
  return { value: Number(match[1]), unit: match[2] || 'px' };
}

/** Resolve a px value that may be given as a percentage of `base`. */
export function resolvePx(input, base, fallback = 0) {
  const { value, unit } = parseLength(input, fallback);
  if (unit === '%') return (base * value) / 100;
  return value;
}

export function mergeDeep(target, ...sources) {
  const out = { ...target };
  for (const source of sources) {
    if (!source || typeof source !== 'object') continue;
    for (const [key, value] of Object.entries(source)) {
      if (value === undefined) continue;
      const current = out[key];
      if (
        value &&
        typeof value === 'object' &&
        !Array.isArray(value) &&
        current &&
        typeof current === 'object' &&
        !Array.isArray(current)
      ) {
        out[key] = mergeDeep(current, value);
      } else {
        out[key] = value;
      }
    }
  }
  return out;
}

export const isInteractive = (target) =>
  !!(
    target &&
    target.closest &&
    target.closest(
      'a, button, input, textarea, select, label, [contenteditable]:not([contenteditable="false"]), [data-ajc-no-drag]',
    )
  );

/** Form fields and editable regions own their pointer/keyboard/wheel gestures. */
export const isFormField = (target) =>
  !!(
    target &&
    target.closest &&
    target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"])')
  );

/** Dispatch a namespaced DOM CustomEvent, ignoring user data that fails to clone. */
export function emitDomEvent(element, type, detail) {
  if (!element || !isBrowser) return;
  element.dispatchEvent(new CustomEvent(`ajc:${type}`, { detail, bubbles: true, cancelable: true }));
}

export function setStyles(element, styles) {
  for (const [key, value] of Object.entries(styles)) {
    if (value == null) continue;
    element.style[key] = value;
  }
}

export function clearStyles(element, properties = []) {
  for (const property of properties) element.style[property] = '';
}

export function createElement(tag, className, attributes = {}) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  for (const [key, value] of Object.entries(attributes)) {
    if (value == null || value === false) continue;
    if (key === 'html') element.innerHTML = value;
    else if (key === 'text') element.textContent = value;
    else element.setAttribute(key, value === true ? '' : String(value));
  }
  return element;
}

/** Render an arrow/dot option that may be an element, a selector or an HTML string. */
export function resolveTemplate(template, className, fallbackHtml) {
  if (!template) {
    const element = createElement('button', className, { html: fallbackHtml });
    return element;
  }
  if (template.nodeType === 1) {
    const element = template.cloneNode(true);
    element.classList.add(...className.split(' ').filter(Boolean));
    return element;
  }
  const source = String(template);
  if (source.trim().startsWith('<')) {
    const holder = document.createElement('div');
    holder.innerHTML = source.trim();
    const element = holder.firstElementChild || createElement('button', className);
    element.classList.add(...className.split(' ').filter(Boolean));
    return element;
  }
  const found = resolveElement(source);
  if (found) {
    const element = found;
    element.classList.add(...className.split(' ').filter(Boolean));
    // The author owns this node; Navigation must not remove it on rebuild.
    element.__ajcExternal = true;
    return element;
  }
  return createElement('button', className, { html: fallbackHtml });
}

/**
 * Resolve an absolute slide target into the nearest progress value.
 *
 * The origin is rounded to a whole slide: resolving against a fractional
 * progress (left behind by an interrupted drag or a mid-flight transition)
 * used to snap back onto that fraction instead of the nearest index. In loop
 * mode the result keeps the shortest direction from the origin and is never
 * wrapped, so `progress` stays monotonic across the loop boundary.
 */
export function resolveProgress(target, progress, length, loop, maxIndex = Math.max(0, length - 1)) {
  const requested = Math.round(Number(target));
  const last = Math.max(0, Math.round(maxIndex));
  if (!Number.isFinite(requested)) return Math.round(Number(progress)) || 0;
  if (!loop || length <= 1) return clamp(requested, 0, last);
  const origin = Math.round(Number(progress) || 0);
  return origin + signedWrap(requested - wrap(origin, length), length);
}

/**
 * Absolute target for `next()` / `prev()`: whole slides, never a fraction.
 * Unlike `resolveProgress` this keeps the requested direction for large
 * `slidesToScroll` values, so a forward step never animates backwards just
 * because the wrap in the other direction is shorter.
 */
export function stepProgress(progress, direction, step, length, loop, maxIndex = Math.max(0, length - 1)) {
  const amount = Math.max(1, Math.round(Number(step) || 1));
  const target = Math.round(Number(progress) || 0) + (direction < 0 ? -amount : amount);
  if (loop && length > 1) return target;
  return clamp(target, 0, Math.max(0, Math.round(maxIndex)));
}

/** Fractional index → { index, fraction } with wrap support. */
export function splitIndex(progress, length, loop) {
  const base = Math.floor(progress);
  const fraction = progress - base;
  const index = loop ? wrap(base, length) : clamp(base, 0, length - 1);
  return { index, fraction };
}
