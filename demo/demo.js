/**
 * Demo bootstrap. Everything here is showcase code — the plugin lives in /src.
 * Anime.js is resolved by the import map in index.html.
 */
import { AnimeCarousel } from '../src/index.js';
import { animate, stagger } from 'animejs';

const $ = (selector, scope = document) => scope.querySelector(selector);
const $$ = (selector, scope = document) => Array.from(scope.querySelectorAll(selector));

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ── event log ──────────────────────────────────────────────────────── */

const consoleEl = $('#console');
const logLines = [];

function log(message) {
  logLines.unshift(message);
  logLines.length = Math.min(logLines.length, 7);
  consoleEl.innerHTML = logLines.map((line) => `<span>${line}</span>`).join('');
}

/* ── playground state ───────────────────────────────────────────────── */

const state = {
  mode: 'slide',
  slidesToShow: 1,
  spaceBetween: 16,
  speed: 600,
  infinite: true,
  centerMode: false,
  spring: false,
  vertical: false,
  rtl: false,
  autoplay: false,
  arrows: true,
  dots: true,
  dotsType: 'bullets',
};

function playgroundOptions() {
  return {
    mode: state.mode,
    slidesToShow: state.slidesToShow,
    spaceBetween: state.spaceBetween,
    speed: state.speed,
    infinite: state.infinite,
    centerMode: state.centerMode,
    centerPadding: state.centerMode ? '40px' : '0px',
    spring: state.spring,
    springConfig: { stiffness: 78, damping: 15, mass: 1, velocity: 0 },
    vertical: state.vertical,
    verticalSwiping: true,
    rtl: state.rtl,
    arrows: state.arrows,
    dots: state.dots,
    dotsType: state.dotsType,
    draggable: true,
    keyboard: true,
    mousewheel: false,
    autoplay: false,
    pauseOnDotsHover: true,
    onBeforeChange: (detail) => log(`onBeforeChange  ${detail.previousIndex} → ${detail.index}`),
    onAfterChange: (detail) => log(`onAfterChange   index ${detail.index}`),
    onDragStart: () => log('onDragStart'),
    onReachEnd: () => log('onReachEnd'),
  };
}

let pg = new AnimeCarousel('#pg', playgroundOptions());

function applyPlayground() {
  pg.setMode(state.mode, playgroundOptions());
  if (state.autoplay) pg.play();
  else pg.pause();

  $('#out-s2s').textContent = String(state.slidesToShow);
  $('#out-gap').textContent = String(state.spaceBetween);
  $('#out-speed').textContent = String(state.speed);
}

/* mode chips */
$('#mode-list').addEventListener('click', (event) => {
  const button = event.target.closest('[data-mode]');
  if (!button) return;
  $$('#mode-list .chip').forEach((chip) => chip.classList.toggle('is-active', chip === button));
  state.mode = button.dataset.mode;
  applyPlayground();
  log(`setMode('${state.mode}')`);
});

/* ranges */
$('#opt-s2s').addEventListener('input', (event) => {
  state.slidesToShow = Number(event.target.value);
  applyPlayground();
});
$('#opt-gap').addEventListener('input', (event) => {
  state.spaceBetween = Number(event.target.value);
  applyPlayground();
});
$('#opt-speed').addEventListener('input', (event) => {
  state.speed = Number(event.target.value);
  applyPlayground();
});

/* select */
$('#opt-dots').addEventListener('change', (event) => {
  state.dotsType = event.target.value;
  applyPlayground();
});

/* switches */
const switches = {
  'opt-loop': (value) => (state.infinite = value),
  'opt-center': (value) => (state.centerMode = value),
  'opt-spring': (value) => (state.spring = value),
  'opt-autoplay': (value) => (state.autoplay = value),
  'opt-arrows': (value) => (state.arrows = value),
  'opt-dots': (value) => (state.dots = value),
  'opt-vertical': (value) => (state.vertical = value),
  'opt-rtl': (value) => (state.rtl = value),
};

Object.entries(switches).forEach(([id, setter]) => {
  const input = $(`#${id}`);
  if (!input) return;
  input.addEventListener('change', () => {
    setter(input.checked);
    applyPlayground();
  });
});

