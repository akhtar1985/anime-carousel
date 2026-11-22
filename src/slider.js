/**
 * AnimeCarousel — the core engine.
 *
 * A single fractional `progress` value drives the whole slider. Every frame we
 * project `progress` onto each slide through `layout.js` (which is what makes
 * infinite loop seamless without clones) and write GPU transforms. Anime.js v4
 * animates that one number, so spring physics, easing and dragging all share
 * the exact same code path.
 */
import { animate, createTimeline, stagger, createSpring, utils } from 'animejs';

import { DEFAULT_OPTIONS, MODES, normalizeOptions, readDataAttributes } from './defaults.js';
import { createGeometry, getEffect, toTransform } from './layout.js';
import {
  createElement,
  debounce,
  emitDomEvent,
  isBrowser,
  isFormField,
  isInteractive,
  mergeDeep,
  prefersReducedMotion,
  resolveElement,
  resolvePx,
  resolveProgress,
  round,
  signedWrap,
  stepProgress,
  toKebab,
  wrap,
} from './utils.js';
import { Navigation } from './navigation.js';
import { Autoplay } from './autoplay.js';
import { Drag } from './drag.js';
import { Marquee } from './marquee.js';
import { Lazy } from './lazy.js';
import { Responsive } from './responsive.js';
import { A11y } from './a11y.js';
import { attachSync, detachSync, getLinks, registerInstance, resolveInstances, syncClicks } from './sync.js';

export const VERSION = '1.0.1';

// Anime.js v4 `utils` — same semantics as the local helpers, shared with the engine.
const clamp = utils.clamp;

// Callback keys are terse; the documented DOM event names are not all a plain
// kebab-case transform (`before` → `ajc:before-change`).
const DOM_EVENT_NAMES = {
  before: 'before-change',
  after: 'after-change',
};

const CALLBACKS = {
  init: 'onInit',
  before: 'onBeforeChange',
  change: 'onSlideChange',
  after: 'onAfterChange',
  transitionEnd: 'onTransitionEnd',
  breakpoint: 'onBreakpoint',
  destroy: 'onDestroy',
  dragStart: 'onDragStart',
  dragMove: 'onDragMove',
  dragEnd: 'onDragEnd',
  autoplayStart: 'onAutoplayStart',
  autoplayStop: 'onAutoplayStop',
  reachStart: 'onReachStart',
  reachEnd: 'onReachEnd',
};

export class AnimeCarousel {
  /**
   * @param {string|Element} element
   * @param {object} [options]
   */
  constructor(element, options = {}) {
    const root = resolveElement(element);
    if (!root) throw new Error('[AnimeCarousel] Root element not found.');

    // One instance per element, like most slider plugins.
    if (root.__ajcInstance) return root.__ajcInstance;
    root.__ajcInstance = this;

    this.root = root;
    this.version = VERSION;
    this.id = root.id || `ajc-${Math.random().toString(36).slice(2, 9)}`;

    this.destroyed = false;
    this.progress = 0;
    this._target = 0;
    this._viewportSize = 0;
    this._geo = null;
    this._anim = null;
    this._kenburnsTl = null;
    this._lastTransform = new Map();
    this._cleanup = [];
    this._created = [];
    this._lastReach = null;
    this._syncing = false;
    this._initialised = false;
    this._animations = new Set();
    this._revealAnims = new Map();

    this._dataOptions = readDataAttributes(root);
    this._baseOptions = mergeDeep({}, this._dataOptions, options);
    this.options = normalizeOptions(this._baseOptions);

    this._motionQuery = isBrowser && window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
    this._reduced = !!(this._motionQuery && this._motionQuery.matches && this.options.reducedMotion === 'respect');

    this._readMarkup();
    this._bindLifecycle();
    registerInstance(this);
    this._setup();

    this._initialised = true;
    this.emit('init', this._detail(this.activeIndex, this.activeIndex, 'none'));
  }

  /* ══════════════════════════════════════════════════════════════════
     Setup
     ══════════════════════════════════════════════════════════════════ */

