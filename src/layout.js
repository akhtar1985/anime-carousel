/**
 * Geometry + per-mode style computation.
 *
 * The engine never moves a single "track": every slide is laid out on its own
 * GPU transform, which is what makes infinite loop, partial `slidesToShow`,
 * centre mode, coverflow, cards, cube and flip all share one code path.
 */
import { clamp, lerp, signedWrap, wrap, round } from './utils.js';

/**
 * Build a geometry snapshot (rebuilt on refresh / resize only).
 *
 * @param {object} config
 * @param {number[]} config.sizes   measured slide sizes along the axis
 * @param {number} config.gap       `spaceBetween` in px
 * @param {number} config.viewport  viewport size along the axis
 * @param {boolean} config.loop
 * @param {boolean} config.centerMode
 * @param {number} config.centerPadding  px
 * @param {number|'auto'} config.slidesToShow
 */
export function createGeometry({ sizes, gap, viewport, loop, centerMode, centerPadding, slidesToShow }) {
  const n = sizes.length;
  const starts = new Array(n);
  let acc = 0;
  for (let i = 0; i < n; i++) {
    starts[i] = acc;
    acc += (sizes[i] || 0) + gap;
  }
  const total = acc > 0 ? Math.max(0, acc - gap) : 0;
  const period = total + gap;
  const avail = Math.max(0, viewport - centerPadding * 2);
  // Wrapping a strip that fits the viewport would make visible slides jump,
  // so looping only engages when there is something to scroll.
  const canLoop = loop && n > 1 && total > viewport + 1;

  /** Position of a fractional index inside one period. */
  function posAt(p) {
    if (n <= 1) return 0;
    const w = canLoop ? wrap(p, n) : clamp(p, 0, n - 1);
    const i0 = Math.min(Math.floor(w), n - 1);
    const frame = w - i0;
    const start0 = starts[i0];
    const nextStart = i0 + 1 >= n ? (canLoop ? period : start0) : starts[i0 + 1];
    return lerp(start0, nextStart, frame);
  }

  /** Logical (non-mirrored) offset of slide `i` for a fractional `progress`. */
  function posOf(i, progress) {
    let rel = starts[i] - posAt(progress);
    if (canLoop) rel -= period * Math.round(rel / period);
    if (centerMode) rel += centerPadding + (avail - (sizes[i] || 0)) / 2;
    return rel;
  }

  function deltaOf(i, progress) {
    return canLoop ? signedWrap(i - progress, n) : i - progress;
  }

  let maxIndex;
  if (canLoop || centerMode) {
    maxIndex = Math.max(0, n - 1);
  } else if (slidesToShow === 'auto') {
    maxIndex = 0;
    for (let i = 0; i < n; i++) {
      if (starts[i] + sizes[i] <= avail + 0.5) maxIndex = i;
    }
  } else {
    maxIndex = Math.max(0, n - Math.ceil(Number(slidesToShow) || 1));
  }

  return {
    n,
    sizes,
    starts,
    total,
    period,
    gap,
    viewport,
    avail,
    centerMode,
    centerPadding,
    loop: canLoop,
    slidesToShow,
    maxIndex,
    /** Average step, used by drag maths. */
    step: period / Math.max(1, n),
    posAt,
    posOf,
    deltaOf,
    sizeOf: (i) => sizes[i] || 0,
  };
}

/** Style state shared by every mode. */
function baseState(x, y) {
  return {
    x,
    y,
    z: 0,
    tz: 0,
    rotateX: 0,
    rotateY: 0,
    rotateZ: 0,
    scale: 1,
    opacity: 1,
    visible: true,
    zIndex: 0,
    filter: '',
  };
}

const abs = Math.abs;

/**
 * Per-mode effect descriptors.
 * `limit` = how many slide slots away from the active one stay painted.
 * `stacked` = every slide shares the centre point (fade / flip / cube).
 * `perspective` = the root gets a 3D context.
 */
