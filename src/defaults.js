/**
 * Default options, data-attribute mapping and mode metadata.
 *
 * Option names aim to cover both Slick Slider and Swiper.js vocabulary:
 * `slidesToShow` / `slidesPerView`, `infinite` / `loop`, `dots` / `pagination`,
 * `arrows` / `navigation`, `autoplaySpeed` / `delay`, `asNavFor` / `controller`.
 * Aliases are normalised in `normalizeOptions()`.
 */

export const MODES = Object.freeze([
  'slide',
  'fade',
  'coverflow',
  'cards',
  'marquee',
  'kenburns',
  'staggered',
  'flip',
  'cube',
]);

export const DEFAULT_OPTIONS = {
  /* ── mode & structure ─────────────────────────────────────────────── */
  mode: 'slide',
  initialSlide: 0,

  /* ── layout ───────────────────────────────────────────────────────── */
  slidesToShow: 1,
  slidesToScroll: 1,
  spaceBetween: 0,
  infinite: false,
  centerMode: false,
  centerPadding: '0px',
  vertical: false,
  verticalSwiping: false,
  rtl: false,
  adaptiveHeight: false,
  watchOverflow: true,

  /* ── motion ───────────────────────────────────────────────────────── */
  speed: 600,
  easing: 'outCubic',
  spring: false,
  springConfig: { stiffness: 110, damping: 16, mass: 1, velocity: 0 },
  reducedMotion: 'respect',
  perspective: 1200,

  /* ── autoplay ─────────────────────────────────────────────────────── */
  autoplay: false,
  autoplaySpeed: 3200,
  pauseOnHover: true,
  pauseOnFocus: true,
  pauseOnDotsHover: false,
  pauseOnInteraction: true,
  stopOnLastSlide: false,

  /* ── navigation ───────────────────────────────────────────────────── */
  arrows: true,
  prevArrow: null,
  nextArrow: null,
  hideOnEdges: false,
  dots: false,
  dotsType: 'bullets', // 'bullets' | 'fraction' | 'progress'
  dynamicBullets: false,
  customPaging: null,
  dotsPerPage: true,
  paginationClickable: true,

  /* ── interaction ──────────────────────────────────────────────────── */
  draggable: true,
  swipeToSlide: false,
  touchThreshold: 5,
  dragThreshold: 0.18, // fraction of a slide that must be travelled to change slide
  dragResistance: 0.35,
  mousewheel: false,
  keyboard: true,
  focusable: true,
  focusOnSelect: false,
  emitEvents: true,

  /* ── media ────────────────────────────────────────────────────────── */
  lazyLoad: false, // false | 'ondemand' | 'progressive'
  lazyLoadSelector: 'img[data-src], source[data-srcset]',

  /* ── responsive & sync ────────────────────────────────────────────── */
  responsive: null,
  breakpointsBase: 'window',
  asNavFor: null,
  syncClick: false,

  /* ── per-mode effects ─────────────────────────────────────────────── */
  fadeEffect: { crossFade: true, scale: 0, blur: 0 },
  coverflowEffect: { rotate: 42, depth: 180, scale: 0.86, stretch: 0, modifier: 1, opacity: 1 },
  cardsEffect: { offsetX: 26, offsetY: 10, rotate: 3.5, scale: 0.92, maxStack: 3, opacity: 0.45 },
  flipEffect: { rotate: 90, depth: 120, opacity: 0.25 },
  cubeEffect: { rotate: 90, depth: 0, shadow: true },
  kenBurns: {
    targets: 'img, [data-ajc-kenburns]',
    from: 1,
    to: 1.14,
    duration: 9000,
    alternate: true,
    panX: 0,
    panY: 0,
  },
  staggerEffect: {
    targets: null,
    each: 65,
    duration: 720,
    distance: 26,
    outDuration: 220,
    ease: 'out(3)',
    from: 'start',
  },

  /* ── marquee / ticker ─────────────────────────────────────────────── */
  marquee: {
    speed: 60, // px per second
    direction: 'normal', // 'normal' | 'reverse'
    pauseOnHover: true,
    duplicated: true,
  },

  /* ── a11y & misc ──────────────────────────────────────────────────── */
  a11y: true,
  announce: true,
  ariaLabels: {
    region: 'Carousel',
    prev: 'Previous slide',
    next: 'Next slide',
    dots: 'Choose slide',
    slide: (index, total) => `${index + 1} of ${total}`,
  },

  /* ── callbacks (Slick + Swiper names) ─────────────────────────────── */
  onInit: null,
  onBeforeChange: null,
  onSlideChange: null,
  onAfterChange: null,
  onTransitionEnd: null,
  onBreakpoint: null,
  onDestroy: null,
  onDragStart: null,
  onDragMove: null,
  onDragEnd: null,
  onAutoplayStart: null,
  onAutoplayStop: null,
  onReachStart: null,
  onReachEnd: null,
};