  _readMarkup() {
    const root = this.root;
    root.classList.add('ajc');

    let viewport = root.querySelector('[data-ajc-viewport]') || root.querySelector('.ajc__viewport');
    if (!viewport) {
      viewport = createElement('div', 'ajc__viewport');
      viewport.setAttribute('data-ajc-viewport', '');
      const movable = Array.from(root.childNodes).filter(
        (node) =>
          node.nodeType === 1 ? !node.hasAttribute('data-ajc-nav') && !node.classList.contains('ajc__arrow') && !node.classList.contains('ajc__dots') : node.nodeType === 3 && node.textContent.trim(),
      );
      movable.forEach((node) => viewport.appendChild(node));
      root.appendChild(viewport);
      this._created.push(viewport);
      this._createdViewport = true;
    }

    let track = viewport.querySelector('[data-ajc-track]') || viewport.querySelector('.ajc__track');
    if (!track) {
      track = createElement('div', 'ajc__track');
      track.setAttribute('data-ajc-track', '');
      Array.from(viewport.childNodes).forEach((node) => track.appendChild(node));
      viewport.appendChild(track);
      this._created.push(track);
      this._createdTrack = true;
    }

    this.viewport = viewport;
    this.track = track;
    this.slides = Array.from(track.children).filter(
      (el) => el.nodeType === 1 && !el.hasAttribute('data-ajc-clone'),
    );
    this.slides.forEach((slide, index) => {
      slide.__ajcHadSlideClass = slide.classList.contains('ajc__slide');
      slide.__ajcHadSlideAttr = slide.hasAttribute('data-ajc-slide');
      slide.classList.add('ajc__slide');
      if (!slide.hasAttribute('data-ajc-slide')) slide.setAttribute('data-ajc-slide', '');
      slide.dataset.ajcIndex = String(index);
    });
  }

  _bindLifecycle() {
    if (this._motionQuery && this._motionQuery.addEventListener) {
      const onChange = () => {
        this._reduced = this._motionQuery.matches && this.options.reducedMotion === 'respect';
        this.refresh();
      };
      this._motionQuery.addEventListener('change', onChange);
      this._cleanup.push(() => this._motionQuery.removeEventListener('change', onChange));
    }
  }

  _setup() {
    this._applyClasses();
    this._prepareSlides();

    this.a11y = new A11y(this);
    this.a11y.setup();

    this.lazy = new Lazy(this);
    this.lazy.scan();

    this.nav = new Navigation(this);
    this.nav.mount();

    this.responsive = new Responsive(this);
    this.responsive.init();

    this._measure();
    this.progress = this._initialProgress();
    this._target = this.progress;
    this._render(true);
    this._settle(true);

    this.drag = new Drag(this);
    this.drag.mount();

    this.autoplay = new Autoplay(this);
    this.marquee = new Marquee(this);

    this._bindEvents();
    this._attachSync();

    if (this.options.mode === 'marquee') this.marquee.mount();
    if (this.options.autoplay) this.play();
  }

  _applyClasses() {
    const { mode, vertical, rtl, infinite, centerMode } = this.options;
    const root = this.root;
    Array.from(root.classList)
      .filter((name) => name.startsWith('ajc--'))
      .forEach((name) => root.classList.remove(name));

    const effect = getEffect(mode);
    root.classList.add(`ajc--${mode}`);
    if (vertical) root.classList.add('ajc--vertical');
    if (rtl && !vertical) root.classList.add('ajc--rtl');
    if (infinite) root.classList.add('ajc--loop');
    if (centerMode) root.classList.add('ajc--center');
    if (effect.perspective) root.classList.add('ajc--3d');
    if (effect.stacked) root.classList.add('ajc--stacked');
    if (mode === 'marquee') root.classList.add('ajc--marquee');

    root.style.setProperty('--ajc-gap', `${this.options.spaceBetween}px`);
    root.style.setProperty('--ajc-perspective', `${this.options.perspective}px`);
    root.style.setProperty('--ajc-speed', `${this.options.speed}ms`);
  }

  _prepareSlides() {
    const vertical = this.options.vertical;
    for (const slide of this.slides) {
      slide.classList.add('ajc__slide');
      if (vertical) slide.style.width = '100%';
    }
  }

  /* ══════════════════════════════════════════════════════════════════
     Measurement & rendering
     ══════════════════════════════════════════════════════════════════ */

  _centerPaddingPx() {
    const base = this.options.vertical ? this.viewport.clientHeight : this.viewport.clientWidth;
    return Math.max(0, resolvePx(this.options.centerPadding, base, 0));
  }

