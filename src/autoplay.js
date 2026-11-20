/**
 * Autoplay with Slick-compatible pause rules (hover, focus, dots hover,
 * interaction) and Swiper's `stopOnLastSlide` behaviour.
 */
export class Autoplay {
  constructor(slider) {
    this.slider = slider;
    this.timer = 0;
    this.active = false;
    this.blocked = new Set();
    this.cleanup = [];
    this._bind();
  }

  get isRunning() {
    return this.active && this.blocked.size === 0 && !this.slider.destroyed;
  }

  get _delay() {
    return Math.max(200, Number(this.slider.options.autoplaySpeed) || 3000);
  }

  _bind() {
    const { root } = this.slider;
    const options = () => this.slider.options;

    const onEnter = () => {
      if (options().pauseOnHover) this.block('hover');
    };
    const onLeave = () => this.unblock('hover');

    root.addEventListener('pointerenter', onEnter);
    root.addEventListener('pointerleave', onLeave);
    this.cleanup.push(() => {
      root.removeEventListener('pointerenter', onEnter);
      root.removeEventListener('pointerleave', onLeave);
    });

    // Delegated so it keeps working when pagination is rebuilt.
    const onOver = (event) => {
      if (options().pauseOnDotsHover && event.target.closest && event.target.closest('.ajc__dots')) this.block('dots');
    };
    const onOut = (event) => {
      if (event.target.closest && event.target.closest('.ajc__dots')) this.unblock('dots');
    };
    root.addEventListener('pointerover', onOver);
    root.addEventListener('pointerout', onOut);
    this.cleanup.push(() => {
      root.removeEventListener('pointerover', onOver);
      root.removeEventListener('pointerout', onOut);
    });

    const onVisibility = () => {
      if (document.hidden) this.block('hidden');
      else this.unblock('hidden');
    };
    document.addEventListener('visibilitychange', onVisibility);
    this.cleanup.push(() => document.removeEventListener('visibilitychange', onVisibility));
  }

  start() {
    if (!this.slider.options.autoplay || this.slider.destroyed) return this;
    if (this.slider.options.mode === 'marquee') {
      this.slider.marquee && this.slider.marquee.play();
      return this;
    }
    const wasActive = this.active;
    this.active = true;
    this.blocked.clear();
    this._schedule();
    if (!wasActive) this.slider.emit('autoplayStart', { index: this.slider.activeIndex });
    return this;
  }

  pause(reason = 'api') {
    if (reason === 'api') this.active = false;
    this.block(reason);
    return this;
  }

  block(reason) {
    this.blocked.add(reason);
    clearTimeout(this.timer);
    this.timer = 0;
  }

  resume(reason = 'api') {
    this.blocked.delete(reason);
    if (this.active && this.blocked.size === 0) this._schedule();
    return this;
  }

  /** Alias kept for symmetry with `block()` / internal listeners. */
  unblock(reason = 'api') {
    return this.resume(reason);
  }

  stop() {
    const wasActive = this.active;
    this.active = false;
    this.blocked.clear();
    clearTimeout(this.timer);
    this.timer = 0;
    if (wasActive) this.slider.emit('autoplayStop', { index: this.slider.activeIndex });
    return this;
  }

  /** Restart the timer after any settle so autoplay never races a transition. */
  onSettled() {
    if (!this.active) return;
    clearTimeout(this.timer);
    this.timer = 0;
    if (this.isRunning) this._schedule();
  }

  _schedule() {
    clearTimeout(this.timer);
    this.timer = 0;
    if (!this.isRunning || this.slider.options.mode === 'marquee') return;
    this.timer = setTimeout(() => this._tick(), this._delay);
  }

  _tick() {
    this.timer = 0;
    if (!this.isRunning) return;
    const slider = this.slider;
    const max = slider._geo ? slider._geo.maxIndex : slider.slides.length - 1;
    const atEnd = !slider.looping && slider.activeIndex >= max;

    if (atEnd) {
      if (slider.options.stopOnLastSlide) {
        this.stop();
        return;
      }
      slider.goTo(0);
      return;
    }
    slider.next();
  }

  destroy() {
    clearTimeout(this.timer);
    this.timer = 0;
    this.active = false;
    this.cleanup.forEach((fn) => fn());
    this.cleanup.length = 0;
  }
}
