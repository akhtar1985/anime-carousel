/**
 * Options reference page.
 *
 * The option list is not written by hand: every key and default comes from
 * `src/defaults.js`, so adding an option to the plugin makes it appear here.
 * Only presentation metadata (type label, group, live control) lives below.
 */
import { DEFAULT_OPTIONS, ALIASES, MODES } from '../src/defaults.js';
import { AnimeCarousel } from '../src/index.js';

const $ = (selector, scope = document) => scope.querySelector(selector);
const $$ = (selector, scope = document) => Array.from(scope.querySelectorAll(selector));

const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ══════════════════════════════════════════════════════════════════════
   Groups
   ══════════════════════════════════════════════════════════════════════ */

const GROUPS = [
  { id: 'layout', title: 'Layout', intro: 'Axis, sizing, wrapping and centring.' },
  { id: 'motion', title: 'Motion', intro: 'Duration, easing and spring physics.' },
  { id: 'autoplay', title: 'Autoplay', intro: 'Timers and every pause rule.' },
  { id: 'navigation', title: 'Navigation', intro: 'Arrows and pagination.' },
  { id: 'interaction', title: 'Interaction', intro: 'Drag, wheel and keyboard.' },
  { id: 'media', title: 'Media', intro: 'Progressive image loading.' },
  { id: 'responsive', title: 'Responsive & sync', intro: 'Breakpoints and controller links.' },
  { id: 'effects', title: 'Per-mode effects', intro: 'Effect objects for the 3D and motion modes.' },
  { id: 'misc', title: 'Accessibility & misc', intro: 'Roles, labels, announcements and class names.' },
  { id: 'callbacks', title: 'Callbacks', intro: 'Event handlers — functions, so read-only here.' },
];

/* ══════════════════════════════════════════════════════════════════════
   Metadata — descriptors only, values are read from DEFAULT_OPTIONS
   ══════════════════════════════════════════════════════════════════════ */

const S = (desc) => ({ widget: 'switch', type: 'boolean', desc, editable: true });
const R = (desc, min, max, step = 1) => ({
  widget: 'range',
  type: 'number',
  min,
  max,
  step,
  desc,
  editable: true,
});
const SEL = (desc, values) => ({
  widget: 'select',
  values,
  type: values.map((value) => (typeof value === 'number' ? String(value) : `'${value}'`)).join(' | '),
  desc,
  editable: true,
});
const T = (desc) => ({ widget: 'text', type: 'string', desc, editable: true });
const RO = (desc, type) => ({ widget: 'fixed', type, desc, editable: false });

const META = {};

function group(id, entries) {
  for (const [key, meta] of Object.entries(entries)) META[key] = { g: id, ...meta };
}

group('layout', {
  mode: SEL('Transition mode used by the engine.', MODES),
  initialSlide: R('Slide shown after init. Clamped to the slide count.', 0, 4, 1),
  classPrefix: RO('Class-name namespace for generated elements. Set before init.', 'string'),
  slidesToShow: SEL('Slides per view. "auto" measures each slide, fractions are allowed.', [1, 1.5, 2, 2.5, 3, 'auto']),
  slidesToScroll: R('Step used by next() / prev() and by pagination pages.', 1, 3, 1),
  spaceBetween: R('Gap between slides in px.', 0, 40, 2),
  infinite: S('Wrap around with modular index math — no clone nodes.'),
  centerMode: S('Centre the active slide; pair it with centerPadding.'),
  centerPadding: T('Inset on both sides in centre mode (px or %).'),
  vertical: S('Lay the slides on the Y axis.'),
  verticalSwiping: S('Drag along Y instead of X.'),
  rtl: S('Mirror the layout and the drag direction.'),
  adaptiveHeight: S('Animate the viewport height to the active slide.'),
  watchOverflow: S('Disable arrows and looping when every slide already fits.'),
});