  _measure() {
    const { vertical, slidesToShow, spaceBetween, centerMode } = this.options;
    // Give the author's CSS control again when switching to vertical.
    if (vertical && this._heightOwned) {
      this.viewport.style.height = '';
      this._heightOwned = false;
    }
    const n = this.slides.length;
    const pad = centerMode ? this._centerPaddingPx() : 0;

    let viewportSize = vertical ? this.viewport.clientHeight : this.viewport.clientWidth;
    if (vertical && viewportSize <= 0) {
      const first = this.slides[0];
      viewportSize = ((first && first.offsetHeight) || 320) * Math.max(1, Number(slidesToShow) || 1);
    }
    this._viewportSize = viewportSize;

    let sizes;
    if (slidesToShow === 'auto') {
      // `width: 100%` in the core stylesheet defeats getBoundingClientRect on
      // an absolutely positioned slide. `width: auto` makes it shrink-to-fit
      // so the author's natural slide width can be measured before it becomes
      // an explicit px size for the geometry engine.
      for (const slide of this.slides) {
        slide.style.width = vertical ? '100%' : 'auto';
        slide.style.height = vertical ? 'auto' : '';
      }
      const measured = this.slides.map((slide) => {
        const rect = slide.getBoundingClientRect();
        return Math.max(0, vertical ? rect.height : rect.width);
      });
      const fallback = Math.max(0, viewportSize - pad * 2);
      sizes = measured.map((size) => (size > 0 ? size : fallback));
      this.slides.forEach((slide, index) => {
        if (vertical) slide.style.height = `${round(sizes[index])}px`;
        else slide.style.width = `${round(sizes[index])}px`;
      });
    } else {
      const count = Math.max(0.1, Number(slidesToShow) || 1);
      const avail = Math.max(0, viewportSize - pad * 2);
      const size = Math.max(0, (avail - spaceBetween * (count - 1)) / count);
      sizes = new Array(n).fill(size);
      this.slides.forEach((slide, index) => {
        if (vertical) slide.style.height = `${round(sizes[index])}px`;
        else slide.style.width = `${round(sizes[index])}px`;
      });
    }

    this._geo = createGeometry({
      sizes,
      gap: spaceBetween,
      viewport: viewportSize,
      loop: !!this.options.infinite,
      centerMode: !!centerMode,
      centerPadding: pad,
      slidesToShow,
    });
    this._lastTransform.clear();
    this._syncViewportHeight(vertical);
  }

  /**
   * Absolutely positioned slides contribute no height, so when the author has
   * not set one we derive the viewport height from the tallest slide.
   */
  _syncViewportHeight(vertical) {
    if (vertical || this.options.adaptiveHeight) return;
    if (!this._heightOwned) {
      const computed = parseFloat(getComputedStyle(this.viewport).height) || 0;
      if (computed > 1) return;
    }
    let tallest = 0;
    for (const slide of this.slides) tallest = Math.max(tallest, slide.offsetHeight);
    if (tallest > 0) {
      this.viewport.style.height = `${tallest}px`;
      this._heightOwned = true;
    }
  }

  /** Project the current `progress` onto every slide. */
  _render() {
    if (this.destroyed) return;
    const { mode, vertical, rtl } = this.options;
    if (mode === 'marquee') return this.marquee && this.marquee.sync();

    const geo = this._geo;
    if (!geo) return;

    const effect = getEffect(mode);
    const limit = effect.limit(this.options);
    const dir = rtl && !vertical ? -1 : 1;
    const viewport = this._viewportSize;

    for (let i = 0; i < this.slides.length; i++) {
      const slide = this.slides[i];
      const size = geo.sizeOf(i);
      const d = geo.deltaOf(i, this.progress);
      const visible = Math.abs(d) <= limit;

      let x = 0;
      let y = 0;
      if (effect.stacked) {
        x = vertical ? 0 : (viewport - size) / 2;
        y = vertical ? (viewport - size) / 2 : 0;
      } else {
        const pos = geo.posOf(i, this.progress);
        if (vertical) y = pos;
        else x = dir === -1 ? viewport - pos - size : pos;
      }

      const state = {
        x,
        y,
        z: 0,
        tz: 0,
        rotateX: 0,
        rotateY: 0,
        rotateZ: 0,
        scale: 1,
        opacity: 1,
        visible,
        zIndex: 0,
        filter: '',
      };

      effect.apply(state, {
        d,
        index: i,
        options: this.options,
        geo,
        slider: this,
        dir,
        vertical,
        center: { x: (viewport - size) / 2, y: (viewport - size) / 2 },
      });

      if (!state.zIndex) state.zIndex = 1000 - Math.round(Math.abs(d) * 10);

      const transform = toTransform(state);
      if (this._lastTransform.get(slide) !== transform) {
        slide.style.transform = transform;
        this._lastTransform.set(slide, transform);
      }

      slide.style.zIndex = String(state.zIndex);
      slide.style.opacity = state.opacity >= 1 ? '' : String(round(state.opacity, 3));
      slide.style.filter = state.filter || '';
      slide.style.visibility = state.visible ? '' : 'hidden';
      slide.style.pointerEvents = state.visible ? '' : 'none';

      const isActive = state.visible && Math.abs(d) < 0.5;
      slide.classList.toggle('is-active', isActive);
      slide.classList.toggle('is-visible', state.visible);
      slide.setAttribute('aria-hidden', state.visible ? 'false' : 'true');
    }

    if (this.lazy) this.lazy.load();
  }

  /* ══════════════════════════════════════════════════════════════════
     Motion
     ══════════════════════════════════════════════════════════════════ */

  _ease() {
    if (this.options.spring) return createSpring(this.options.springConfig);
    return this.options.easing || 'outCubic';
  }