export const EFFECTS = {
  slide: {
    limit: (o) => Math.ceil(Number(o.slidesToShow) || 1) + 2,
    apply() {},
  },

  fade: {
    limit: () => 2,
    stacked: true,
    apply(st, { d, options }) {
      const effect = options.fadeEffect || {};
      const t = Math.min(abs(d), 1);
      st.x = 0;
      st.y = 0;
      st.opacity = clamp(1 - t, 0, 1);
      st.scale = 1 - t * (Number(effect.scale) || 0);
      if (effect.blur) st.filter = `blur(${round(effect.blur * t, 2)}px)`;
      st.visible = st.opacity > 0.002;
    },
  },

  coverflow: {
    limit: (o) => {
      const painted = Math.round(Number(o.coverflowEffect?.visible) || 5);
      return Math.max(1, Math.min(10, painted));
    },
    perspective: true,
    apply(st, { d, options, dir }) {
      const effect = options.coverflowEffect || {};
      const a = abs(d);
      const painted = Math.max(1, Math.min(10, Math.round(Number(effect.visible) || 5)));
      st.x = st.x * (Number(effect.modifier) || 1) + d * (Number(effect.offset) || 0) * dir;
      st.y -= a * (Number(effect.lift) || 0);
      st.z = -a * (Number(effect.depth) || 0);
      st.rotateY = -d * (Number(effect.rotate) || 0);
      st.rotateX = d * (Number(effect.tilt) || 0);
      st.scale = Math.max(0, 1 - a * (1 - (Number(effect.scale) || 1)));
      const op = Number(effect.opacity);
      st.opacity = Number.isFinite(op) && op > 0 ? Math.pow(op, a) : 1;
      const blur = Number(effect.blur) || 0;
      if (blur && a > 0.001) st.filter = `blur(${round(blur * a, 2)}px)`;
      st.visible = a <= painted;
    },
  },

  cards: {
    limit: (o) => Math.ceil(Number(o.cardsEffect?.maxStack) || 3) + 2,
    perspective: true,
    apply(st, { d, options, center, dir, vertical }) {
      const effect = options.cardsEffect || {};
      const a = abs(d);
      const offsetX = Number(effect.offsetX) || 0;
      const offsetY = Number(effect.offsetY) || 0;
      st.x = center.x + (vertical ? 0 : d * offsetX * dir);
      st.y = center.y - a * offsetY * 0.5;
      st.rotateZ = d * (Number(effect.rotate) || 0) * dir;
      st.scale = Math.max(0, 1 - a * (1 - (Number(effect.scale) || 1)));
      const maxStack = Number(effect.maxStack) || 3;
      st.opacity = a <= maxStack ? 1 : Math.max(0, 1 - (a - maxStack) * 1.6);
      st.visible = st.opacity > 0.01;
    },
  },

  wheel: {
    limit: (o) => Math.max(1, Math.min(10, Math.round(Number(o.wheelEffect?.visible) || 4))),
    perspective: true,
    apply(st, { d, options, center, dir, vertical }) {
      const effect = options.wheelEffect || {};
      const radius = Math.max(0, Number(effect.radius) || 0);
      const step = ((Number(effect.angle) || 0) * Math.PI) / 180;
      const theta = d * step;
      const t = abs(d);
      const rise = (1 - Math.cos(theta)) * radius;
      const spread = d * (Number(effect.offset) || 0) * dir;
      const tilt = d * (Number(effect.tilt) || 0);
      const painted = Math.max(1, Math.min(10, Math.round(Number(effect.visible) || 4)));
      if (vertical) {
        st.x = rise * dir;
        st.y = center.y + Math.sin(theta) * radius + spread;
        st.rotateZ = (-theta * 180) / Math.PI * dir;
        st.rotateY = tilt;
      } else {
        st.x = center.x + Math.sin(theta) * radius * dir + spread;
        st.y = center.y + rise;
        st.rotateZ = (theta * 180) / Math.PI * dir;
        st.rotateX = tilt;
      }
      st.z = -t * (Number(effect.depth) || 0);
      st.scale = Math.max(0, 1 - t * (1 - (Number(effect.scale) || 1)));
      st.opacity = Math.pow(Number(effect.opacity) || 0, t);
      const blur = Number(effect.blur) || 0;
      if (blur && t > 0.001) st.filter = `blur(${round(blur * t, 2)}px)`;
      st.visible = t <= painted && st.opacity > 0.02;
    },
  },

  helix: {
    limit: (o) => Math.max(1, Math.min(10, Math.round(Number(o.helixEffect?.visible) || 5))),
    perspective: true,
    apply(st, { d, options, center, dir, vertical }) {
      const effect = options.helixEffect || {};
      const radius = Math.max(0, Number(effect.radius) || 0);
      const step = ((Number(effect.rotate) || 0) * Math.PI) / 180;
      const theta = d * step;
      const t = abs(d);
      const cos = Math.cos(theta);
      const rise = Number(effect.rise) || 0;
      const spread = d * (Number(effect.offset) || 0) * dir;
      const tilt = d * (Number(effect.tilt) || 0);
      const painted = Math.max(1, Math.min(10, Math.round(Number(effect.visible) || 5)));
      st.z = (cos - 1) * radius - t * (Number(effect.depth) || 0);
      if (vertical) {
        st.x = d * rise * dir;
        st.y = center.y + Math.sin(theta) * radius + spread;
        st.rotateX = (-theta * 180) / Math.PI;
        st.rotateY = tilt;
      } else {
        st.x = center.x + Math.sin(theta) * radius * dir + spread;
        st.y = center.y + d * rise;
        st.rotateY = (-theta * 180) / Math.PI * dir;
        st.rotateX = tilt;
      }
      st.scale = Math.max(0, 1 - t * (1 - (Number(effect.scale) || 1)));
      st.opacity = Math.pow(Number(effect.opacity) || 0, t);
      const blur = Number(effect.blur) || 0;
      if (blur && t > 0.001) st.filter = `blur(${round(blur * t, 2)}px)`;
      st.visible = t <= painted && cos > -0.15 && st.opacity > 0.02;
      st.zIndex = Math.round((cos + 1) * 500);
    },
  },

  fold: {
    limit: () => 2,
    stacked: true,
    perspective: true,
    apply(st, { d, options }) {
      const effect = options.foldEffect || {};
      const t = Math.min(abs(d), 1);
      const endOpacity = Number(effect.opacity);
      st.x = 0;
      st.y = 0;
      st.rotateX = d * (Number(effect.rotate) || 0);
      st.z = -t * (Number(effect.depth) || 0);
      st.opacity = 1 - t * (1 - (Number.isFinite(endOpacity) ? endOpacity : 0));
      st.visible = abs(d) < 1.15;
    },
  },

  zoom: {
    limit: () => 2,
    stacked: true,
    perspective: true,
    apply(st, { d, options }) {
      const effect = options.zoomEffect || {};
      const t = Math.min(abs(d), 1);
      const enterScale = Number(effect.scale);
      const exitScale = Number(effect.exitScale);
      const endOpacity = Number(effect.opacity);
      const depth = Number(effect.depth) || 0;
      const blur = Number(effect.blur) || 0;
      st.x = 0;
      st.y = 0;
      if (d >= 0) {
        st.scale = lerp(1, Number.isFinite(enterScale) ? enterScale : 1, t);
        st.z = -t * depth;
      } else {
        st.scale = lerp(1, Number.isFinite(exitScale) ? exitScale : 1, t);
        st.z = t * depth;
      }
      st.opacity = 1 - t * (1 - (Number.isFinite(endOpacity) ? endOpacity : 0));
      if (blur && t > 0.001) st.filter = `blur(${round(blur * t, 2)}px)`;
      st.visible = abs(d) < 1.2 && st.opacity > 0.002;
    },
  },

  flip: {
    limit: () => 2,
    stacked: true,
    perspective: true,
    apply(st, { d, options }) {
      const effect = options.flipEffect || {};
      const t = Math.min(abs(d), 1);
      st.x = 0;
      st.y = 0;
      st.rotateY = -d * (Number(effect.rotate) || 90);
      st.z = -t * (Number(effect.depth) || 0);
      const endOpacity = Number(effect.opacity);
      st.opacity = 1 - t * (1 - (Number.isFinite(endOpacity) ? endOpacity : 0));
      st.visible = abs(d) < 1.15;
    },
  },

  cube: {
    limit: () => 2,
    stacked: true,
    perspective: true,
    apply(st, { d, options, geo, index }) {
      const effect = options.cubeEffect || {};
      st.x = 0;
      st.y = 0;
      st.rotateY = -d * (Number(effect.rotate) || 90);
      st.tz = (geo.sizeOf(index) || geo.viewport) / 2 + (Number(effect.depth) || 0);
      st.visible = abs(d) <= 1.02;
    },
  },

  kenburns: {
    limit: (o) => Math.ceil(Number(o.slidesToShow) || 1) + 2,
    apply() {},
  },

  staggered: {
    limit: (o) => Math.ceil(Number(o.slidesToShow) || 1) + 1,
    apply(st, { d }) {
      // Entering/leaving slides fade quickly; the reveal timeline does the rest.
      st.opacity = clamp(1 - Math.max(0, abs(d) - 0.55) * 2.2, 0, 1);
    },
  },
};

export function getEffect(mode) {
  return EFFECTS[mode] || EFFECTS.slide;
}

/** Build the CSS `transform` string for one slide state. */
export function toTransform(st) {
  let out = `translate3d(${round(st.x)}px, ${round(st.y)}px, ${round(st.z || 0)}px)`;
  if (st.rotateX) out += ` rotateX(${round(st.rotateX)}deg)`;
  if (st.rotateY) out += ` rotateY(${round(st.rotateY)}deg)`;
  if (st.rotateZ) out += ` rotateZ(${round(st.rotateZ)}deg)`;
  if (st.tz) out += ` translateZ(${round(st.tz)}px)`;
  if (st.scale !== 1) out += ` scale(${round(st.scale, 4)})`;
  return out;
}
