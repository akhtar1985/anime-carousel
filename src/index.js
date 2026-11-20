/**
 * AnimeCarousel — public entry point.
 *
 * @example
 * import { AnimeCarousel } from 'anime-carousel';
 * import 'anime-carousel/styles';
 *
 * const slider = new AnimeCarousel('#hero', { mode: 'coverflow', infinite: true });
 */
import { AnimeCarousel, VERSION } from './slider.js';

export { AnimeCarousel, VERSION };
export { DEFAULT_OPTIONS, MODES } from './defaults.js';
export { EFFECTS } from './layout.js';
export { getInstance, resolveInstances, attachSync } from './sync.js';

/** Factory that mirrors `new AnimeCarousel(el, options)`. */
export function create(element, options) {
  return new AnimeCarousel(element, options);
}

/** Upgrades every `[data-ajc]` element in `scope` that has no instance yet. */
export function autoInit(scope = document) {
  const selector = '[data-ajc], [data-ajc-auto], .ajc-slider';
  const elements = scope === document ? Array.from(document.querySelectorAll(selector)) : [scope, ...scope.querySelectorAll(selector)];
  return elements
    .filter((element) => element.nodeType === 1 && !element.__ajcInstance)
    .map((element) => new AnimeCarousel(element));
}

AnimeCarousel.version = VERSION;
AnimeCarousel.autoInit = autoInit;
AnimeCarousel.create = create;

export default AnimeCarousel;