  /**
   * Create an Anime.js instance and own it until completion or teardown.
   *
   * `scope.add()` keeps every factory in `scope.constructors` so a refresh can
   * replay it; using it for one-shot transitions leaked one constructor and one
   * live animation per navigation. This set is the lifecycle contract instead:
   * completed proxy animations are released, everything still live is reverted
   * by `destroy()`.
   */
  _track(factory) {
    const created = factory();
    if (created && typeof created.revert === 'function') this._animations.add(created);
    return created;
  }

  _release(animation) {
    if (animation) this._animations.delete(animation);
  }

  _animateTo(target, { instant = false, speed, ease, silent = false } = {}) {
    const from = this.progress;
    this._target = target;
    if (Math.abs(target - from) < 0.0005) {
      // A no-op request is not a slide change; keep the DOM/ARIA in sync without
      // emitting a `0 → 0` change that would look like a real transition.
      this.progress = target;
      this._render();
      this._settle(false, { silent: true, previous: from, instant: true });
      return this;
    }

    if (this._anim) {
      this._anim.pause();
      this._release(this._anim);
      this._anim = null;
    }

    if (!silent) {
      this._emitBefore(from, target);
      this.emit('change', this._detail(this._indexAt(target), this._indexAt(from), this._direction(from, target)));
    }

    const duration = instant || this._reduced ? 0 : Math.max(0, speed == null ? this.options.speed : speed);

    if (duration <= 0) {
      this.progress = target;
      this._render();
      this._settle(false, { previous: from, instant: true });
      return this;
    }

    const proxy = { p: from };
    let animation = null;
    animation = this._track(() =>
      animate(proxy, {
        p: target,
        duration,
        ease: ease || this._ease(),
        onUpdate: () => {
          this.progress = proxy.p;
          this._render();
        },
        onComplete: () => {
          if (this._anim && this._anim !== animation) return;
          this._anim = null;
          this._release(animation);
          this.progress = target;
          this._render();
          this._settle(false, { previous: from });
        },
      }),
    );
    this._anim = animation;
    return this;
  }

  /** Called whenever the position is final (either instant or at transition end). */
  _settle(initial = false, { silent = false, previous = null, instant = false } = {}) {
    const index = this.activeIndex;
    const from = previous == null ? this.progress : previous;
    const direction = this._direction(from, this.progress);

    // Keep `progress` bounded so long sessions never lose precision.
    if (this._geo && this._geo.loop && Math.abs(this.progress) > this._geo.n * 4) {
      this.progress = wrap(this.progress, this._geo.n);
      this._render();
    }
    this._target = this.progress;

    this.nav && this.nav.update();
    this.a11y && this.a11y.update();
    this.drag && this.drag.updateCursor();
    this.autoplay && this.autoplay.onSettled();
    this._adaptiveHeight();
    this._runEnterEffect(index);

    if (!silent && !initial) {
      const previousIndex = this._indexAt(from);
      this.emit('after', this._detail(index, previousIndex, direction));
      this.emit('transitionEnd', this._detail(index, previousIndex, direction));
    }

    this._reachState(index, initial);
    if (!initial) {
      // A partner drove this transition: do not echo the same index back out.
      if (this._syncing) this._syncing = false;
      else this._syncTo(index, instant);
    }
    if (this.lazy) this.lazy.load();
  }

  _adaptiveHeight() {
    if (!this.options.adaptiveHeight || this.options.vertical) return;
    const slide = this.slides[this.activeIndex];
    if (!slide) return;
    const height = slide.offsetHeight;
    if (!height) return;
    if (this._reduced) {
      this.viewport.style.height = `${height}px`;
      return;
    }
    let animation = null;
    animation = this._track(() =>
      animate(this.viewport, {
        height: `${height}px`,
        duration: Math.min(this.options.speed, 500),
        ease: this.options.easing,
        onComplete: () => this._release(animation),
      }),
    );
  }

  _runEnterEffect(index) {
    if (this.options.mode === 'staggered') this._reveal(index);
    if (this.options.mode === 'kenburns') this._kenburns(index);
  }

  _revealTargets(slide) {
    const configured = this.options.staggerEffect.targets;
    if (configured) {
      if (typeof configured === 'function') return Array.from(configured(slide) || []);
      const found = slide.querySelectorAll(configured);
      if (found.length) return Array.from(found);
      return [];
    }
    const marked = slide.querySelectorAll('[data-ajc-reveal]');
    if (marked.length) return Array.from(marked);
    const common = slide.querySelectorAll('img, picture, h1, h2, h3, h4, p, .ajc__caption, .ajc__cta');
    if (common.length) return Array.from(common);
    return Array.from(slide.children);
  }