/* ── API buttons ────────────────────────────────────────────────────── */

let added = 0;

$$('[data-api]').forEach((button) => {
  button.addEventListener('click', () => {
    const action = button.dataset.api;
    if (action === 'prev') pg.prev();
    if (action === 'next') pg.next();
    if (action === 'goto') pg.goTo(3);
    if (action === 'play') pg.play();
    if (action === 'pause') pg.pause();
    if (action === 'add') {
      added += 1;
      pg.addSlide(
        `<div class="dslide dslide--text"><div class="dslide__caption">
           <span class="dslide__tag">Injected</span>
           <h3>Slide ${added}</h3>
           <p>Created with addSlide(html, 1).</p>
         </div></div>`,
        1,
      );
      log(`addSlide(html, 1) → ${pg.count} slides`);
    }
    if (action === 'remove') {
      const index = pg.activeIndex;
      pg.removeSlide(index);
      log(`removeSlide(${index}) → ${pg.count} slides`);
    }
    if (action === 'refresh') {
      pg.refresh();
      log('refresh()');
    }
    if (action === 'destroy') {
      pg.destroy();
      pg = new AnimeCarousel('#pg', playgroundOptions());
      if (state.autoplay) pg.play();
      log('destroy() → new AnimeCarousel()');
    }
  });
});

/* DOM custom events, alongside the callbacks */
$('#pg').addEventListener('ajc:change', (event) => log(`ajc:change      ${event.detail.index}`));

/* ── synchronised gallery ───────────────────────────────────────────── */

const thumbs = new AnimeCarousel('#g-thumbs', {
  slidesToShow: 5,
  spaceBetween: 8,
  infinite: true,
  centerMode: true,
  focusOnSelect: true,
  syncClick: true,
  arrows: false,
  dots: false,
  speed: 450,
  asNavFor: '#g-main',
});

const gallery = new AnimeCarousel('#g-main', {
  infinite: true,
  speed: 700,
  dots: true,
  dotsType: 'fraction',
  arrows: true,
  asNavFor: '#g-thumbs',
  onAfterChange: (detail) => {
    const status = $('#sync-status');
    if (status) status.textContent = `Slide ${detail.index + 1} of ${detail.total}`;
  },
});

gallery.sync(thumbs);

/* ── mode demos ─────────────────────────────────────────────────────── */

new AnimeCarousel('#d-coverflow', {
  mode: 'coverflow',
  slidesToShow: 1.6,
  centerMode: true,
  spaceBetween: 0,
  infinite: true,
  speed: 700,
  arrows: true,
  dots: false,
  coverflowEffect: { rotate: 36, depth: 190, scale: 0.82, stretch: 0, modifier: 1, opacity: 0.65 },
});

new AnimeCarousel('#d-cards', {
  mode: 'cards',
  infinite: true,
  speed: 650,
  arrows: true,
  dots: false,
  cardsEffect: { offsetX: 20, offsetY: 14, rotate: 3, scale: 0.93, maxStack: 3 },
});

new AnimeCarousel('#d-cube', {
  mode: 'cube',
  infinite: true,
  speed: 750,
  arrows: true,
  dots: false,
  cubeEffect: { rotate: 90, depth: 0 },
});

new AnimeCarousel('#d-flip', {
  mode: 'flip',
  infinite: true,
  speed: 750,
  arrows: true,
  dots: false,
  flipEffect: { rotate: 90, depth: 140, opacity: 0.2 },
});

new AnimeCarousel('#d-fade', {
  mode: 'fade',
  infinite: true,
  autoplay: true,
  autoplaySpeed: 2800,
  speed: 900,
  arrows: true,
  dots: true,
  fadeEffect: { crossFade: true, scale: 0.05 },
});

new AnimeCarousel('#d-kenburns', {
  mode: 'kenburns',
  infinite: true,
  autoplay: true,
  autoplaySpeed: 3800,
  speed: 900,
  arrows: false,
  dots: true,
  kenBurns: { from: 1, to: 1.16, duration: 7000, alternate: true, panX: -14 },
});

