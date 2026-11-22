# anime-carousel documentation

Live site: **<https://akhtar1985.github.io/anime-carousel/>**

The documentation pages are HTML, so they render the same on GitHub Pages and from a local
checkout — no markdown pipeline, no CDN, no webfonts:

| Page | What it answers |
| --- | --- |
| [Start here](./index.html) | The two-minute tour: features, compatibility, where to go next. |
| [How it compares](./comparison.html) | Feature matrix vs Swiper, Slick, Splide, Embla, Glide and Flickity; who it is (and is not) for; migration notes. |
| [The 13 modes, in depth](./modes.html) | What each mode does, every effect option with defaults, tuning and gotchas. |
| [Recipes](./recipes.html) | Complete HTML + JS: coverflow hero, synced gallery, vertical feed, ticker, fade hero, lazy gallery, framework mounting. |
| [Options reference](https://akhtar1985.github.io/anime-carousel/settings.html) | All 80 option rows rendered from `src/defaults.js`, with a live preview and config generator. |
| [Interactive demo](https://akhtar1985.github.io/anime-carousel/) | Every mode, studio controls, sync, lazy loading, responsive. |
| [Main README](../README.md) | Install, markup contract, full option tables, methods, events, a11y and browser support. |

---

## The short version

anime-carousel is a **vanilla-ESM carousel engine built on Anime.js v4**, for teams that want
Slick's ease, Swiper-calibre depth effects, and no build step:

- **13 animated layout modes** — slide, fade, coverflow, cards, wheel, helix, flip, fold, cube, zoom,
  marquee, kenburns, staggered.
- **Effect studios** — coverflow, wheel and helix each expose layout knobs (`offset`, `depth`,
  `tilt`, `blur`, `visible`, plus `lift` for coverflow) that reshape neighbours without touching the
  active slide.
- **Virtual infinite loop** — modular index maths instead of clone nodes, so `activeIndex`, events
  and `aria-label` stay logical at the wrap point.
- **One option vocabulary for two ecosystems** — Slick and Swiper names both work
  (`slidesToShow`/`slidesPerView`, `infinite`/`loop`, `dots`/`pagination`, `asNavFor`/`controller`).
- **Runtime `setMode()`** — change from `slide` to `helix` without destroying the instance.
- **Accessible by default** — roles, `aria-hidden`, `inert`, live-region announcements, keyboard
  navigation and `prefers-reduced-motion` support.
- **No build step** — the `src/` ESM files are the distributable. Load them from npm, a CDN, or a
  plain `<script type="module">`.

The only runtime dependency is `animejs@^4`.

---

## Compatibility at a glance

| Item | Value |
| --- | --- |
| Module format | ESM (`src/index.js`), no bundler required |
| Runtime dependency | `animejs@^4` (peer) |
| Styles | `styles/slider.css` (or `styles/slider.scss`) |
| Types | `types/index.d.ts` included |
| Browsers | Chromium 111+, Firefox 113+, Safari 16.4+ |
| License | MIT |

If your site can load an import map and modern ES modules, it can run this plugin — static pages,
Shopify themes, WordPress embeds, React/Vue/Svelte apps, Electron shells.

---

## Contributing to the docs

The HTML pages share `docs.css` and must stay dependency-free — system fonts only, no remote
scripts — so they work offline and under any static host. The demo is the source of truth for
examples: [index.html](../index.html) exercises every mode, [demo/demo.js](../demo/demo.js) shows
the studio wiring, and [settings.html](../settings.html) renders the option reference from source.
Keep the comparison page honest — if a competitor gains or loses a capability, update the note and
the "as of" date.
