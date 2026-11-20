/**
 * Pointer/touch dragging with momentum snapping, resistance on the edges and
 * `swipeToSlide` support. Works for both axes and respects RTL.
 */
import { clamp, isInteractive } from './utils.js';

/**
 * Read a numeric option, falling back only when it is absent or not a number.
 * Deliberately no hard floor: an arbitrary floor silently made the low end of a
 * documented range (touchThreshold, dragThreshold, dragResistance) a no-op.
 */
const numeric = (value, fallback) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

export class Drag {
  constructor(slider) {
    this.slider = slider;
    this.cleanup = [];
    this.pointerCleanup = [];
    this.state = null;
    this.suppressClick = false;
  }

  get enabled() {
    const { options } = this.slider;
    return !!options.draggable && options.mode !== 'marquee' && this.slider.slides.length > 1;
  }

  _axis() {
    const { options } = this.slider;
    return options.vertical && (options.verticalSwiping || options.vertical) ? 'y' : 'x';
  }

  mount() {
    const viewport = this.slider.viewport;
    const onDown = (event) => this._down(event);
    viewport.addEventListener('pointerdown', onDown);
    this.cleanup.push(() => viewport.removeEventListener('pointerdown', onDown));

    const onClickCapture = (event) => {
      if (!this.suppressClick) return;
      event.preventDefault();
      event.stopPropagation();
      this.suppressClick = false;
    };
    this.slider.root.addEventListener('click', onClickCapture, true);
    this.cleanup.push(() => this.slider.root.removeEventListener('click', onClickCapture, true));

    this.updateCursor();
  }

  updateCursor() {
    const root = this.slider.root;
    const { options } = this.slider;
    const draggable = this.enabled && options.draggable;
    const max = this.slider._geo ? this.slider._geo.maxIndex : this.slider.slides.length - 1;
    const looping = this.slider.looping;
    const atEdge = !looping && (this.slider.activeIndex <= 0 || this.slider.activeIndex >= max);
    root.classList.toggle('ajc--draggable', !!(draggable && (!atEdge || looping)));
  }

  _down(event) {
    if (!this.enabled) return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    if (isInteractive(event.target) && !event.target.closest('[data-ajc-slide]')) return;
    if (event.target.closest('.ajc__arrow, .ajc__dots, [data-ajc-no-drag]')) return;

    const slider = this.slider;
    if (slider._geo && !slider.looping && slider.slides.length <= 1) return;

    this.state = {
      id: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startProgress: slider.progress,
      startTime: Date.now(),
      delta: 0,
      dragging: false,
    };

    const onMove = (moveEvent) => this._move(moveEvent);
    const onUp = (upEvent) => this._up(upEvent);
    const onCancel = (cancelEvent) => this._up(cancelEvent, true);

    window.addEventListener('pointermove', onMove, { passive: false });
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onCancel);
    this.pointerCleanup.push(() => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onCancel);
    });
  }

  _move(event) {
    const state = this.state;
    if (!state || event.pointerId !== state.id) return;
    const slider = this.slider;
    const { options } = slider;
    const axis = this._axis();

    const delta = axis === 'y' ? event.clientY - state.startY : event.clientX - state.startX;
    state.delta = delta;

    if (!state.dragging) {
      if (Math.abs(delta) < numeric(options.touchThreshold, 5)) return;
      state.dragging = true;
      slider.root.classList.add('is-dragging');
      if (options.pauseOnInteraction) slider.autoplay && slider.autoplay.pause('interaction');
      slider.emit('dragStart', { delta, index: slider.activeIndex });
    }

    if (event.cancelable) event.preventDefault();

    const geo = slider._geo;
    if (!geo) return;
    const step = Math.max(1, geo.step);
    const dir = options.rtl && axis === 'x' ? -1 : 1;
    let raw = state.startProgress - (delta / step) * dir;

    if (!slider.looping) {
      const max = geo.maxIndex;
      const resistance = numeric(options.dragResistance, 0.35);
      if (raw < 0) raw = raw * resistance;
      else if (raw > max) raw = max + (raw - max) * resistance;
    }

    slider.progress = raw;
    slider._render();
    slider.emit('dragMove', { delta, progress: raw, index: slider.activeIndex });
  }

  _up(event, cancelled = false) {
    const state = this.state;
    if (!state) return;
    if (event && event.pointerId != null && event.pointerId !== state.id) return;
    this.state = null;
    this.pointerCleanup.forEach((fn) => fn());
    this.pointerCleanup.length = 0;

    const slider = this.slider;
    slider.root.classList.remove('is-dragging');
    if (!state.dragging) return;

    const { options } = slider;
    const geo = slider._geo;
    const axis = this._axis();
    const elapsed = Math.max(1, Date.now() - state.startTime);
    const velocity = state.delta / elapsed; // px per ms
    const step = Math.max(1, geo ? geo.step : 1);
    const dir = options.rtl && axis === 'x' ? -1 : 1;
    const travelled = (state.delta / step) * dir;

    const fast = Math.abs(velocity) > 0.35;
    const far = Math.abs(travelled) > numeric(options.dragThreshold, 0.18);

    let target;
    if (options.swipeToSlide) {
      target = Math.round(slider.progress);
    } else if ((fast || far) && !cancelled) {
      const direction = state.delta < 0 ? 1 : -1;
      target = state.startProgress + direction * Math.max(1, options.slidesToScroll);
    } else if (cancelled) {
      target = state.startProgress;
    } else {
      target = Math.round(slider.progress);
    }

    if (!slider.looping) target = clamp(target, 0, geo ? geo.maxIndex : 0);

    this.suppressClick = Math.abs(state.delta) > 6;
    slider.goTo(target, { instant: false });
    slider.emit('dragEnd', { delta: state.delta, velocity, index: slider.activeIndex });
    if (options.pauseOnInteraction) slider.autoplay && slider.autoplay.pause('interaction');
  }

  destroy() {
    this.cleanup.forEach((fn) => fn());
    this.cleanup.length = 0;
    this.pointerCleanup.forEach((fn) => fn());
    this.pointerCleanup.length = 0;
    this.state = null;
  }
}