new AnimeCarousel('#d-stagger', {
  mode: 'staggered',
  infinite: true,
  autoplay: true,
  autoplaySpeed: 3400,
  speed: 800,
  arrows: true,
  dots: true,
  staggerEffect: { targets: '[data-ajc-reveal] > *', each: 70, distance: 26, duration: 720 },
});

new AnimeCarousel('#d-vertical', {
  vertical: true,
  verticalSwiping: true,
  infinite: true,
  spaceBetween: 12,
  speed: 700,
  arrows: false,
  dots: true,
});

new AnimeCarousel('#d-rtl', {
  rtl: true,
  slidesToShow: 1.15,
  centerMode: true,
  centerPadding: '0px',
  spaceBetween: 12,
  infinite: true,
  arrows: false,
  dots: true,
});

new AnimeCarousel('#d-center', {
  slidesToShow: 1.4,
  centerMode: true,
  centerPadding: '0px',
  spaceBetween: 14,
  infinite: true,
  arrows: false,
  dots: true,
});

/* ── marquee ────────────────────────────────────────────────────────── */

new AnimeCarousel('#m-one', {
  mode: 'marquee',
  // Ticker items size themselves; a fixed slidesToShow would stretch each one
  // to the full viewport and the strip would look like a single frame.
  slidesToShow: 'auto',
  spaceBetween: 0,
  marquee: { speed: 70, direction: 'normal', pauseOnHover: true },
});

new AnimeCarousel('#m-two', {
  mode: 'marquee',
  slidesToShow: 'auto',
  spaceBetween: 0,
  marquee: { speed: 42, direction: 'reverse', pauseOnHover: true },
});

/* ── lazy loading ───────────────────────────────────────────────────── */

const lazy = new AnimeCarousel('#lazy', {
  lazyLoad: 'ondemand',
  slidesToShow: 3,
  spaceBetween: 14,
  infinite: true,
  dots: true,
  arrows: true,
  // Three square slides on a phone leaves each one barely 100px wide.
  responsive: [{ breakpoint: 640, settings: { slidesToShow: 1.4 } }],
  onAfterChange: setLazyStatus,
});

function setLazyStatus() {
  const loaded = lazy.slides.filter((slide) => slide.classList.contains('is-lazy-loaded')).length;
  const status = $('#lazy-status');
  if (status) status.textContent = `lazyLoad: 'ondemand' · ${loaded}/${lazy.count} images decoded`;
}

lazy.slides.forEach((slide) => slide.addEventListener('ajc:lazy-loaded', setLazyStatus));
setLazyStatus();

/* ── responsive ─────────────────────────────────────────────────────── */

const responsive = new AnimeCarousel('#resp', {
  slidesToShow: 3,
  spaceBetween: 14,
  infinite: true,
  dots: true,
  arrows: true,
  responsive: [
    { breakpoint: 1024, settings: { slidesToShow: 2 } },
    { breakpoint: 640, settings: { slidesToShow: 1, arrows: false } },
  ],
  onBreakpoint: (detail) => {
    const status = $('#resp-status');
    if (!status) return;
    status.textContent = detail.breakpoint
      ? `breakpoint ≤ ${detail.breakpoint}px → slidesToShow ${detail.settings.slidesToShow ?? '—'}`
      : 'base → slidesToShow 3';
  },
});

(() => {
  const status = $('#resp-status');
  if (status) status.textContent = `slidesToShow: ${responsive.options.slidesToShow} · resize to test`;
})();

/* ── entrance motion (Anime.js v4) ──────────────────────────────────── */

if (!reduceMotion) {
  animate('.hero h1, .hero .lede, .hero .chips, .block', {
    y: [16, 0],
    duration: 700,
    delay: stagger(50, { from: 'first' }),
    ease: 'out(3)',
  });
}

/* Handy from the devtools console: demo.pg().next(), demo.gallery.options … */
window.demo = {
  pg: () => pg,
  gallery,
  thumbs,
  lazy,
  responsive,
  log,
};

log('AnimeCarousel ready — 12 instances online.');