  _reveal(index) {
    if (this._reduced) return;
    const slide = this.slides[index];
    if (!slide) return;
    const targets = this._revealTargets(slide);
    if (!targets.length) return;
    const cfg = this.options.staggerEffect;
    const previous = this._revealAnims.get(slide);
    if (previous) {
      previous.revert();
      this._release(previous);
    }
    const timeline = this._track(() =>
      createTimeline({ defaults: { duration: cfg.duration, ease: cfg.ease } }).add(
        targets,
        {
          opacity: [0, 1],
          y: [cfg.distance, 0],
          scale: [0.96, 1],
          delay: stagger(cfg.each, { from: cfg.from }),
        },
        0,
      ),
    );
    this._revealAnims.set(slide, timeline);
  }

  _kenburns(index) {
    if (this._reduced) return;
    const slide = this.slides[index];
    if (!slide) return;
    const kb = this.options.kenBurns;
    const targets = Array.from(slide.querySelectorAll(kb.targets));
    if (!targets.length) return;
    if (this._kenburnsTl) {
      this._kenburnsTl.revert();
      this._release(this._kenburnsTl);
      this._kenburnsTl = null;
    }
    this._kenburnsTl = this._track(() =>
      createTimeline({ loop: true, alternate: kb.alternate, defaults: { duration: kb.duration, ease: 'inOutSine' } }).add(
        targets,
        { scale: [kb.from, kb.to], x: [0, kb.panX], y: [0, kb.panY] },
        0,
      ),
    );
  }

  /* ══════════════════════════════════════════════════════════════════
     Indexes
     ══════════════════════════════════════════════════════════════════ */

  get count() {
    return this.slides.length;
  }

  /** True only when the strip actually wraps (content is wider than the viewport). */
  get looping() {
    return this._geo ? this._geo.loop : !!this.options.infinite;
  }

  get activeIndex() {
    return this._indexAt();
  }

  /** Logical slide index for any (possibly fractional or unwrapped) progress. */
  _indexAt(progress = this.progress) {
    const n = this.slides.length;
    if (!n) return 0;
    const value = Math.round(Number(progress) || 0);
    if (this.looping) return wrap(value, n);
    return clamp(value, 0, this._geo ? this._geo.maxIndex : n - 1);
  }

  _direction(from, to) {
    return to > from ? 'next' : to < from ? 'prev' : 'none';
  }

  _initialProgress() {
    const n = this.slides.length;
    if (!n) return 0;
    return clamp(Math.round(Number(this.options.initialSlide) || 0), 0, n - 1);
  }

  _detail(index, previousIndex, direction) {
    const total = this.slides.length;
    const previous = previousIndex == null ? index : previousIndex;
    return {
      index,
      previousIndex: previous,
      slide: this.slides[index] || null,
      slides: this.slides,
      direction: direction || (index > previous ? 'next' : index < previous ? 'prev' : 'none'),
      total,
      instance: this,
    };
  }

  _emitBefore(from, to) {
    this.emit(
      'before',
      this._detail(this._indexAt(to), this._indexAt(from), this._direction(from, to)),
    );
  }

  _reachState(index) {
    if (this.looping || this.options.mode === 'marquee') return;
    const max = this._geo ? this._geo.maxIndex : this.slides.length - 1;
    const state = index <= 0 ? 'start' : index >= max ? 'end' : null;
    if (state && this._lastReach !== state) {
      this._lastReach = state;
      this.emit(state === 'start' ? 'reachStart' : 'reachEnd', this._detail(index, index));
    } else if (!state) {
      this._lastReach = null;
    }
  }

  /* ══════════════════════════════════════════════════════════════════
     Events
     ══════════════════════════════════════════════════════════════════ */

  emit(type, detail = {}) {
    const callback = this.options[CALLBACKS[type]];
    detail.type = type;
    if (typeof callback === 'function') {
      try {
        callback(detail, this);
      } catch (error) {
        console.error(`[AnimeCarousel] ${CALLBACKS[type]} threw:`, error);
      }
    }
    if (this.options.emitEvents) emitDomEvent(this.root, DOM_EVENT_NAMES[type] || toKebab(type), detail);
  }

