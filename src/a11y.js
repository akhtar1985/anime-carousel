/**
 * Accessibility: landmark roles, slide labels, a polite live region and
 * keyboard-focus management for off-screen slides.
 */
import { createElement } from './utils.js';

export class A11y {
  constructor(slider) {
    this.slider = slider;
    this.status = null;
    this.owned = [];
  }

  setup() {
    const { options, root, viewport, slides } = this.slider;
    if (!options.a11y) return;

    root.setAttribute('role', 'region');
    root.setAttribute('aria-roledescription', 'carousel');
    if (!root.getAttribute('aria-label')) root.setAttribute('aria-label', options.ariaLabels.region);

    if (options.focusable) viewport.tabIndex = 0;
    viewport.setAttribute('role', 'group');
    viewport.setAttribute('aria-label', options.ariaLabels.region);
    if (!viewport.id) {
      viewport.id = `${this.slider.id}-viewport`;
    }

    slides.forEach((slide, index) => {
      slide.setAttribute('role', 'group');
      slide.setAttribute('aria-roledescription', 'slide');
      slide.setAttribute('aria-label', options.ariaLabels.slide(index, slides.length));
    });

    if (options.announce) {
      this.status = createElement('div', 'ajc__status');
      this.status.setAttribute('aria-live', 'polite');
      this.status.setAttribute('aria-atomic', 'true');
      this.status.setAttribute('role', 'status');
      this.owned.push(this.status);
      this.slider.root.appendChild(this.status);
    }
    this.update();
  }

  update() {
    const { options, slides } = this.slider;
    if (!options.a11y) return;
    const index = this.slider.activeIndex;

    slides.forEach((slide, i) => {
      const visible = slide.classList.contains('is-visible');
      if (visible !== slide.__ajcVisible) {
        slide.__ajcVisible = visible;
        slide.inert = !visible;
        if (visible) slide.removeAttribute('tabindex');
        else slide.setAttribute('tabindex', '-1');
      }
      // Labels change when slides are added or removed, not just on navigation.
      slide.setAttribute('aria-label', options.ariaLabels.slide(i, slides.length));
    });

    if (this.status) this.status.textContent = `Slide ${index + 1} of ${slides.length}`;
  }

  /** Apply roles/labels to a slide added at runtime. */
  addSlide(slide, index) {
    const { options, slides } = this.slider;
    if (!options.a11y || !slide) return;
    slide.setAttribute('role', 'group');
    slide.setAttribute('aria-roledescription', 'slide');
    slide.setAttribute('aria-label', options.ariaLabels.slide(index, slides.length));
    delete slide.__ajcVisible;
    this.update();
  }

  destroy() {
    this.owned.forEach((node) => node.remove());
    this.owned.length = 0;
    this.status = null;

    const { root, viewport, slides } = this.slider;
    ['role', 'aria-roledescription', 'aria-label'].forEach((attribute) => root.removeAttribute(attribute));
    viewport.removeAttribute('role');
    viewport.removeAttribute('aria-label');
    viewport.removeAttribute('aria-live');
    slides.forEach((slide) => {
      ['role', 'aria-roledescription', 'aria-label'].forEach((attribute) => slide.removeAttribute(attribute));
      slide.inert = false;
      delete slide.__ajcVisible;
    });
  }
}
