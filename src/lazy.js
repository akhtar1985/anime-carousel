/**
 * Lazy loading for `data-src` / `data-srcset` and `<picture>` sources.
 * - `'ondemand'` loads everything within (and one slide past) the visible window.
 * - `'progressive'` walks the whole set in slices on idle frames.
 */
export class Lazy {
  constructor(slider) {
    this.slider = slider;
    this.queue = [];
    this.cursor = 0;
    this.idleHandle = 0;
    this.loaded = new WeakSet();
  }

  get mode() {
    const value = this.slider.options.lazyLoad;
    if (!value) return false;
    return value === 'progressive' ? 'progressive' : 'ondemand';
  }

  scan() {
    if (!this.mode) return;
    this.slider.slides.forEach((slide) => {
      if (!slide.dataset.ajcLazyScanned) {
        slide.dataset.ajcLazyScanned = '1';
        slide.classList.add('is-lazy-loading');
      }
    });
    if (this.mode === 'progressive') this._queueAll();
    else this.load();
  }

  _targets(slide) {
    return Array.from(
      slide.querySelectorAll('img[data-src], img[data-srcset], source[data-srcset], [data-background]'),
    );
  }

  _loadSlide(slide) {
    if (!slide || this.loaded.has(slide)) return false;
    const targets = this._targets(slide);
    if (!targets.length) return false;

    targets.forEach((element) => {
      if (element.dataset.srcset) {
        element.srcset = element.dataset.srcset;
        delete element.dataset.srcset;
      }
      if (element.dataset.src) {
        element.src = element.dataset.src;
        delete element.dataset.src;
      }
      if (element.dataset.background) {
        element.style.backgroundImage = `url("${element.dataset.background}")`;
        delete element.dataset.background;
      }
    });

    const images = Array.from(slide.querySelectorAll('img'));
    const pending = images.filter((img) => !img.complete);
    const done = () => {
      slide.classList.remove('is-lazy-loading');
      slide.classList.add('is-lazy-loaded');
      slide.dispatchEvent(new CustomEvent('ajc:lazy-loaded', { bubbles: true, detail: { slide } }));
    };
    if (!pending.length) done();
    else {
      let remaining = pending.length;
      pending.forEach((img) => {
        const finish = () => {
          remaining -= 1;
          if (remaining <= 0) done();
        };
        img.addEventListener('load', finish, { once: true });
        img.addEventListener('error', finish, { once: true });
      });
    }

    this.loaded.add(slide);
    return true;
  }

  load() {
    if (!this.mode) return;
    if (this.mode === 'progressive') {
      this._loadNext();
      return;
    }
    const slider = this.slider;
    const geo = slider._geo;
    const active = slider.activeIndex;
    const radius = Math.ceil(Number(slider.options.slidesToShow) || 1) + 1;
    slider.slides.forEach((slide, index) => {
      let distance = Math.abs(index - active);
      if (geo && geo.loop) distance = Math.min(distance, Math.abs(geo.n - distance));
      if (distance <= radius) this._loadSlide(slide);
    });
  }

  _queueAll() {
    this.queue = this.slider.slides.slice();
    this.cursor = 0;
    this._pump();
  }

  _pump() {
    if (this.idleHandle || this.cursor >= this.queue.length) return;
    const run = () => {
      this.idleHandle = 0;
      const slide = this.queue[this.cursor];
      this.cursor += 1;
      if (!slide) return;
      this._loadSlide(slide);
      if (this.cursor < this.queue.length) this._pump();
    };
    this._idle = typeof window !== 'undefined' && 'requestIdleCallback' in window;
    this.idleHandle = this._idle
      ? window.requestIdleCallback(run, { timeout: 600 })
      : window.setTimeout(run, 60);
  }

  /** Called by `_render()` — progressive mode is pumped during navigation. */
  _loadNext() {
    if (this.cursor >= this.queue.length) return;
    this._pump();
  }

  destroy() {
    if (this.idleHandle) {
      if (this._idle) window.cancelIdleCallback(this.idleHandle);
      else clearTimeout(this.idleHandle);
    }
    this.idleHandle = 0;
    this.queue = [];
  }
}
