/**
 * AnimeCarousel — the core engine.
 *
 * A single fractional `progress` value drives the whole slider. Every frame we
 * project `progress` onto each slide through `layout.js` (which is what makes
 * infinite loop seamless without clones) and write GPU transforms. Anime.js v4
 * animates that one number, so spring physics, easing and dragging all share
 * the exact same code path.
 */
import { animate, createTimeline, createScope, stagger, createSpring, utils } from 'animejs';

import { DEFAULT_OPTIONS, MODES, normalizeOptions, readDataAttributes } from './defaults.js';
import { createGeometry, getEffect, toTransform } from './layout.js';
import {
  createElement,
  debounce,
  emitDomEvent,
  isBrowser,
  mergeDeep,
  prefersReducedMotion,
  resolveElement,
  resolvePx,
  round,
  signedWrap,
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
import { attachSync, detachSync, registerInstance, resolveInstances, syncClicks } from './sync.js';

export const VERSION = '1.0.0';

// Anime.js v4 `utils` — same semantics as the local helpers, shared with the engine.
const clamp = utils.clamp;

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

const SLIDE_CLASSES = ['ajc__slide', 'is-active', 'is-visible', 'is-lazy-loading', 'is-lazy-loaded'];

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
    this.emit('init', { index: this.activeIndex, slides: this.slides });
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
    this.scope = createScope({ root: this.root });
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
      for (const slide of this.slides) {
        slide.style.width = vertical ? '100%' : '';
        slide.style.height = '';
      }
      // One reflow, then measure the natural box of every slide.
      sizes = this.slides.map((slide) => {
        const rect = slide.getBoundingClientRect();
        return Math.max(0, vertical ? rect.height : rect.width);
      });
      if (!sizes.some((size) => size > 0)) {
        const fallback = Math.max(0, viewportSize - pad * 2);
        sizes = new Array(n).fill(fallback);
      }
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
   * Create an Anime.js instance inside the scope (so `destroy()` reverts it) and
   * hand it back. `scope.add()` returns the *scope*, not the animation, so the
   * instance is captured from inside the callback.
   */
  _track(factory) {
    let created = null;
    this.scope.add(() => {
      created = factory();
    });
    return created;
  }

  _animateTo(target, { instant = false, speed, ease, silent = false } = {}) {
    const from = this.progress;
    if (Math.abs(target - from) < 0.0005) {
      this.progress = target;
      this._render();
      this._settle(false, { silent, previous: Math.round(from), instant: true });
      return this;
    }

    if (this._anim) {
      this._anim.pause();
      this._anim = null;
    }

    if (!silent) {
      this._emitBefore(from, target);
      this.emit('change', this._detail(from, target));
    }

    const duration = instant || this._reduced ? 0 : Math.max(0, speed == null ? this.options.speed : speed);

    if (duration <= 0) {
      this.progress = target;
      this._render();
      this._settle(false, { previous: Math.round(from), instant: true });
      return this;
    }

    const proxy = { p: from };
    this._anim = this._track(() =>
      animate(proxy, {
        p: target,
        duration,
        ease: ease || this._ease(),
        onUpdate: () => {
          this.progress = proxy.p;
          this._render();
        },
        onComplete: () => {
          this._anim = null;
          this.progress = target;
          this._render();
          this._settle(false, { previous: Math.round(from) });
        },
      }),
    );
    return this;
  }

  /** Called whenever the position is final (either instant or at transition end). */
  _settle(initial = false, { silent = false, previous = null, instant = false } = {}) {
    const index = this.activeIndex;

    // Keep `progress` bounded so long sessions never lose precision.
    if (this._geo && this._geo.loop && Math.abs(this.progress) > this._geo.n * 4) {
      this.progress = wrap(this.progress, this._geo.n);
      this._render();
    }

    this.nav && this.nav.update();
    this.a11y && this.a11y.update();
    this.drag && this.drag.updateCursor();
    this.autoplay && this.autoplay.onSettled();
    this._adaptiveHeight();
    this._runEnterEffect(index);

    if (!silent && !initial) {
      const prev = previous == null ? index : previous;
      this.emit('after', this._detail(index, prev));
      this.emit('transitionEnd', { index, previousIndex: prev, slides: this.slides });
    }

    this._reachState(index, initial);
    if (!initial) {
      // Keep `_syncing` true while pushing outwards so partners never echo back.
      this._syncTo(index, instant);
      this._syncing = false;
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
    this._track(() =>
      animate(this.viewport, {
        height: `${height}px`,
        duration: Math.min(this.options.speed, 500),
        ease: this.options.easing,
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
    this.scope.add(() =>
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
    const n = this.slides.length;
    if (!n) return 0;
    if (this.looping) return wrap(Math.round(this.progress), n);
    return clamp(Math.round(this.progress), 0, this._geo ? this._geo.maxIndex : n - 1);
  }

  _initialProgress() {
    const n = this.slides.length;
    if (!n) return 0;
    return clamp(Number(this.options.initialSlide) || 0, 0, n - 1);
  }

  _detail(index, previousIndex) {
    const total = this.slides.length;
    return {
      index,
      previousIndex,
      slide: this.slides[index] || null,
      slides: this.slides,
      direction: index > previousIndex ? 'next' : index < previousIndex ? 'prev' : 'none',
      total,
      instance: this,
    };
  }

  _emitBefore(from, to) {
    const detail = this._detail(Math.round(to), Math.round(from));
    this.emit('before', detail);
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
    if (this.options.emitEvents) emitDomEvent(this.root, toKebab(type), detail);
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
    const vertical = this.options.vertical;
    const horizontal = !vertical;
    const rtl = this.options.rtl;
    const key = event.key;

    let handled = true;
    if ((horizontal && (key === 'ArrowRight' || (rtl && key === 'ArrowLeft'))) || (!horizontal && key === 'ArrowDown')) {
      this.next();
    } else if ((horizontal && key === 'ArrowLeft') || (!horizontal && key === 'ArrowUp')) {
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
    if (event.ctrlKey) return;

    const { deltaX, deltaY } = event;
    const vertical = this.options.vertical;
    const delta = vertical ? deltaY : Math.abs(deltaX) > Math.abs(deltaY) ? deltaX : deltaY;
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
    return this.goTo(this._stepTarget(1));
  }

  prev() {
    return this.goTo(this._stepTarget(-1));
  }

  _stepTarget(direction) {
    const step = Math.max(1, this.options.slidesToScroll);
    if (this.looping && this.slides.length > 1) return this.progress + direction * step;
    const max = this._geo ? this._geo.maxIndex : this.slides.length - 1;
    return clamp(Math.round(this.progress) + direction * step, 0, max);
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

    let resolved;
    if (this.looping && this.slides.length > 1) {
      const current = Math.round(this.progress);
      const delta = signedWrap(target - wrap(current, this.slides.length), this.slides.length);
      resolved = this.progress + delta;
    } else {
      resolved = clamp(target, 0, this._geo.maxIndex);
    }

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
    this._baseOptions = mergeDeep({}, this._baseOptions, extra, { mode });
    this.options = normalizeOptions(this._baseOptions);

    if (previous === 'marquee') this.marquee && this.marquee.unmount();
    if (this._kenburnsTl) {
      this._kenburnsTl.revert();
      this._kenburnsTl = null;
    }

    this._applyClasses();
    this._prepareSlides();
    this.nav.mount();
    this._measure();
    this.progress = this.looping ? this.progress : clamp(this.progress, 0, this._geo.maxIndex);
    this._render();
    this.nav.update();
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

    slide.classList.add('ajc__slide');
    slide.setAttribute('data-ajc-slide', '');

    const at = clamp(Number(index ?? this.slides.length), 0, this.slides.length);
    const reference = this.slides[at] || null;
    this.track.insertBefore(slide, reference);
    this.slides.splice(at, 0, slide);
    this.slides.forEach((item, i) => (item.dataset.ajcIndex = String(i)));

    this.refresh(); 
    this.nav.mount();
    this.nav.update();
    if (this.options.mode === 'marquee') this.marquee.restart();
    return slide;
  }

  removeSlide(index) {
    const at = clamp(Number(index), 0, this.slides.length - 1);
    const slide = this.slides[at];
    if (!slide) return this;
    slide.remove();
    this.slides.splice(at, 1);
    this.slides.forEach((item, i) => (item.dataset.ajcIndex = String(i)));
    this.progress = clamp(this.progress, 0, Math.max(0, this.slides.length - 1));
    this.refresh();
    this.nav.mount();
    this.nav.update();
    if (this.options.mode === 'marquee') this.marquee.restart();
    return this;
  }

  /** Re-measure, re-render, rebuild pagination — the `refresh()`/`update()` pair. */
  refresh({ silent = false } = {}) {
    if (this.destroyed) return this;
    this._measure();
    const max = this._geo.maxIndex;
    if (!this.looping) this.progress = clamp(this.progress, 0, max);
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
    if (this._kenburnsTl) this._kenburnsTl.revert();
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
      this._anim = null;
    }
    this.scope.revert();

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
      SLIDE_CLASSES.forEach((name) => slide.classList.remove(name));
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
    if (this._createdViewport) {
      while (this.track.firstChild) this.root.appendChild(this.track.firstChild);
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
      .filter((item) => item && item !== this);
    this._syncRefs = Array.from(new Set([...(this._syncRefs || []), ...resolved]));
    if (options.bidirectional !== false) resolved.forEach((item) => attachSync(item, [this]));
    attachSync(this, resolved);
    return this;
  }

  _syncTo(index, instant = false) {
    if (this._syncing) return;
    const targets = this._syncRefs || [];
    if (!targets.length) return;
    this._syncing = true;
    try {
      for (const target of targets) {
        if (!target || target.destroyed) continue;
        const total = target.slides.length;
        if (!total) continue;
        const mapped =
          this.slides.length > 1
            ? Math.round((index / (this.slides.length - 1)) * (total - 1))
            : Math.min(index, total - 1);
        target._syncing = true;
        target.goTo(mapped, instant);
        target._syncing = false;
      }
    } finally {
      this._syncing = false;
    }
  }
}
