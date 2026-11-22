# Contributing

Thanks for taking the time to improve anime-carousel. This project is a small, dependency-light
ESM library, and the bar for changes is "keep it boring and verifiable".

## Setup

```bash
git clone https://github.com/akhtar1985/anime-carousel.git
cd anime-carousel
npm install          # one dev dependency: animejs
npm run dev          # static server; prints the port it bound
```

There is no build step. `src/` is the distributable; `index.html`, `settings.html` and `docs/` are
static pages served from the repository root.

## Before you open a pull request

```bash
npm run check    # import audit, option docs, data-* mapping, META drift
npm test         # state machine, effect geometry, check-script self-tests
```

Both must pass. CI runs the same two commands.

For visual changes, also open the demo in a browser and exercise the affected mode — the static
checks cannot see layout bugs.

## Ground rules

- **ESM only, no runtime dependencies.** The single peer dependency is `animejs@^4`.
- **Anime.js v4 API only.** Use `animate`, `createTimeline`, `stagger`, `createSpring`, `utils`.
  Never `anime({ ... })`, an `easing:` key or `direction: 'alternate'`.
- **Namespace everything.** DOM classes are `ajc__*`, state classes `is-*`, custom properties
  `--ajc-*`, events `ajc:*`.
- **Options change in one place.** A new or renamed option needs, in the same PR:
  `src/defaults.js` (value + data-attribute behaviour), the README options table, `demo/settings.js`
  META, `types/index.d.ts`, and a test if it affects layout.
- **New modes are descriptors, not features.** Add the projection to `EFFECTS` in `src/layout.js`
  plus a `MODES` entry; keep per-frame work allocation-free.
- **`destroy()` stays complete.** Anything you listen to, create, clone or inline must be removed
  again.

## Commit style

Conventional, scoped, lowercase:

```
feat(effects): helix rise per slide
fix(autoplay): restart the timer after drag settle
docs: clarify lazy progressive mode
test: cover wheel painted count
chore(ci): install dev dependency before tests
```

## Reporting a bug

Use the issue templates. Include the mode, the options object (or a minimal repro page), the browser
and the `animejs` version. A link to a failing CodePen or a paste of a minimal HTML file is worth
more than a paragraph.