group('motion', {
  speed: R('Transition duration in ms. 0 jumps instantly.', 0, 1600, 50),
  easing: T('Anime.js v4 ease string: out(3), inOutQuad, outBack, cubicBezier(…).'),
  spring: S('Animate progress with createSpring() instead of the easing curve.'),
  springConfig: RO('Parameters handed to createSpring().', '{ stiffness, damping, mass, velocity }'),
  reducedMotion: SEL('"respect" disables motion and decorative effects under prefers-reduced-motion.', [
    'respect',
    'ignore',
  ]),
  perspective: R('3D depth for coverflow, cards, flip and cube.', 400, 2400, 100),
});

group('autoplay', {
  autoplay: S('Start the timer on init.'),
  autoplaySpeed: R('Delay between slides in ms.', 600, 8000, 100),
  pauseOnHover: S('Pause while the pointer is over the slider.'),
  pauseOnFocus: S('Pause while focus is inside the slider.'),
  pauseOnDotsHover: S('Pause when only the pagination is hovered.'),
  pauseOnInteraction: S('Stop after a drag, wheel or key press until play() is called.'),
  stopOnLastSlide: S('Non-loop only: stop at the last slide.'),
});

group('navigation', {
  arrows: S('Render the previous and next buttons.'),
  prevArrow: RO('Custom previous button: HTML string, selector or element.', 'string | Element'),
  nextArrow: RO('Custom next button: HTML string, selector or element.', 'string | Element'),
  hideOnEdges: S('Fade the arrows out at the first and last slide when not looping.'),
  dots: S('Render pagination.'),
  dotsType: SEL('Pagination style.', ['bullets', 'fraction', 'progress']),
  dynamicBullets: S('Shrink the bullets that are far from the active one.'),
  customPaging: RO('(page, dot) => string — per-bullet HTML.', 'function'),
  dotsPerPage: S('One bullet per page (slidesToScroll) instead of per slide.'),
  paginationClickable: S('Bullets navigate on click.'),
});

group('interaction', {
  draggable: S('Pointer and touch dragging.'),
  swipeToSlide: S('Snap to the nearest slide instead of stepping by slidesToScroll.'),
  touchThreshold: R('px the pointer must travel before the gesture counts as a drag.', 0, 20, 1),
  dragResistance: R('Resistance when dragging past the first or last slide.', 0, 1, 0.05),
  mousewheel: S('Navigate with the wheel (380 ms cooldown).'),
  keyboard: S('Arrow keys, Home and End while the slider is focused.'),
  focusable: S('Give the viewport tabindex="0".'),
  focusOnSelect: S('Clicking a slide navigates to it.'),
  emitEvents: S('Dispatch ajc:* DOM events for every change.'),
});

group('media', {
  lazyLoad: SEL('Progressive image loading.', [false, 'ondemand', 'progressive']),
  lazyLoadSelector: T('Elements upgraded from data-src / data-srcset.'),
});

group('responsive', {
  responsive: RO('Slick array (max-width) or Swiper map (min-width).', 'array | object'),
  breakpointsBase: SEL('Measure the window or the slider container.', ['window', 'container']),
  asNavFor: RO('Sync target(s): selector, element, instance or array.', 'string | Element | instance | array'),
  syncClick: S('Clicking a slide also drives the synced sliders.'),
});

group('effects', {
  fadeEffect: RO('{ crossFade, scale, blur }', 'object'),
  coverflowEffect: RO('{ rotate, depth, scale, stretch, modifier, opacity }', 'object'),
  cardsEffect: RO('{ offsetX, offsetY, rotate, scale, maxStack, opacity }', 'object'),
  flipEffect: RO('{ rotate, depth, opacity }', 'object'),
  cubeEffect: RO('{ rotate, depth, shadow }', 'object'),
  kenBurns: RO('{ targets, from, to, duration, alternate, panX, panY }', 'object'),
  staggerEffect: RO('{ targets, each, duration, distance, outDuration, ease, from }', 'object'),
  marquee: RO('{ speed, direction, pauseOnHover, duplicated }', 'object'),
});

