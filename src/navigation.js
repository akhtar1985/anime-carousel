/**
 * Arrows + pagination (bullets / fraction / progress bar).
 * Supports Slick-style custom templates and Swiper-style `navigation`/`pagination`.
 */
import { createElement, emitDomEvent, resolveTemplate } from './utils.js';

const PREV_ICON =
  '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M15 4.5 7.5 12 15 19.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const NEXT_ICON =
  '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M9 4.5 16.5 12 9 19.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

export class Navigation {
  constructor(slider) {
    this.slider = slider;
    this.cleanup = [];
    this.owned = [];
    this.arrows = { prev: null, next: null };
    this.dots = null;
    this.dotEls = [];
    this.fraction = null;
    this.progressBar = null;
    this.mounted = false;
  }

  _listen(target, type, handler, options) {
    target.addEventListener(type, handler, options);
    this.cleanup.push(() => target.removeEventListener(type, handler, options));
  }

  _own(element) {
    if (!element.__ajcExternal) this.owned.push(element);
    if (!element.parentNode) this.slider.root.appendChild(element);
    return element;
  }

  mount() {
    this.destroy();
    const { options, root } = this.slider;

    if (options.arrows && options.mode !== 'marquee') {
      const prev = resolveTemplate(options.prevArrow, 'ajc__arrow ajc__arrow--prev', PREV_ICON);
      const next = resolveTemplate(options.nextArrow, 'ajc__arrow ajc__arrow--next', NEXT_ICON);
      prev.setAttribute('type', 'button');
      next.setAttribute('type', 'button');
      prev.setAttribute('data-ajc-nav', '');
      next.setAttribute('data-ajc-nav', '');
      if (!prev.getAttribute('aria-label')) prev.setAttribute('aria-label', options.ariaLabels.prev);
      if (!next.getAttribute('aria-label')) next.setAttribute('aria-label', options.ariaLabels.next);
      this._own(prev);
      this._own(next);
      this.arrows.prev = prev;
      this.arrows.next = next;
      this._listen(prev, 'click', () => this.slider.prev());
      this._listen(next, 'click', () => this.slider.next());
    }

    if (options.dots && options.mode !== 'marquee') {
      const type = options.dotsType;
      const dots = createElement('div', `ajc__dots ajc__dots--${type}`);
      dots.setAttribute('data-ajc-nav', '');
      dots.setAttribute('role', type === 'bullets' ? 'tablist' : 'group');
      dots.setAttribute('aria-label', options.ariaLabels.dots);
      this.dots = this._own(dots);
      root.classList.toggle('ajc--dots-progress', type === 'progress');
      this._build(type);
    }

    this.mounted = true;
    this.update();
  }

  _pages() {
    const { options } = this.slider;
    const total = this.slider.slides.length;
    return options.dotsPerPage
      ? Math.max(1, Math.ceil(total / Math.max(1, options.slidesToScroll)))
      : Math.max(1, total);
  }

