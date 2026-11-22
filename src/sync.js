/**
 * asNavFor / controller sync.
 *
 * Instances are registered by id, then linked in a graph. Each slider pushes
 * its settled index to its partners; a partner that was driven by sync does
 * not push back, so propagation always terminates.
 */
const registry = new Map();
/** @type {Map<object, Set<object>>} */
const links = new Map();

const isInstance = (candidate) => !!candidate && Array.isArray(candidate.slides) && typeof candidate.goTo === 'function';

export function registerInstance(instance) {
  if (!instance || !instance.id) return;
  registry.set(instance.id, instance);
  if (instance.root && instance.root.id) registry.set(instance.root.id, instance);
}

export function unregisterInstance(instance) {
  if (!instance) return;
  if (instance.id) registry.delete(instance.id);
  if (instance.root && instance.root.id) registry.delete(instance.root.id);
  links.delete(instance);
}

export function getInstance(id) {
  return registry.get(id) || null;
}

/**
 * @param {string|Element|object|Array} reference  selector(s), element, instance or array
 * @param {object} [self]
 * @returns {object[]}
 */
export function resolveInstances(reference, self) {
  if (!reference) return [];
  const out = [];
  const push = (value) => {
    if (!value || value === self) return;
    if (isInstance(value)) {
      if (!out.includes(value)) out.push(value);
      return;
    }
    if (value.nodeType === 1) {
      const instance = value.__ajcInstance || registry.get(value.id);
      if (instance && instance !== self && !out.includes(instance)) out.push(instance);
      return;
    }
    if (typeof value === 'string') {
      value
        .split(',')
        .map((part) => part.trim())
        .filter(Boolean)
        .forEach((selector) => {
          let element = null;
          try {
            element = document.querySelector(selector);
          } catch {
            element = null;
          }
          if (element) {
            const instance = element.__ajcInstance || registry.get(element.id) || registry.get(selector);
            if (instance && instance !== self && !out.includes(instance)) out.push(instance);
          } else {
            const instance = registry.get(selector.replace(/^#/, ''));
            if (instance && instance !== self && !out.includes(instance)) out.push(instance);
          }
        });
    }
  };

  if (Array.isArray(reference)) reference.forEach(push);
  else push(reference);
  return out;
}

export function attachSync(source, targets = []) {
  if (!source || !targets.length) return;
  let set = links.get(source);
  if (!set) {
    set = new Set();
    links.set(source, set);
  }
  targets.forEach((target) => {
    if (target && target !== source) set.add(target);
  });
}

export function detachSync(source) {
  links.delete(source);
  // Also drop this instance from every other graph.
  for (const set of links.values()) set.delete(source);
  unregisterInstance(source);
}

/** Test/debug helper: the current link graph. */
export function getLinks(source) {
  return Array.from(links.get(source) || []);
}

/** Click a slide → navigate (Slick `focusOnSelect`, Swiper `slideToClickedSlide`). */
export function syncClicks(slider, event) {
  const { options } = slider;
  if (!options.syncClick && !options.focusOnSelect) return;
  const slide = event.target.closest && event.target.closest('[data-ajc-slide]');
  if (!slide || !slider.track.contains(slide)) return;
  const index = slider.slides.indexOf(slide);
  if (index < 0) return;
  // The settle handler pushes the index through the link graph; doing it here
  // as well produced a second, unguarded navigation on the partner.
  slider.goTo(index);
}