group('misc', {
  a11y: S('Roles, aria-labels and the polite live region.'),
  announce: S('Announce index changes for screen readers.'),
  ariaLabels: RO('{ region, prev, next, dots, slide }', 'object'),
});

group(
  'callbacks',
  Object.fromEntries(
    [
      ['onInit', 'After the first render.'],
      ['onBeforeChange', 'At the start of a transition, with the incoming index.'],
      ['onSlideChange', 'At the start of a transition.'],
      ['onAfterChange', 'When the transition settles.'],
      ['onTransitionEnd', 'When the transition settles.'],
      ['onBreakpoint', 'When a responsive breakpoint engages.'],
      ['onDestroy', 'During teardown.'],
      ['onDragStart', 'When the drag threshold is crossed.'],
      ['onDragMove', 'On every drag frame.'],
      ['onDragEnd', 'When the pointer is released.'],
      ['onAutoplayStart', 'When the timer starts.'],
      ['onAutoplayStop', 'When the timer stops.'],
      ['onReachStart', 'When a non-looping strip reaches the first slide.'],
      ['onReachEnd', 'When a non-looping strip reaches the last slide.'],
    ].map(([key, desc]) => [key, RO(desc, '(detail) => void')]),
  ),
);

/* ══════════════════════════════════════════════════════════════════════
   Helpers
   ══════════════════════════════════════════════════════════════════════ */

const OPTION_KEYS = Object.keys(DEFAULT_OPTIONS);
const TOTAL = OPTION_KEYS.length;
const LIVE_KEYS = OPTION_KEYS.filter((key) => META[key] && META[key].editable);

// `slidesperview`, `centeredslides` and `touchmove` are lowercase duplicates of
// aliases that already have a camelCase spelling — not worth documenting twice.
const NON_ALIASES = new Set(['slidesperview', 'centeredslides', 'touchmove']);

const ALIAS_BY_KEY = Object.entries(ALIASES).reduce((acc, [alias, target]) => {
  if (NON_ALIASES.has(alias)) return acc;
  (acc[target] ||= []).push(alias);
  return acc;
}, {});

const escapeHtml = (value) =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const toAttribute = (key) => `data-${key.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()}`;

/** JS literal for a default value, used by the snippets. */
function literal(value) {
  if (typeof value === 'function') return '/* function */';
  if (value === undefined) return 'undefined';
  return JSON.stringify(value);
}

function rowSnippet(key) {
  if (META[key] && META[key].g === 'callbacks') return `${key}: (detail) => { /* … */ },`;
  return `${key}: ${literal(DEFAULT_OPTIONS[key])},`;
}

function groupSnippet(groupId, keys) {
  const body = keys.map((key) => `  ${rowSnippet(key).replace(/,$/, '')},`).join('\n');
  return `new AnimeCarousel('#hero', {\n${body}\n});`;
}

const debounce = (fn, wait = 90) => {
  let timer = 0;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
};

/* ══════════════════════════════════════════════════════════════════════
   State — seeded from defaults, optionally overridden by ?query
   ══════════════════════════════════════════════════════════════════════ */

const SEED = { infinite: true, dots: true };
const state = { ...DEFAULT_OPTIONS, ...SEED };

function coerce(key, raw) {
  const fallback = DEFAULT_OPTIONS[key];
  if (typeof fallback === 'boolean') return !['false', '0', 'off', 'no', ''].includes(String(raw).toLowerCase());
  if (typeof fallback === 'number') {
    const n = Number(raw);
    return Number.isFinite(n) ? n : fallback;
  }
  if (raw === 'auto') return 'auto';
  return raw;
}

for (const [key, raw] of new URLSearchParams(window.location.search)) {
  if (!META[key] || !META[key].editable) continue;
  state[key] = coerce(key, raw);
}