/** Option aliases → canonical keys (Slick / Swiper / older names). */
export const ALIASES = {
  effect: 'mode',
  slidesPerView: 'slidesToShow',
  slidesperview: 'slidesToShow',
  loop: 'infinite',
  centeredSlides: 'centerMode',
  centeredslides: 'centerMode',
  navigation: 'arrows',
  pagination: 'dots',
  paginationType: 'dotsType',
  delay: 'autoplaySpeed',
  autoplayDelay: 'autoplaySpeed',
  swipe: 'draggable',
  touchMove: 'draggable',
  touchmove: 'draggable',
  startIndex: 'initialSlide',
  staggered: 'staggerEffect',
  kenburns: 'kenBurns',
  breakpoints: 'responsive',
  controller: 'asNavFor',
  prev: 'prevArrow',
  next: 'nextArrow',
  speedMs: 'speed',
  animationSpeed: 'speed',
};

export const DATA_ALIASES = {
  slidesPerView: 'slidesToShow',
  loop: 'infinite',
  centeredSlides: 'centerMode',
  effect: 'mode',
  navigation: 'arrows',
  pagination: 'dots',
  delay: 'autoplaySpeed',
  swipe: 'draggable',
  touchMove: 'draggable',
  startIndex: 'initialSlide',
  breakpoints: 'responsive',
  controller: 'asNavFor',
};

/** Keys that must never be read from data attributes. */
const PRIVATE_KEYS = new Set(['classes', 'ariaLabels', 'onInit']);

const isPlainObject = (value) =>
  !!value && typeof value === 'object' && !Array.isArray(value) && !value.nodeType;

/**
 * Normalise any mix of aliases, nested effect objects and shorthand values.
 */
export function normalizeOptions(options = {}) {
  const merged = { ...DEFAULT_OPTIONS };

  for (const [rawKey, value] of Object.entries(options)) {
    if (value === undefined) continue;
    const key = ALIASES[rawKey] || rawKey;
    if (!(key in DEFAULT_OPTIONS)) {
      merged[key] = value;
      continue;
    }
    if (isPlainObject(DEFAULT_OPTIONS[key]) && isPlainObject(value)) {
      merged[key] = { ...DEFAULT_OPTIONS[key], ...value };
    } else {
      merged[key] = value;
    }
  }

  // `slidesToShow: 'auto'` needs an explicit spaceBetween fallback of 0.
  if (merged.slidesToShow === 'auto') merged.slidesToShow = 'auto';
  if (typeof merged.slidesToShow === 'string' && merged.slidesToShow !== 'auto') {
    const n = Number(merged.slidesToShow);
    if (Number.isFinite(n) && n > 0) merged.slidesToShow = n;
  }

  // Swiper's `autoplay: { delay, disableOnInteraction }` object shorthand.
  if (isPlainObject(merged.autoplay)) {
    const { delay, pauseOnMouseEnter, disableOnInteraction } = merged.autoplay;
    merged.autoplay = true;
    if (Number.isFinite(delay)) merged.autoplaySpeed = delay;
    if (pauseOnMouseEnter != null) merged.pauseOnHover = pauseOnMouseEnter;
    if (disableOnInteraction != null) merged.pauseOnInteraction = disableOnInteraction;
  }

  // Swiper's `pagination: { type }` / `navigation: true` shorthands.
  if (isPlainObject(merged.dots)) {
    const { type, dynamicBullets, clickable } = merged.dots;
    merged.dots = true;
    if (type) merged.dotsType = type === 'fraction' ? 'fraction' : type === 'progressbar' ? 'progress' : 'bullets';
    if (dynamicBullets != null) merged.dynamicBullets = dynamicBullets;
    if (clickable != null) merged.paginationClickable = clickable;
  }
  if (isPlainObject(merged.arrows)) merged.arrows = true;

  if (typeof merged.mode === 'string') {
    const mode = merged.mode.toLowerCase();
    merged.mode = MODES.includes(mode) ? mode : mode === 'ticker' ? 'marquee' : 'slide';
  }

  merged.speed = Math.max(0, Number(merged.speed) || 0);
  merged.spaceBetween = Number(merged.spaceBetween) || 0;
  merged.slidesToScroll = Math.max(1, Number(merged.slidesToScroll) || 1);

  return merged;
}

/** Read `data-*` options from the root element. `data-ajc='{"mode":…}'` wins. */
export function readDataAttributes(element) {
  const result = {};
  if (!element || !element.attributes) return result;

  for (const { name, value } of Array.from(element.attributes)) {
    if (!name.startsWith('data-')) continue;
    if (name === 'data-ajc') {
      const trimmed = (value || '').trim();
      if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
        try {
          Object.assign(result, JSON.parse(trimmed));
        } catch {
          /* ignore malformed JSON, keep the boolean marker */
        }
      }
      continue;
    }
    const camel = name
      .slice(5)
      .replace(/-([a-z0-9])/gi, (_, c) => c.toUpperCase());
    const key = DATA_ALIASES[camel] || ALIASES[camel] || camel;
    if (PRIVATE_KEYS.has(key)) continue;
    if (!(key in DEFAULT_OPTIONS)) continue;
    const fallback = DEFAULT_OPTIONS[key];
    if (typeof fallback === 'boolean') {
      result[key] = !['false', '0', 'off', 'no'].includes(String(value).toLowerCase());
    } else if (typeof fallback === 'number') {
      const n = Number(value);
      if (Number.isFinite(n)) result[key] = n;
    } else if (isPlainObject(fallback)) {
      try {
        result[key] = { ...fallback, ...JSON.parse(value) };
      } catch {
        /* keep default */
      }
    } else {
      result[key] = value;
    }
  }
  return result;
}
