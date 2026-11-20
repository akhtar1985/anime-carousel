# anime-carousel

**A slider & carousel plugin built on [Anime.js v4](https://animejs.com/documentation).**
Slick's ergonomics, Swiper's range: nine modes, virtual infinite loop, controller sync, drag, autoplay,
lazy loading, responsive breakpoints and a fully accessible DOM — in ~2,900 lines of readable, commented ESM with no build step.

![Anime.js v4](https://img.shields.io/badge/Anime.js-v4-ff3b7f?style=flat-square)
![No build step](https://img.shields.io/badge/build-none-3fb950?style=flat-square)
![ESM](https://img.shields.io/badge/modules-ESM-7d9bff?style=flat-square)
![License MIT](https://img.shields.io/badge/license-MIT-98a1b2?style=flat-square)
![Accessible](https://img.shields.io/badge/a11y-roles%20%2B%20live%20region-9b7dff?style=flat-square)

**[Live demo](https://akhtar1985.github.io/anime-carousel/)** ·
**[Options reference](https://akhtar1985.github.io/anime-carousel/settings.html)** — every option, live.

---

## Why this plugin

- **One fractional `progress` value drives everything.** Every slide is projected through a geometry
  snapshot and written as a GPU transform, so infinite loop is seamless **without clone nodes**, partial
  `slidesToShow` works, and index math never breaks.
- **Anime.js v4, no legacy syntax.** `animate`, `createTimeline`, `createScope`, `stagger`,
  `createSpring` and `utils` — no `anime({...})`, no `easing:` or `direction: 'alternate'`.
- **Slick + Swiper vocabulary.** Both names work: `slidesToShow`/`slidesPerView`,
  `infinite`/`loop`, `dots`/`pagination`, `arrows`/`navigation`, `autoplaySpeed`/`delay`,
  `asNavFor`/`controller`.
- **Real cleanup.** `destroy()` removes listeners, timers, observers, cloned nodes, generated
  navigation, ARIA attributes, inline animation styles, and reverts every Anime.js instance in its `createScope`.

---

## Table of contents

- [Quick start](#quick-start)
- [Markup contract](#markup-contract)
- [Modes](#modes)
- [Options](#options)
  - [Layout](#layout) · [Motion](#motion) · [Autoplay](#autoplay) · [Navigation](#navigation)
  - [Interaction](#interaction) · [Media](#media) · [Responsive & sync](#responsive--sync)
  - [Per-mode effects](#per-mode-effects) · [Accessibility](#accessibility--misc) · [Callbacks](#callbacks)
- [Synchronisation & thumbnails](#synchronisation--thumbnails)
- [Methods](#methods)
- [Events](#events)
- [Data attributes](#data-attributes)
- [Accessibility](#accessibility)
- [Performance](#performance)
- [Folder structure](#folder-structure)
- [Browser support](#browser-support)

---

## Quick start

### ESM from a CDN (no build step, no bundler)

> These URLs track the `main` branch. Pin a tag or commit instead if you need reproducible builds.

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/akhtar1985/anime-carousel@main/styles/slider.css" />

<script type="importmap">
  { "imports": { "animejs": "https://cdn.jsdelivr.net/npm/animejs@4.5.0/+esm" } }
</script>

<script type="module">
  import { AnimeCarousel } from 'https://cdn.jsdelivr.net/gh/akhtar1985/anime-carousel@main/src/index.js';

  const slider = new AnimeCarousel('#hero', {
    mode: 'coverflow',
    slidesToShow: 1.6,
    centerMode: true,
    infinite: true,
    autoplay: true,
    dots: true,
  });
</script>
```

> The import map is required because the plugin imports the bare specifier `animejs`.
> `https://cdn.jsdelivr.net/npm/animejs@4/+esm` or `https://esm.sh/animejs` both work.

### NPM

```bash
npm install anime-carousel animejs
```

```js
import { AnimeCarousel } from 'anime-carousel';
import 'anime-carousel/styles';
```

`animejs@^4` is a peer dependency — install it alongside, so your app controls the version.

### Script tag without a bundler (local files)

```html
<link rel="stylesheet" href="./styles/slider.css" />
<script type="importmap">{ "imports": { "animejs": "https://cdn.jsdelivr.net/npm/animejs@4/+esm" } }</script>
<script type="module">
  import { AnimeCarousel } from './src/index.js';
  new AnimeCarousel('#hero', { mode: 'fade', infinite: true });
</script>
```

### Run the demo

The repository root **is** the demo — pure static files:

```bash
npx serve .          # or: python -m http.server
# → http://localhost:3000
```

`index.html` exercises every mode, two-way sync, lazy loading, responsive breakpoints, live option
controls and the whole public API.

---

## Markup contract

Minimum markup — the plugin wraps everything for you:

```html
<div id="hero">
  <div><img src="1.jpg" alt="" /></div>
  <div><img src="2.jpg" alt="" /></div>
  <div><img src="3.jpg" alt="" /></div>
</div>
```

Explicit markup (recommended — keeps your own nav outside the track):

```html
<div class="ajc" id="hero" data-ajc>
  <div class="ajc__viewport" data-ajc-viewport>
    <div class="ajc__track" data-ajc-track>
      <div class="ajc__slide">…</div>
      <div class="ajc__slide">…</div>
    </div>
  </div>
  <!-- arrows / dots are appended here automatically -->
</div>
```

Rules:

- Slides are the **direct children of the track**.
- `.ajc__viewport` clips and receives the drag gestures; `.ajc__track` is the positioning context.
- Slides are absolutely positioned by the plugin. Give them an intrinsic size
  (`aspect-ratio`, fixed height, or an image with dimensions) so the viewport can size itself.
  If the viewport's computed height is `0`, the plugin sets it to the tallest slide — and keeps it
  in sync when `refresh()` runs.
- For vertical mode, give the viewport a height in CSS (`height: 420px`).

---

## Modes

`mode` (alias `effect`). Switch at runtime with `setMode()`.

| Mode | What it does | Effect object |
| --- | --- | --- |
| `slide` | Horizontal/vertical track movement. `spring: true` adds `createSpring()` physics. | — |
| `fade` | Crossfade with optional scale/blur; all slides share the centre. | `fadeEffect` |
| `coverflow` | 3D `rotateY` + `translateZ` + scale perspective stack. | `coverflowEffect` |
| `cards` | Stacked card deck with rotation and offset; deals out on navigation. | `cardsEffect` |
| `marquee` | Continuous ticker. Clone strip + one looping `createTimeline()`. Pause on hover/focus. | `marquee` |
| `kenburns` | Slide layout plus a slow pan/zoom timeline on the active media. | `kenBurns` |
| `staggered` | Slide layout plus `createTimeline()` + `stagger()` reveal of `data-ajc-reveal` children. | `staggerEffect` |
| `flip` | 3D flip on the `Y` axis with depth and fade. | `flipEffect` |
| `cube` | True cube rotation: faces are `translateZ(size/2)` after the rotation, `backface-visibility: hidden`. | `cubeEffect` |

```js
slider.setMode('cards', { cardsEffect: { offsetX: 28, rotateZ: 4 } });
```

`marquee` owns the axis: drag, autoplay and pagination are disabled for it by design.

---

## Options

Defaults shown. Pass them to the constructor, via `data-*`, or at runtime with `setMode()` / `setOption()`.

### Layout

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `mode` | `string` | `'slide'` | One of the nine modes above. Alias: `effect`. |
| `initialSlide` | `number` | `0` | Starting index. Alias: `startIndex`. |
| `slidesToShow` | `number \| 'auto'` | `1` | Slides per view; fractions allowed (`1.25`). `'auto'` measures each slide. Alias: `slidesPerView`. |
| `slidesToScroll` | `number` | `1` | Step for `next()`/`prev()` and pagination pages. |
| `spaceBetween` | `number` | `0` | Gap in px. Also exposed as `--ajc-gap`. |
| `infinite` | `boolean` | `false` | Seamless wrap with no clones and no broken indices. Alias: `loop`. |
| `centerMode` | `boolean` | `false` | Centre the active slide; neighbours peek. Alias: `centeredSlides`. |
| `centerPadding` | `string \| number` | `'0px'` | Inset applied in centre mode (`px` or `%`). |
| `vertical` | `boolean` | `false` | Vertical axis (needs a viewport height). |
| `verticalSwiping` | `boolean` | `false` | Drag along the vertical axis. |
| `rtl` | `boolean` | `false` | Mirrors layout and drag direction. |
| `adaptiveHeight` | `boolean` | `false` | Animate the viewport height to the active slide. |
| `watchOverflow` | `boolean` | `true` | Hide arrows and disable nav when everything fits. |

### Motion

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `speed` | `number` | `600` | Transition duration in ms (`0` = instant). |
| `easing` | `string` | `'outCubic'` | Anime.js v4 ease (`'out(3)'`, `'inOutQuad'`, `'outBack'`, `'cubicBezier(…)'`). |
| `spring` | `boolean` | `false` | Use `createSpring()` instead of the easing curve. |
| `springConfig` | `object` | `{ stiffness: 110, damping: 16, mass: 1, velocity: 0 }` | Passed to `createSpring()`. |
| `reducedMotion` | `'respect' \| 'ignore'` | `'respect'` | `'respect'` makes every transition instant and pauses decorative effects when `prefers-reduced-motion: reduce` is set. |
| `perspective` | `number` | `1200` | 3D perspective for `coverflow`, `cards`, `flip`, `cube`. |

### Autoplay

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `autoplay` | `boolean \| object` | `false` | `{ delay, pauseOnMouseEnter, disableOnInteraction }` is also accepted. |
| `autoplaySpeed` | `number` | `3200` | Delay in ms. Alias: `delay`. |
| `pauseOnHover` | `boolean` | `true` | Pause while the pointer is over the slider. |
| `pauseOnFocus` | `boolean` | `true` | Pause while focus is inside. |
| `pauseOnDotsHover` | `boolean` | `false` | Pause over the pagination. |
| `pauseOnInteraction` | `boolean` | `true` | Drag/wheel/keyboard stops autoplay until `play()`. |
| `stopOnLastSlide` | `boolean` | `false` | Stop at the last slide (non-loop). |

### Navigation

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `arrows` | `boolean` | `true` | Render prev/next buttons. Alias: `navigation`. |
| `prevArrow` / `nextArrow` | `string \| Element` | `null` | HTML string, selector or element used as the arrow. |
| `hideOnEdges` | `boolean` | `false` | Fade arrows out at the first/last slide when not looping. |
| `dots` | `boolean \| object` | `false` | `{ type, dynamicBullets, clickable }` also accepted. Alias: `pagination`. |
| `dotsType` | `'bullets' \| 'fraction' \| 'progress'` | `'bullets'` | `1 / 8`, progress bar, or bullets. |
| `dynamicBullets` | `boolean` | `false` | Highlights near/far bullets (`is-near` / `is-far`). |
| `customPaging` | `(page, dot) => string` | `null` | Custom bullet inner HTML. |
| `dotsPerPage` | `boolean` | `true` | One bullet per `slidesToScroll` page (Slick) instead of per slide. |
| `paginationClickable` | `boolean` | `true` | Bullets navigate. |

### Interaction

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `draggable` | `boolean` | `true` | Pointer/touch dragging. Aliases: `swipe`, `touchMove`. |
| `swipeToSlide` | `boolean` | `false` | Snap to the nearest slide instead of stepping. |
| `touchThreshold` | `number` | `5` | px before a gesture counts as a drag. |
| `dragThreshold` | `number` | `0.18` | Fraction of a slide that triggers a change. |
| `dragResistance` | `number` | `0.35` | Resistance past the first/last slide. |
| `mousewheel` | `boolean` | `false` | Wheel navigation with a cooldown. |
| `keyboard` | `boolean` | `true` | Arrow keys, `Home`, `End` when the viewport is focused. |
| `focusable` | `boolean` | `true` | Makes the viewport tabbable. |
| `focusOnSelect` | `boolean` | `false` | Clicking a slide navigates to it. |
| `syncClick` | `boolean` | `false` | Clicking a slide also drives every synced slider. |
| `emitEvents` | `boolean` | `true` | Dispatch `ajc:*` DOM `CustomEvent`s. |

### Media

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `lazyLoad` | `false \| 'ondemand' \| 'progressive'` | `false` | `'ondemand'` loads the visible window + 1; `'progressive'` loads in idle slices. |
| `lazyLoadSelector` | `string` | `'img[data-src], source[data-srcset]'` | Elements to upgrade. |

Lazy loading swaps `data-src` → `src`, `data-srcset` → `srcset` (including `<picture><source>`),
supports `data-background`, and toggles `is-lazy-loading` / `is-lazy-loaded`.

### Responsive & sync

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `responsive` | `array \| object` | `null` | Slick array (max-width) **or** Swiper map (min-width). Alias: `breakpoints`. |
| `breakpointsBase` | `'window' \| 'container'` | `'window'` | Measure the window or the viewport. |
| `asNavFor` | `string \| Element \| instance \| array` | `null` | Bidirectional sync. Alias: `controller`. |

```js
// Slick style — applies at and below each breakpoint
responsive: [
  { breakpoint: 1024, settings: { slidesToShow: 2 } },
  { breakpoint: 640, settings: { slidesToShow: 1, arrows: false } },
]

// Swiper style — applies at and above each key
responsive: { 640: { slidesToShow: 2 }, 1024: { slidesToShow: 3 } }
```

### Per-mode effects

```js
fadeEffect:       { crossFade: true, scale: 0, blur: 0 },
coverflowEffect:  { rotate: 42, depth: 180, scale: 0.86, stretch: 0, modifier: 1, opacity: 1 },
cardsEffect:      { offsetX: 26, offsetY: 10, rotate: 3.5, scale: 0.92, maxStack: 3, opacity: 0.45 },
flipEffect:       { rotate: 90, depth: 120, opacity: 0.25 },
cubeEffect:       { rotate: 90, depth: 0, shadow: true },
kenBurns:         { targets: 'img', from: 1, to: 1.14, duration: 9000, alternate: true, panX: 0, panY: 0 },
staggerEffect:    { targets: null, each: 65, duration: 720, distance: 26, outDuration: 220, ease: 'out(3)', from: 'start' },
marquee:          { speed: 60, direction: 'normal', pauseOnHover: true, duplicated: true },
```

`staggerEffect.targets` defaults to `[data-ajc-reveal]` elements, then common media/heading/copy
children. `marquee.speed` is **px per second**.

### Accessibility & misc

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `a11y` | `boolean` | `true` | Roles, labels, `aria-hidden`, `inert` on off-screen slides. |
| `announce` | `boolean` | `true` | Polite live region announcing “Slide 3 of 8”. |
| `ariaLabels` | `object` | `{ region, prev, next, dots, slide }` | Labels; `slide` is `(index, total) => string`. |

### Callbacks

`onInit`, `onBeforeChange`, `onSlideChange`, `onAfterChange`, `onTransitionEnd`, `onBreakpoint`,
`onDestroy`, `onDragStart`, `onDragMove`, `onDragEnd`, `onAutoplayStart`, `onAutoplayStop`,
`onReachStart`, `onReachEnd`.

```js
new AnimeCarousel('#hero', {
  onBeforeChange: ({ previousIndex, index }) => console.log('leaving', previousIndex, 'for', index),
  onAfterChange: ({ index, total }) => console.log(`${index + 1}/${total}`),
});
```

---

## Synchronisation & thumbnails

Slick's `asNavFor` and Swiper's controller are the same mechanism here: a link graph where each slider
pushes its index to its partners when a transition settles. Links are bidirectional by default, and
propagation is guarded so it can never loop.

```html
<div class="ajc" id="gallery-main">…</div>
<div class="ajc" id="gallery-thumbs">…</div>
```

```js
const thumbs = new AnimeCarousel('#gallery-thumbs', {
  slidesToShow: 5,
  spaceBetween: 8,
  centerMode: true,
  focusOnSelect: true,   // click a thumb to navigate
  syncClick: true,       // …and drive the main slider
  arrows: false,
  dots: false,
  asNavFor: '#gallery-main',
});

const main = new AnimeCarousel('#gallery-main', {
  dots: true,
  dotsType: 'fraction',
  asNavFor: '#gallery-thumbs',
  onAfterChange: ({ index, total }) => {
    document.querySelector('#status').textContent = `Slide ${index + 1} of ${total}`;
  },
});
```

Link at runtime, and to more than two sliders:

```js
main.sync(thumbs);              // bidirectional
main.sync([thumbs, '#chapter-list'], { bidirectional: false });
```

Different slide counts map proportionally, so a 20-slide main can drive a 6-thumb strip.

---

## Methods

| Method | Returns | Description |
| --- | --- | --- |
| `next()` / `prev()` | `this` | Move by `slidesToScroll`, wrapping when looping. |
| `goTo(index, instant?)` | `this` | Shortest path to `index`. `instant: true` skips animation. |
| `play()` / `pause()` / `toggleAutoplay()` | `this` | Autoplay (or the marquee timeline). |
| `setMode(mode, options?)` | `this` | Switch mode and merge options, then re-measure and re-render. |
| `setOption(key, value)` | `this` | Single-option shortcut. |
| `addSlide(htmlOrEl, index?)` | `HTMLElement` | Append or insert a slide, then refresh. |
| `removeSlide(index)` | `this` | Remove a slide and clamp the position. |
| `refresh()` / `update()` | `this` | Re-measure after DOM/size changes. |
| `sync(target, options?)` | `this` | Link other instances (see above). |
| `destroy()` | `void` | Full teardown (see below). |
| `activeIndex` | `number` | Current (settled) index. |
| `count` | `number` | Number of slides. |
| `looping` | `boolean` | Whether the strip actually wraps right now. |
| `options` | `object` | Live, normalised options. |

### `destroy()` removes

event listeners, ResizeObserver, autoplay timers, idle-callback queues, generated arrows/dots/status
nodes, marquee clones, ARIA attributes, `inert`, inline transforms/opacity/sizes, generated wrapper
elements, and reverts every animation created inside the instance's `createScope()`.

```js
const slider = new AnimeCarousel('#hero');
slider.destroy();
document.querySelector('#hero').__ajcInstance; // undefined
```

---

## Events

Callbacks receive `(detail, instance)`:

```ts
{
  type: string;
  index: number;
  previousIndex: number;
  direction: 'next' | 'prev' | 'none';
  slide: HTMLElement | null;
  slides: HTMLElement[];
  total: number;
  instance: AnimeCarousel;
}
```

DOM custom events (bubbling, cancelable, `detail` identical) are dispatched on the root element when
`emitEvents` is `true`:

| Callback | DOM event |
| --- | --- |
| `onInit` | `ajc:init` |
| `onBeforeChange` | `ajc:before-change` |
| `onSlideChange` | `ajc:change` |
| `onAfterChange` | `ajc:after-change` |
| `onTransitionEnd` | `ajc:transition-end` |
| `onBreakpoint` | `ajc:breakpoint` |
| `onDestroy` | `ajc:destroy` |
| `onDragStart` / `onDragMove` / `onDragEnd` | `ajc:drag-start` / `ajc:drag-move` / `ajc:drag-end` |
| `onAutoplayStart` / `onAutoplayStop` | `ajc:autoplay-start` / `ajc:autoplay-stop` |
| `onReachStart` / `onReachEnd` | `ajc:reach-start` / `ajc:reach-end` |

```js
document.querySelector('#hero').addEventListener('ajc:change', (event) => {
  console.log(event.detail.index);
});
```

Order of a transition: `before` + `change` → (animation) → `after` + `transitionEnd`.

---

## Data attributes

Every option can be set from markup. `data-` + kebab-case of the option name; values are coerced
against the default's type (`"true"`, `"false"`, numbers, JSON for objects/arrays).

```html
<div data-ajc
     data-mode="coverflow"
     data-slides-to-show="3"
     data-space-between="16"
     data-loop="true"
     data-center-mode="true"
     data-autoplay="true"
     data-autoplay-speed="4000"
     data-dots="true"
     data-dots-type="fraction"
     data-draggable="true"
     data-mousewheel="true"
     data-lazy-load="ondemand"
     data-as-nav-for="#thumbs"
     data-responsive='[{"breakpoint":768,"settings":{"slidesToShow":1}}]'>
  …
</div>
```

Accepted aliases: `data-effect`, `data-slides-per-view`, `data-loop`, `data-centered-slides`,
`data-navigation`, `data-pagination`, `data-delay`, `data-swipe`, `data-touch-move`,
`data-start-index`, `data-breakpoints`, `data-controller`.

JSON shorthand on the marker attribute itself:

```html
<div data-ajc='{"mode":"cards","infinite":true,"dots":true}'>…</div>
```

Instantiate everything with:

```js
AnimeCarousel.autoInit();          // every [data-ajc] / .ajc-slider without an instance
AnimeCarousel.create('#hero', {}); // factory alias
```

---

## Accessibility

- Root: `role="region"` + `aria-roledescription="carousel"` + `aria-label`.
- Viewport: `role="group"`, tabbable when `focusable`, `aria-label`.
- Slides: `role="group"`, `aria-roledescription="slide"`, `aria-label="3 of 8"`.
- Off-screen slides get `aria-hidden="true"`, `inert` and `tabindex="-1"`, so focus and assistive
  technology never land on invisible content.
- Arrows are real `<button>`s with labels and `disabled` at the edges; bullets are `role="tab"` with
  `aria-selected` and roving `tabindex`.
- A visually hidden `role="status"` live region announces the current slide (`announce`).
- Keyboard: <kbd>←</kbd> <kbd>→</kbd> (or <kbd>↑</kbd> <kbd>↓</kbd> vertical), <kbd>Home</kbd>, <kbd>End</kbd>;
  RTL-aware. Autoplay pauses on hover and focus.
- `prefers-reduced-motion: reduce` makes transitions instant, disables autoplay-driven motion and
  freezes the marquee unless `reducedMotion: 'ignore'` is set.
- Visible focus rings ship in the stylesheet; content is never hidden from the accessibility tree
  while animation runs.

---

## Performance

- Only `transform` and `opacity` are animated (composited, GPU-friendly), plus `filter` for the
  optional fade blur.
- Slides outside the mode's paint window are `visibility: hidden` and skipped for transform writes.
- Transforms are compared before writing (`_lastTransform`), so idle frames do no layout work.
- Measurement happens on `init`, `refresh()`, and resize — never per frame.
- Infinite loop uses modular index math instead of DOM clones; only `marquee` duplicates (and cleans up).

---

## Folder structure

```
anime-carousel/
├── index.html              # interactive all-modes demo (ESM CDN, no build)
├── src/
│   ├── index.js            # public entry: exports, create(), autoInit()
│   ├── slider.js           # core engine, state machine, public API, lifecycle
│   ├── layout.js           # geometry maths + per-mode style states
│   ├── defaults.js         # default options, aliases, data-attribute parsing
│   ├── navigation.js       # arrows, bullets / fraction / progress
│   ├── autoplay.js         # timers, pause rules, stopOnLastSlide
│   ├── drag.js             # pointer/touch drag, momentum, resistance
│   ├── marquee.js          # cloned ticker + looping timeline
│   ├── lazy.js             # ondemand / progressive loaders
│   ├── responsive.js       # Slick array + Swiper map breakpoints
│   ├── sync.js             # asNavFor / controller link graph
│   ├── a11y.js             # roles, labels, live region, inert
│   └── utils.js            # DOM/geometry helpers
├── styles/
│   ├── slider.css          # core stylesheet (CSS custom properties)
│   └── slider.scss         # same, as SCSS with variables
├── types/index.d.ts        # TypeScript declarations
├── demo/
│   ├── demo.js             # demo bootstrap + live controls
│   ├── demo.css            # demo-only styling
│   └── img/                # local sample images
├── scripts/check.js        # import/export audit + legacy-API lint
├── package.json
└── README.md
```

### Styling

Everything is driven by custom properties:

```css
.ajc {
  --ajc-accent: #7d9bff;
  --ajc-arrow-size: 48px;
  --ajc-arrow-bg: rgba(0, 0, 0, 0.7);
  --ajc-arrow-color: #fff;
  --ajc-dot-size: 10px;
  --ajc-radius: 18px;
  --ajc-perspective: 1600px;
}
```

Override `.ajc__arrow`, `.ajc__dot`, `.ajc__dots--fraction`, `.ajc__progress*` for deeper theming.
Core layout rules are nested one level (`.ajc .ajc__slide`) so an author class like
`.my-slide { position: relative }` cannot break positioning.

---

## TypeScript

`types/index.d.ts` ships with the package: `AnimeCarouselOptions`, `CarouselDetail`, `Mode`,
effect interfaces and full method signatures.

```ts
import AnimeCarousel, { type AnimeCarouselOptions } from 'anime-carousel';

const options: AnimeCarouselOptions = { mode: 'cube', infinite: true, dots: true };
const slider = new AnimeCarousel('#hero', options);
```

---

## Browser support

Chromium 111+, Firefox 113+, Safari 16.4+ — anything with ES modules, `ResizeObserver`,
`inert` (with a graceful no-op fallback) and CSS 3D transforms. The plugin itself needs only
`animejs@^4`; there are no other runtime dependencies.

---

## Contributing

```bash
node scripts/check.js    # import/export audit + "no legacy Anime.js v3" lint
npx serve .              # run the demo
```

Keep the source ESM, no build step, and no v3 Anime.js syntax (`anime({...})`, `easing:`,
`direction: 'alternate'`).

## License

[MIT](./LICENSE)