/* ══════════════════════════════════════════════════════════════════════
   Mini slider
   ══════════════════════════════════════════════════════════════════════ */

const logEl = $('#mini-log');
const readout = $('#mini-readout');
const logLines = [];

function log(message) {
  logLines.unshift(`<span><b>${new Date().toLocaleTimeString()}</b> ${escapeHtml(message)}</span>`);
  logLines.length = Math.min(logLines.length, 6);
  logEl.innerHTML = logLines.join('');
}

function liveOptions() {
  const options = { mode: state.mode };
  for (const key of LIVE_KEYS) options[key] = state[key];
  // Reduced motion: the plugin respects the media query already, but a 0 speed
  // makes the options page itself calm rather than animated.
  if (reduce) options.speed = 0;

  options.onBeforeChange = (detail) => log(`onBeforeChange → index ${detail.index}`);
  options.onAfterChange = (detail) => {
    log(`onAfterChange index ${detail.index}`);
    status();
  };
  options.onBreakpoint = (detail) => log(`onBreakpoint ${detail.breakpoint}px`);
  options.onDragEnd = () => log('onDragEnd');
  return options;
}

let mini = new AnimeCarousel('#mini-slider', liveOptions());

function status() {
  if (!mini || mini.destroyed) return;
  readout.textContent = `${mini.activeIndex + 1} / ${mini.count} · ${state.mode} · ${mini.options.slidesToShow} per view · loop ${
    mini.looping ? 'on' : 'off'
  }`;
}

function apply() {
  mini.setMode(state.mode, liveOptions());
  if (state.autoplay) mini.play();
  else mini.pause();
  renderConfig();
  status();
}

const applySoon = debounce(apply, 100);

/* ══════════════════════════════════════════════════════════════════════
   Rendering
   ══════════════════════════════════════════════════════════════════════ */

function control(key, meta) {
  const value = state[key];

  if (!meta.editable) {
    return `<span class="ro-tag" title="Set through JavaScript">read-only</span>`;
  }

  if (meta.widget === 'switch') {
    return `<label class="mini-switch">
      <input type="checkbox" role="switch" data-opt="${key}" ${value ? 'checked' : ''} aria-label="${key}" />
      <span aria-hidden="true"></span>
    </label>`;
  }

  if (meta.widget === 'select') {
    const options = meta.values
      .map((option) => {
        const optionValue = String(option);
        const selected = String(value) === optionValue ? ' selected' : '';
        return `<option value="${escapeHtml(optionValue)}"${selected}>${escapeHtml(optionValue)}</option>`;
      })
      .join('');
    return `<select class="mini-select" data-opt="${key}" aria-label="${key}">${options}</select>`;
  }

  if (meta.widget === 'range') {
    return `<span class="mini-range">
      <input type="range" data-opt="${key}" min="${meta.min}" max="${meta.max}" step="${meta.step}"
        value="${value}" aria-label="${key}" />
      <output data-out="${key}">${value}</output>
    </span>`;
  }

  return `<input class="mini-text" type="text" data-opt="${key}" value="${escapeHtml(value)}" aria-label="${key}" />`;
}

function renderRow(key) {
  const meta = META[key];
  const aliases = ALIAS_BY_KEY[key];
  const searchBlob = [
    key,
    toAttribute(key),
    meta.desc,
    meta.type,
    Array.isArray(aliases) ? aliases.join(' ') : '',
    String(DEFAULT_OPTIONS[key]),
  ]
    .join(' ')
    .toLowerCase();

  return `<tr class="opt-row" id="opt-${key}" data-group="${meta.g}" data-search="${escapeHtml(searchBlob)}">
    <th scope="row">
      <span class="opt-row__name">
        <code>${key}</code>
        <button class="icon-btn" type="button" data-copy="${key}" aria-label="Copy the ${key} snippet" title="Copy snippet">⧉</button>
      </span>
      <span class="opt-row__attr"><code>${toAttribute(key)}</code></span>
      <span class="opt-row__desc">${meta.desc}</span>
    </th>
    <td><code>${escapeHtml(meta.type)}</code></td>
    <td><code>${escapeHtml(literal(DEFAULT_OPTIONS[key]))}</code></td>
    <td>${aliases && aliases.length ? `<code>${escapeHtml(aliases.join(', '))}</code>` : '<span class="muted">—</span>'}</td>
    <td class="opt-row__control">${control(key, meta)}</td>
  </tr>`;
}