  _bindEvents() {
    const on = (target, event, handler, options) => {
      target.addEventListener(event, handler, options);
      this._cleanup.push(() => target.removeEventListener(event, handler, options));
    };

    // Resize: viewport (containers, panels) and window (breakpoints).
    if (isBrowser && 'ResizeObserver' in window) {
      let lastSize = this._viewportSize;
      this._resizeObserver = new ResizeObserver(
        debounce(() => {
          const size = this.options.vertical ? this.viewport.clientHeight : this.viewport.clientWidth;
          if (Math.abs(size - lastSize) > 0.5) {
            lastSize = size;
            this.refresh({ silent: true });
          }
        }, 60),
      );
      this._resizeObserver.observe(this.viewport);
      this._cleanup.push(() => this._resizeObserver.disconnect());
    }

    on(window, 'resize', () => this.responsive && this.responsive.check());
    // Images resolving after init change slide heights — re-measure once.
    on(window, 'load', () => this.refresh({ silent: true }));

    on(this.viewport, 'keydown', (event) => this._onKeyDown(event));
    on(this.viewport, 'wheel', (event) => this._onWheel(event), { passive: false });

    on(this.root, 'click', (event) => syncClicks(this, event));
    on(this.viewport, 'focusin', () => this.autoplay && this.options.pauseOnFocus && this.autoplay.pause('focus'));
    on(this.viewport, 'focusout', (event) => {
      if (this.autoplay && this.options.pauseOnFocus && !this.root.contains(event.relatedTarget)) this.autoplay.resume('focus');
    });
  }

  _onKeyDown(event) {
    if (!this.options.keyboard) return;
    if (isInteractive(event.target)) return;

    const vertical = this.options.vertical;
    const horizontal = !vertical;
    const rtl = this.options.rtl;
    const key = event.key;
    const nextKey = rtl ? 'ArrowLeft' : 'ArrowRight';
    const prevKey = rtl ? 'ArrowRight' : 'ArrowLeft';

    let handled = true;
    if ((horizontal && key === nextKey) || (!horizontal && key === 'ArrowDown')) {
      this.next();
    } else if ((horizontal && key === prevKey) || (!horizontal && key === 'ArrowUp')) {
      this.prev();
    } else if (key === 'Home') {
      this.goTo(0);
    } else if (key === 'End') {
      this.goTo(this.slides.length - 1);
    } else {
      handled = false;
    }
    if (handled) {
      event.preventDefault();
      if (this.options.pauseOnInteraction) this.autoplay && this.autoplay.pause('interaction');
    }
  }

  _onWheel(event) {
    if (!this.options.mousewheel || this.options.mode === 'marquee') return;
    if (event.ctrlKey || isFormField(event.target)) return;

    const { deltaX, deltaY } = event;
    const vertical = this.options.vertical;
    let delta = vertical ? deltaY : Math.abs(deltaX) > Math.abs(deltaY) ? deltaX : deltaY;
    if (this.options.rtl && !vertical) delta *= -1;
    if (Math.abs(delta) < 2) return;

    const now = Date.now();
    if (this._wheelLock && now - this._wheelLock < 380) {
      event.preventDefault();
      return;
    }
    this._wheelLock = now;
    event.preventDefault();
    if (delta > 0) this.next();
    else this.prev();
    if (this.options.pauseOnInteraction) this.autoplay && this.autoplay.pause('interaction');
  }

  /* ══════════════════════════════════════════════════════════════════
     Public API
     ══════════════════════════════════════════════════════════════════ */

  next() {
    return this._animateTo(this._stepTarget(1));
  }

  prev() {
    return this._animateTo(this._stepTarget(-1));
  }

  _stepTarget(direction) {
    const n = this.slides.length;
    const max = this._geo ? this._geo.maxIndex : n - 1;
    return stepProgress(
      this._target == null ? this.progress : this._target,
      direction,
      this.options.slidesToScroll,
      n,
      this.looping,
      max,
    );
  }

  /**
   * @param {number} index
   * @param {boolean} [instant]
   */
  goTo(index, instant = false) {
    if (this.destroyed || !this._geo || !this.slides.length) return this;
    let target = Number(index);
    if (!Number.isFinite(target)) return this;
    target = Math.round(target);

    const resolved = resolveProgress(
      target,
      this.progress,
      this.slides.length,
      this.looping,
      this._geo.maxIndex,
    );

    const isInstant = instant === true || (instant && typeof instant === 'object' && !!instant.instant);
    return this._animateTo(resolved, { instant: isInstant });
  }

  play() {
    if (this.options.mode === 'marquee') this.marquee && this.marquee.play();
    this.autoplay && this.autoplay.start();
    return this;
  }

  pause() {
    if (this.options.mode === 'marquee') this.marquee && this.marquee.pause();
    this.autoplay && this.autoplay.pause('api');
    return this;
  }

  toggleAutoplay() {
    if (this.options.mode === 'marquee') this.marquee && this.marquee.toggle();
    else if (this.autoplay) this.autoplay.isRunning ? this.autoplay.pause('api') : this.autoplay.start();
    return this;
  }

