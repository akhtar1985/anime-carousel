## What changed

<!-- One or two sentences. Link the issue if there is one. -->

## How it was verified

- [ ] `npm run check` passes
- [ ] `npm test` passes
- [ ] Exercised in a browser (mode, viewport, drag/keyboard) — describe:

## Checklist

- [ ] No new runtime dependencies (peer stays `animejs@^4`)
- [ ] Anime.js v4 API only (no `anime({ ... })`)
- [ ] Option changes update `src/defaults.js`, README tables, `demo/settings.js` META and
      `types/index.d.ts`
- [ ] DOM/events follow the `ajc` namespace
- [ ] `destroy()` still removes everything the change creates
- [ ] Docs touch-up in `docs/` where behaviour or defaults changed
