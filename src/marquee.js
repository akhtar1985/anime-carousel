/**
 * Continuous marquee / ticker mode.
 *
 * Slides become an inline flex strip, the strip is cloned until it covers the
 * viewport twice, and a single looping Anime.js timeline translates it. Hover
 * and focus pause the timeline; `destroy()` reverts it and removes the clones.
 */
import { createTimeline } from 'animejs';

export class Marquee {
  constructor(slider) {
    this.slider = slider;
    this.timeline = null;
    this.clones = [];
    this.cleanup = [];
    this.contentWidth = 0;
    this.paused = false;
  }

  get speed() {
    return Math.max(0, Number(this.slider.options.marquee.speed) || 0);
  }

  mount() {
    const slider = this.slider;
    if (slider.options.mode !== 'marquee') return;
    this.unmount();
    slider.root.classList.add('ajc--marquee');

    const { options } = slider;
    if (options.marquee.pauseOnHover) {
      const enter = () => this.pause();
      const leave = () => this.play();
      slider.root.addEventListener('pointerenter', enter);
      slider.root.addEventListener('pointerleave', leave);
      this.cleanup.push(() => {
        slider.root.removeEventListener('pointerenter', enter);
        slider.root.removeEventListener('pointerleave', leave);
      });
    }

    this._measure();
    this._build();
    this.start();
  }

  _measure() {
    const slider = this.slider;
    const gap = slider.options.spaceBetween;
    let width = 0;
    slider.slides.forEach((slide, index) => {
      width += index === slider.slides.length - 1 ? slide.offsetWidth : slide.offsetWidth + gap;
    });
    this.contentWidth = width;
  }

  _build() {
    const slider = this.slider;
    const { options } = slider;
    slider.track.style.display = 'flex';
    slider.track.style.gap = `${options.spaceBetween}px`;
    slider.track.style.willChange = 'transform';

    if (!options.marquee.duplicated || !this.contentWidth) return;

    const needed = slider.viewport.clientWidth + this.contentWidth * 2;
    let total = this.contentWidth;
    let guard = 0;
    while (total < needed && guard < 8 && slider.slides.length) {
      for (const slide of slider.slides.slice()) {
        const clone = slide.cloneNode(true);
        clone.setAttribute('data-ajc-clone', '');
        clone.setAttribute('aria-hidden', 'true');
        clone.classList.remove('is-active', 'is-visible');
        clone.querySelectorAll('[id]').forEach((node) => node.removeAttribute('id'));
        clone.querySelectorAll('a, button, input, select, textarea').forEach((node) => {
          node.setAttribute('tabindex', '-1');
          node.setAttribute('aria-hidden', 'true');
        });
        clone.inert = true;
        slider.track.appendChild(clone);
        this.clones.push(clone);
      }
      total += this.contentWidth;
      guard += 1;
    }
  }

  start() {
    const slider = this.slider;
    if (slider.destroyed || this.speed <= 0 || !this.contentWidth) return;
    if (this.timeline) this.timeline.play();
    else this._animate();

    if (slider._reduced) {
      this.timeline && this.timeline.pause();
    }
  }

  _animate() {
    const slider = this.slider;
    const reverse = slider.options.marquee.direction === 'reverse';
    const distance = reverse ? this.contentWidth : -this.contentWidth;
    const duration = Math.max(1000, (this.contentWidth / Math.max(1, this.speed)) * 1000);

    this.timeline = slider._track(() =>
      createTimeline({
        loop: true,
        defaults: { duration, ease: 'linear' },
      }).add(slider.track, { x: [reverse ? -this.contentWidth : 0, distance] }, 0),
    );
  }

  play() {
    this.paused = false;
    this.timeline && this.timeline.play();
  }

  pause() {
    this.paused = true;
    this.timeline && this.timeline.pause();
  }

  toggle() {
    if (this.paused) this.play();
    else this.pause();
  }

  /** `_render()` delegates here in marquee mode — nothing to project per frame. */
  sync() {}

  /** Recompute widths (slides added/removed, resize, option changes). */
  restart() {
    if (this.slider.options.mode !== 'marquee') return;
    this.unmount();
    this.mount();
  }

  unmount() {
    this.cleanup.forEach((fn) => fn());
    this.cleanup.length = 0;
    if (this.timeline) {
      this.timeline.revert();
      this.slider._release(this.timeline);
      this.timeline = null;
    }
    this.clones.forEach((clone) => clone.remove());
    this.clones.length = 0;
    this.slider.track.style.transform = '';
    this.slider.track.style.display = '';
    this.slider.track.style.gap = '';
    this.slider.track.style.willChange = '';
    this.slider.root.classList.remove('ajc--marquee');
  }

  destroy() {
    this.unmount();
  }
}