  setMode(mode, extra = {}) {
    if (!MODES.includes(mode)) {
      console.warn(`[AnimeCarousel] Unknown mode "${mode}".`);
      return this;
    }
    const previous = this.options.mode;
    const previousIndex = this.activeIndex;
    this._baseOptions = mergeDeep({}, this._baseOptions, extra, { mode });
    this.options = normalizeOptions(this._baseOptions);

    if (previous === 'marquee') this.marquee && this.marquee.unmount();
    if (this._kenburnsTl) {
      this._kenburnsTl.revert();
      this._release(this._kenburnsTl);
      this._kenburnsTl = null;
    }

    this._applyClasses();
    this._prepareSlides();
    this.nav.mount();
    this._measure();
    this.progress = resolveProgress(
      previousIndex,
      this.progress,
      this.slides.length,
      this.looping,
      this._geo.maxIndex,
    );
    this._target = this.progress;
    if (mode === 'marquee') {
      // The previous mode may have hidden off-screen slides inline; the ticker
      // shows every item and must not inherit those transforms.
      for (const slide of this.slides) {
        slide.style.transform = '';
        slide.style.opacity = '';
        slide.style.zIndex = '';
        slide.style.visibility = '';
        slide.style.pointerEvents = '';
        slide.style.filter = '';
      }
    }
    this._render();
    this.nav.update();
    this.a11y && this.a11y.update();
    this.drag && this.drag.updateCursor();
    this.lazy.scan();

    if (mode === 'marquee') this.marquee && this.marquee.mount();
    if (mode === 'kenburns') this._kenburns(this.activeIndex);
    if (mode === 'staggered') this._reveal(this.activeIndex);

    return this;
  }

  /** Alias used by both Slick (`slickSetOption`) and Swiper (`update`). */
  setOption(key, value) {
    return this.setMode(this.options.mode, { [key]: value });
  }

  addSlide(content, index) {
    const slide = typeof content === 'string' ? createElement('div', '', { html: content }) : content;
    if (!slide || slide.nodeType !== 1) return this;

    slide.__ajcHadSlideClass = slide.classList.contains('ajc__slide');
    slide.__ajcHadSlideAttr = slide.hasAttribute('data-ajc-slide');
    slide.classList.add('ajc__slide');
    slide.setAttribute('data-ajc-slide', '');

    const at = clamp(Number(index ?? this.slides.length), 0, this.slides.length);
    const reference = this.slides[at] || null;
    this.track.insertBefore(slide, reference);
    this.slides.splice(at, 0, slide);
    this.slides.forEach((item, i) => (item.dataset.ajcIndex = String(i)));

    this.refresh();
    this.nav.mount();
    this.a11y && this.a11y.addSlide(slide, at);
    return slide;
  }

  removeSlide(index) {
    const at = clamp(Number(index), 0, this.slides.length - 1);
    const slide = this.slides[at];
    if (!slide) return this;
    const reveal = this._revealAnims.get(slide);
    if (reveal) {
      reveal.revert();
      this._release(reveal);
      this._revealAnims.delete(slide);
    }
    slide.remove();
    this.slides.splice(at, 1);
    this.slides.forEach((item, i) => (item.dataset.ajcIndex = String(i)));
    this.progress = resolveProgress(
      this.activeIndex,
      this.progress,
      this.slides.length,
      this.looping,
      this._geo ? this._geo.maxIndex : Math.max(0, this.slides.length - 1),
    );
    this._target = this.progress;
    this.refresh();
    this.nav.mount();
    this.a11y && this.a11y.update();
    if (this.options.mode === 'marquee') this.marquee.restart();
    return this;
  }

  /** Re-measure, re-render, rebuild pagination — the `refresh()`/`update()` pair. */
  refresh({ silent = false } = {}) {
    if (this.destroyed) return this;
    this._measure();
    const max = this._geo.maxIndex;
    if (!this.looping) this.progress = clamp(this.progress, 0, max);
    this._target = this.progress;
    this._render();
    this.nav && this.nav.update();
    if (this.marquee) this.marquee.restart();
    this.lazy && this.lazy.scan();
    if (!silent) this.emit('after', this._detail(this.activeIndex, this.activeIndex));
    return this;
  }