function renderGroups() {
  $('#groups').innerHTML = GROUPS.map((group) => {
    const keys = OPTION_KEYS.filter((key) => META[key] && META[key].g === group.id);
    if (!keys.length) return '';
    return `<section class="opt-group" id="group-${group.id}" aria-labelledby="group-${group.id}-title">
      <header class="opt-group__head">
        <h2 id="group-${group.id}-title">${group.title}</h2>
        <span class="opt-group__count">${keys.length}</span>
        <p>${group.intro}</p>
      </header>
      <div class="table-scroll">
        <table class="opt-table">
          <caption class="sr-only">${group.title} options</caption>
          <thead>
            <tr>
              <th scope="col">Option</th>
              <th scope="col">Type</th>
              <th scope="col">Default</th>
              <th scope="col">Aliases</th>
              <th scope="col">Live</th>
            </tr>
          </thead>
          <tbody>${keys.map(renderRow).join('')}</tbody>
        </table>
      </div>
      <details class="snippet">
        <summary>Copy-ready snippet <span>${keys.length} keys</span></summary>
        <pre><code>${escapeHtml(groupSnippet(group.id, keys))}</code></pre>
        <button class="btn btn--ghost" type="button" data-copy-group="${group.id}">Copy group</button>
      </details>
    </section>`;
  }).join('');
}

function renderToc() {
  $('#toc').innerHTML = `<p class="toc__title">On this page</p><ul>${GROUPS.map(
    (group) => `<li><a href="#group-${group.id}">${group.title}</a></li>`,
  ).join('')}<li><a href="#modes">Mode ↔ effect</a></li><li><a href="#attributes">Data attributes</a></li></ul>`;
}

function renderChips() {
  $('#chips').innerHTML = `<button class="chip is-active" type="button" data-group="all">All</button>${GROUPS.map(
    (group) => `<button class="chip" type="button" data-group="${group.id}">${group.title}</button>`,
  ).join('')}`;
}

function renderConfig() {
  const lines = [];
  for (const key of OPTION_KEYS) {
    if (META[key] && META[key].g === 'callbacks') continue;
    if (JSON.stringify(state[key]) === JSON.stringify(DEFAULT_OPTIONS[key])) continue;
    lines.push(`  ${key}: ${literal(state[key])},`);
  }
  $('#config-code').textContent = lines.length
    ? `new AnimeCarousel('#hero', {\n${lines.join('\n')}\n});`
    : '// all defaults — flip a switch above';
}

function renderModes() {
  const info = {
    slide: ['—', 'Translate on the active axis, optionally with spring physics.'],
    fade: ['fadeEffect', 'Opacity, with optional scale and blur on the leaving slide.'],
    coverflow: ['coverflowEffect', 'rotateY plus translateZ and scale on a shared perspective.'],
    cards: ['cardsEffect', 'Deck offsets, rotateZ and a shadowed stack behind the active card.'],
    marquee: ['marquee', 'One looping timeline translating a cloned strip.'],
    kenburns: ['kenBurns', 'Pan and zoom timeline on the active media.'],
    staggered: ['staggerEffect', 'createTimeline() with stagger() across data-ajc-reveal nodes.'],
    flip: ['flipEffect', '3D rotateY flip with a depth offset.'],
    cube: ['cubeEffect', 'A real cube: faces positioned at half the slide size.'],
  };

  $('#modes-body').innerHTML = MODES.map((mode) => {
    const [effect, description] = info[mode] || ['—', ''];
    const effectKey = effect !== '—' ? `<code><a href="#opt-${effect}">${effect}</a></code>` : '<span class="muted">—</span>';
    return `<tr>
      <td><code>${mode}</code></td>
      <td>${effectKey}</td>
      <td>${description}</td>
      <td><button class="btn btn--ghost btn--sm" type="button" data-mode-try="${mode}">Try</button></td>
    </tr>`;
  }).join('');
}