  _build(type) {
    const { options } = this.slider;
    const dots = this.dots;
    if (!dots) return;
    dots.innerHTML = '';
    this.dotEls = [];

    if (type === 'fraction') {
      const wrap = createElement('div', 'ajc__fraction');
      const current = createElement('span', 'ajc__fraction-current', { text: '1' });
      const separator = createElement('span', 'ajc__fraction-separator', { text: ' / ' });
      const total = createElement('span', 'ajc__fraction-total', { text: String(this.slider.slides.length) });
      wrap.append(current, separator, total);
      dots.appendChild(wrap);
      this.fraction = { current, total };
      return;
    }

    if (type === 'progress') {
      const track = createElement('div', 'ajc__progress');
      track.setAttribute('aria-hidden', 'true');
      const bar = createElement('div', 'ajc__progress-bar');
      track.appendChild(bar);
      dots.appendChild(track);
      this.progressBar = bar;
      return;
    }

    const count = this._pages();
    const perPage = options.dotsPerPage;
    const step = Math.max(1, options.slidesToScroll);

    for (let page = 0; page < count; page++) {
      const dot = createElement('button', 'ajc__dot', { type: 'button' });
      dot.setAttribute('role', 'tab');
      dot.setAttribute('aria-controls', this.slider.viewport.id || '');
      const index = perPage ? page * step : page;
      const label = index + 1;
      dot.setAttribute('aria-label', `Go to slide ${label}`);
      dot.dataset.ajcPage = String(page);

      if (typeof options.customPaging === 'function') {
        const content = options.customPaging(page, dot);
        if (content != null && content !== dot) {
          if (content.nodeType) dot.replaceChildren(content);
          else dot.innerHTML = String(content);
        }
      } else {
        dot.appendChild(createElement('span', 'ajc__dot-inner'));
      }

      if (options.paginationClickable) {
        this._listen(dot, 'click', () => {
          this.slider.goTo(perPage ? page * step : page);
          emitDomEvent(this.slider.root, 'pagination-click', { page });
        });
      } else {
        dot.disabled = true;
      }
      dots.appendChild(dot);
      this.dotEls.push(dot);
    }
  }

  update() {
    if (!this.mounted) return;
    const slider = this.slider;
    const { options } = slider;
    const total = slider.slides.length;
    const active = slider.activeIndex;
    const max = slider._geo ? slider._geo.maxIndex : Math.max(0, total - 1);
    const looping = slider.looping;
    const fits = !!(slider._geo && !looping && slider._geo.total <= slider._geo.viewport + 1);
    const atStart = !looping && active <= 0;
    const atEnd = !looping && active >= max;

    slider.root.classList.toggle('ajc--fits', !!(fits && options.watchOverflow));
    if (options.watchOverflow && fits) {
      if (this.arrows.prev) this.arrows.prev.hidden = true;
      if (this.arrows.next) this.arrows.next.hidden = true;
    } else {
      if (this.arrows.prev) this.arrows.prev.hidden = false;
      if (this.arrows.next) this.arrows.next.hidden = false;
    }

    for (const [direction, element] of Object.entries(this.arrows)) {
      if (!element) continue;
      const edge = direction === 'prev' ? atStart : atEnd;
      element.disabled = edge && !looping;
      element.setAttribute('aria-disabled', String(element.disabled));
      element.classList.toggle('is-disabled', element.disabled);
      element.classList.toggle('is-hidden', edge && options.hideOnEdges && !looping);
    }

    if (!this.dots) return;

    const perPage = options.dotsPerPage;
    const step = Math.max(1, options.slidesToScroll);
    const pages = this._pages();
    const page = perPage ? Math.min(pages - 1, Math.floor(active / step)) : Math.min(pages - 1, active);

    this.dotEls.forEach((dot, i) => {
      const isActive = i === page;
      dot.classList.toggle('is-active', isActive);
      dot.setAttribute('aria-selected', String(isActive));
      dot.tabIndex = isActive ? 0 : -1;
      if (options.dynamicBullets) {
        const distance = Math.abs(i - page);
        dot.classList.toggle('is-near', distance === 1);
        dot.classList.toggle('is-far', distance > 1);
      }
    });

    if (this.fraction) {
      this.fraction.current.textContent = String(active + 1);
      this.fraction.total.textContent = String(total);
    }

    if (this.progressBar) {
      const ratio = total > 1 ? (active + 1) / total : 1;
      this.progressBar.style.width = `${Math.round(ratio * 10000) / 100}%`;
    }
  }

  destroy() {
    this.cleanup.forEach((fn) => fn());
    this.cleanup.length = 0;
    this.owned.forEach((node) => node.remove());
    this.owned.length = 0;
    this.arrows = { prev: null, next: null };
    this.dots = null;
    this.dotEls = [];
    this.fraction = null;
    this.progressBar = null;
    this.slider.root.classList.remove('ajc--fits', 'ajc--dots-progress');
  }
}