  update() {
    return this.refresh();
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;

    this.emit('destroy', { instance: this });

    detachSync(this);
    if (this._kenburnsTl) {
      this._kenburnsTl.revert();
      this._release(this._kenburnsTl);
      this._kenburnsTl = null;
    }
    this.autoplay && this.autoplay.destroy();
    this.drag && this.drag.destroy();
    this.nav && this.nav.destroy();
    this.marquee && this.marquee.destroy();
    this.responsive && this.responsive.destroy();
    this.a11y && this.a11y.destroy();
    this._cleanup.forEach((fn) => fn());
    this._cleanup.length = 0;

    if (this._anim) {
      this._anim.pause();
      this._release(this._anim);
      this._anim = null;
    }
    for (const animation of this._animations) animation.revert();
    this._animations.clear();
    this._revealAnims.clear();

    for (const slide of this.slides) {
      // Inline animation styles are removed property by property: `utils.set()`
      // skips empty strings, so it cannot blank a style back to its CSS value.
      slide.style.transform = '';
      slide.style.opacity = '';
      slide.style.zIndex = '';
      slide.style.visibility = '';
      slide.style.pointerEvents = '';
      slide.style.filter = '';
      slide.style.width = '';
      slide.style.height = '';
      slide.removeAttribute('aria-hidden');
      slide.removeAttribute('role');
      slide.removeAttribute('aria-roledescription');
      slide.removeAttribute('aria-label');
      slide.removeAttribute('tabindex');
      ['is-active', 'is-visible', 'is-lazy-loading', 'is-lazy-loaded'].forEach((name) =>
        slide.classList.remove(name),
      );
      if (!slide.__ajcHadSlideClass) slide.classList.remove('ajc__slide');
      if (!slide.__ajcHadSlideAttr) slide.removeAttribute('data-ajc-slide');
      delete slide.__ajcHadSlideClass;
      delete slide.__ajcHadSlideAttr;
    }
    this._lastTransform.clear();

    if (this.viewport) {
      this.viewport.style.height = '';
      this.viewport.removeAttribute('tabindex');
      this.viewport.removeAttribute('role');
      this.viewport.removeAttribute('aria-roledescription');
      this.viewport.removeAttribute('aria-label');
      this.viewport.removeAttribute('aria-live');
    }

    // Put user slides back where they came from when we generated wrappers.
    // Move one layer at a time: an author-supplied viewport may still have had
    // a generated track inside it, and removing that track used to take the
    // slides with it.
    if (this._createdTrack) {
      while (this.track.firstChild) this.viewport.appendChild(this.track.firstChild);
    }
    if (this._createdViewport) {
      while (this.viewport.firstChild) this.root.appendChild(this.viewport.firstChild);
    }
    this._created.forEach((node) => node.remove());

    Array.from(this.root.classList)
      .filter((name) => name === 'ajc' || name.startsWith('ajc--'))
      .forEach((name) => this.root.classList.remove(name));
    ['--ajc-gap', '--ajc-perspective', '--ajc-speed'].forEach((property) =>
      this.root.style.removeProperty(property),
    );

    delete this.root.__ajcInstance;
    this.slides = [];
  }

  /* ══════════════════════════════════════════════════════════════════
     Sync
     ══════════════════════════════════════════════════════════════════ */

  _attachSync() {
    this._syncRefs = resolveInstances(this.options.asNavFor, this);
    if (this.options.asNavFor && !this._syncRefs.length) {
      // Wait for the sibling to announce itself (script order tolerance).
      setTimeout(() => {
        if (this.destroyed) return;
        this._syncRefs = resolveInstances(this.options.asNavFor, this);
        attachSync(this, this._syncRefs);
      }, 0);
    }
    attachSync(this, this._syncRefs);
  }

  /** Public: `main.sync(thumbs)` or `main.sync('#thumbs')`. */
  sync(target, options = {}) {
    const others = Array.isArray(target) ? target : [target];
    const resolved = others
      .flatMap((item) => (item instanceof AnimeCarousel ? [item] : resolveInstances(item, this)))
      .filter((item) => item && item !== this && !item.destroyed);
    if (!resolved.length) return this;

    this._syncRefs = Array.from(new Set([...(this._syncRefs || []), ...resolved]));
    attachSync(this, resolved);

    if (options.bidirectional !== false) {
      for (const item of resolved) {
        item._syncRefs = Array.from(new Set([...(item._syncRefs || []), this]));
        attachSync(item, [this]);
      }
    }
    return this;
  }

  /**
   * Push the settled index to every linked slider. The link graph is the source
   * of truth so a runtime `sync()` works without either side declaring
   * `asNavFor`. Each partner is marked as sync-driven until it settles, which
   * stops the same index from being echoed back and causing duplicate events.
   */
  _syncTo(index, instant = false) {
    let targets = getLinks(this);
    if (!targets.length && this.options.asNavFor) {
      // A sibling script may have been appended after init; resolve lazily.
      this._syncRefs = resolveInstances(this.options.asNavFor, this);
      attachSync(this, this._syncRefs);
      targets = getLinks(this);
    }
    if (!targets.length || this._syncing) return;
    const sourceMax = this._geo ? this._geo.maxIndex : this.slides.length - 1;

    for (const target of targets) {
      if (!target || target === this || target.destroyed || !target._geo) continue;
      const targetMax = target._geo.maxIndex;
      const mapped =
        sourceMax > 0 && targetMax > 0
          ? clamp(Math.round((index / sourceMax) * targetMax), 0, targetMax)
          : 0;
      if (target.activeIndex === mapped && Number.isInteger(target.progress)) continue;

      target._syncing = true;
      target.goTo(mapped, instant);
    }
  }
}