/* ══════════════════════════════════════════════════════════════════════
   Filtering
   ══════════════════════════════════════════════════════════════════════ */

let query = '';
let groupFilter = 'all';

function refilter() {
  const needle = query.trim().toLowerCase();
  let visible = 0;

  for (const row of $$('#groups .opt-row')) {
    const inGroup = groupFilter === 'all' || row.dataset.group === groupFilter;
    const matches = !needle || row.dataset.search.includes(needle);
    const show = inGroup && matches;
    row.hidden = !show;
    if (show) visible += 1;
  }

  for (const section of $$('#groups .opt-group')) {
    section.hidden = !$$('.opt-row', section).some((row) => !row.hidden);
  }

  $('#match-count').textContent = !needle && groupFilter === 'all'
    ? `${TOTAL} options`
    : `${visible} of ${TOTAL} options`;
}

/* ══════════════════════════════════════════════════════════════════════
   Clipboard
   ══════════════════════════════════════════════════════════════════════ */

const copyStatus = $('#copy-status');

/** execCommand fallback for when the Clipboard API is blocked. */
function legacyCopy(text) {
  const area = document.createElement('textarea');
  area.value = text;
  area.setAttribute('readonly', '');
  area.style.position = 'fixed';
  area.style.top = '-1000px';
  area.style.opacity = '0';
  document.body.appendChild(area);
  area.select();
  let ok = false;
  try {
    ok = document.execCommand('copy');
  } catch {
    ok = false;
  }
  area.remove();
  return ok;
}

async function copy(text, label) {
  let ok = false;

  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      ok = true;
    } catch {
      ok = false;
    }
  }

  if (!ok) ok = legacyCopy(text);
  copyStatus.textContent = ok ? `Copied ${label}` : `Could not copy ${label}`;
}

/* ══════════════════════════════════════════════════════════════════════
   Wiring
   ══════════════════════════════════════════════════════════════════════ */

$('#groups').addEventListener('input', (event) => {
  const input = event.target.closest('[data-opt]');
  if (!input) return;

  const key = input.dataset.opt;
  const meta = META[key];
  if (!meta || !meta.editable) return;

  let value;
  if (meta.widget === 'switch') value = input.checked;
  else if (meta.widget === 'select' && key === 'slidesToShow') {
    value = input.value === 'auto' ? 'auto' : Number(input.value);
  } else if (meta.widget === 'select' && typeof DEFAULT_OPTIONS[key] === 'boolean') {
    value = input.value === 'true';
  } else if (meta.widget === 'range') value = Number(input.value);
  else value = input.value;

  state[key] = value;

  const output = input.parentElement.querySelector('output');
  if (output) output.textContent = String(value);

  const immediate = meta.widget === 'switch' || meta.widget === 'select';
  if (immediate) {
    apply();
    if (key === 'initialSlide') mini.goTo(value, true);
  } else {
    applySoon();
  }
});

$('#chips').addEventListener('click', (event) => {
  const chip = event.target.closest('[data-group]');
  if (!chip) return;
  groupFilter = chip.dataset.group;
  $$('#chips .chip').forEach((item) => item.classList.toggle('is-active', item === chip));
  refilter();
});

$('#search').addEventListener('input', (event) => {
  query = event.target.value;
  refilter();
});

