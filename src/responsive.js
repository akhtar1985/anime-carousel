/**
 * Responsive settings with both dialects:
 * - Slick:  `responsive: [{ breakpoint: 768, settings: { slidesToShow: 2 } }]` (max-width)
 * - Swiper: `responsive: { 768: { slidesToShow: 2 } }` (min-width)
 */
import { normalizeOptions } from './defaults.js';
import { mergeDeep } from './utils.js';

export class Responsive {
  constructor(slider) {
    this.slider = slider;
    this.current = null;
    this.initialised = false;
  }

  init() {
    this.check(true);
  }

  get config() {
    return this.slider._baseOptions.responsive || this.slider.options.responsive;
  }

  _size() {
    if (this.slider.options.breakpointsBase === 'container') {
      return this.slider.viewport.clientWidth;
    }
    return typeof window !== 'undefined' ? window.innerWidth : 0;
  }

  /** @returns {{ key: string, settings: object, breakpoint: number }|null} */
  match(size) {
    const config = this.config;
    if (!config) return null;

    if (Array.isArray(config)) {
      const sorted = config
        .filter((entry) => entry && Number.isFinite(Number(entry.breakpoint)))
        .slice()
        .sort((a, b) => Number(a.breakpoint) - Number(b.breakpoint));
      let matched = null;
      for (const entry of sorted) {
        if (size <= Number(entry.breakpoint)) {
          matched = entry;
          break;
        }
      }
      if (!matched) return null;
      return {
        key: `max-${matched.breakpoint}`,
        breakpoint: Number(matched.breakpoint),
        settings: matched.settings || {},
      };
    }

    if (typeof config === 'object') {
      const keys = Object.keys(config)
        .map(Number)
        .filter((key) => Number.isFinite(key))
        .sort((a, b) => b - a);
      for (const key of keys) {
        if (size >= key) return { key: `min-${key}`, breakpoint: key, settings: config[key] || {} };
      }
      return null;
    }
    return null;
  }

  check(force = false) {
    if (this.slider.destroyed) return;
    const size = this._size();
    const matched = this.match(size);
    const key = matched ? matched.key : 'base';
    if (!force && key === this.current) return;
    const hadPrevious = this.current !== null;
    this.current = key;

    const slider = this.slider;
    const settings = matched ? matched.settings : {};
    slider.options = normalizeOptions(mergeDeep({}, slider._baseOptions, settings));

    slider._applyClasses();
    slider._prepareSlides();
    slider._measure();
    if (!slider.looping) {
      slider.progress = Math.min(slider.progress, slider._geo.maxIndex);
    }
    slider.progress = Math.max(0, slider.progress);
    slider._render();
    slider.nav && slider.nav.mount();
    slider.lazy && slider.lazy.scan();
    if (slider.marquee) slider.marquee.restart();

    if (hadPrevious || this.initialised) {
      slider.emit('breakpoint', {
        breakpoint: matched ? matched.breakpoint : null,
        settings,
        size,
        index: slider.activeIndex,
      });
    }
    this.initialised = true;
  }

  destroy() {
    this.current = null;
  }
}