document.addEventListener('click', (event) => {
  const rowButton = event.target.closest('[data-copy]');
  if (rowButton) {
    const key = rowButton.dataset.copy;
    copy(rowSnippet(key), key);
    rowButton.classList.add('is-copied');
    setTimeout(() => rowButton.classList.remove('is-copied'), 900);
    return;
  }

  const groupButton = event.target.closest('[data-copy-group]');
  if (groupButton) {
    const groupId = groupButton.dataset.copyGroup;
    const keys = OPTION_KEYS.filter((key) => META[key] && META[key].g === groupId);
    copy(groupSnippet(groupId, keys), `${groupId} group`);
    return;
  }

  if (event.target.closest('[data-copy-config]')) {
    copy($('#config-code').textContent, 'configuration');
    return;
  }

  const modeButton = event.target.closest('[data-mode-try]');
  if (modeButton) {
    state.mode = modeButton.dataset.modeTry;
    const select = $('[data-opt="mode"]');
    if (select) select.value = state.mode;
    apply();
    log(`setMode('${state.mode}')`);
    $('#mini-slider').scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' });
  }
});

$('.mini__bar').addEventListener('click', (event) => {
  const button = event.target.closest('[data-mini]');
  if (!button) return;

  switch (button.dataset.mini) {
    case 'prev':
      mini.prev();
      break;
    case 'next':
      mini.next();
      break;
    case 'play':
      state.autoplay = true;
      syncControl('autoplay');
      apply();
      log('play()');
      break;
    case 'pause':
      state.autoplay = false;
      syncControl('autoplay');
      apply();
      log('pause()');
      break;
    case 'reset':
      reset();
      break;
    default:
      break;
  }
});

/** Keep a control in sync when the API changes the matching option. */
function syncControl(key) {
  const input = $(`[data-opt="${key}"]`);
  if (!input) return;
  if (input.type === 'checkbox') input.checked = Boolean(state[key]);
  else input.value = String(state[key]);
}

function reset() {
  mini.destroy();
  Object.assign(state, DEFAULT_OPTIONS, SEED);
  mini = new AnimeCarousel('#mini-slider', liveOptions());
  renderGroups();
  renderConfig();
  refilter();
  status();
  log('reset — destroy() then new AnimeCarousel()');
}

/* ══════════════════════════════════════════════════════════════════════
   Boot
   ══════════════════════════════════════════════════════════════════════ */

const missing = OPTION_KEYS.filter((key) => !META[key]);
const unknown = Object.keys(META).filter((key) => !(key in DEFAULT_OPTIONS));

if (missing.length || unknown.length) {
  const banner = $('#drift-banner');
  banner.hidden = false;
  banner.textContent = [
    missing.length ? `Missing metadata for: ${missing.join(', ')}` : '',
    unknown.length ? `Metadata for unknown options: ${unknown.join(', ')}` : '',
  ]
    .filter(Boolean)
    .join(' · ');
}

renderChips();
renderToc();
renderGroups();
renderModes();
renderConfig();
refilter();
status();

if (reduce) {
  $('#mini-hint').innerHTML =
    '<code>prefers-reduced-motion: reduce</code> is active, so the playground runs with <code>speed: 0</code>.';
}

// Deep link: settings.html#opt-slidesToShow
if (window.location.hash.startsWith('#opt-')) {
  const row = document.getElementById(window.location.hash.slice(1));
  if (row) {
    // A jump rather than a smooth scroll, even though the page sets
    // scroll-behaviour: smooth — on load the user wants the row, not an animation.
    const root = document.documentElement;
    const previous = root.style.scrollBehavior;
    root.style.scrollBehavior = 'auto';
    row.scrollIntoView({ block: 'center', behavior: 'auto' });
    root.style.scrollBehavior = previous;
    row.classList.add('is-target');
    setTimeout(() => row.classList.remove('is-target'), 1600);
  }
}

$('#mini-slider').addEventListener('ajc:change', () => log('DOM event ajc:change'));

// Handy while exploring from the console.
window.settingsPage = { mini: () => mini, state, DEFAULT_OPTIONS, META };
