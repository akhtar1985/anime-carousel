/**
 * Tests for `scripts/check.js`.
 *
 * The audit is the only thing guarding the demo data attributes and the README
 * against the source, so it has to prove it still fails when something drifts.
 * Each case copies the tree into a temp directory, breaks exactly one thing and
 * asserts the check exits 1 with the message naming that breakage. Every
 * mutation asserts its target text exists first, so a reworded README or a
 * refactored src/ file fails here instead of quietly weakening the guard.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// Everything check.js reads. `demo/img` holds only images, so skip the copy.
const COPIED = ['src', 'demo', 'scripts', 'types', 'README.md', 'index.html', 'settings.html', 'package.json'];

function applyMutation(directory, { file, find, pattern, append, replace }) {
  const path = join(directory, file);
  const before = readFileSync(path, 'utf8');
  let after;

  if (append !== undefined) {
    after = before + append;
  } else if (pattern) {
    const probe = new RegExp(pattern.source, pattern.flags);
    assert.ok(probe.test(before), `${file} no longer matches ${pattern} — update this test`);
    after = before.replace(new RegExp(pattern.source, pattern.flags), replace);
  } else {
    assert.ok(before.includes(find), `${file} no longer contains ${JSON.stringify(find)} — update this test`);
    after = before.replace(find, replace);
  }

  assert.notEqual(after, before, `${file}: the mutation did not change anything`);
  writeFileSync(path, after);
}

/** Run the check on a fresh copy of the tree with `mutations` applied. */
function runCheck(mutations = []) {
  const directory = mkdtempSync(join(tmpdir(), 'ajc-check-'));
  try {
    for (const entry of COPIED) {
      cpSync(join(root, entry), join(directory, entry), {
        recursive: true,
        // Only demo/*.js is read by the check; its images would just add noise.
        filter: (source) => !source.endsWith(join('demo', 'img')),
      });
    }
    for (const mutation of mutations) applyMutation(directory, mutation);

    const result = spawnSync(process.execPath, ['scripts/check.js'], {
      cwd: directory,
      encoding: 'utf8',
    });
    return { status: result.status, output: `${result.stdout}${result.stderr}` };
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

function expectFailure(mutations, expected) {
  const { status, output } = runCheck(mutations);
  assert.equal(status, 1, `expected exit 1, got ${status}:\n${output}`);
  assert.ok(
    output.includes(expected),
    `expected the check to report:\n  ${expected}\n\nactual output:\n${output}`,
  );
}

test('passes on the unmodified tree', () => {
  const { status, output } = runCheck();
  assert.equal(status, 0, `expected exit 0, got ${status}:\n${output}`);
  assert.match(output, /no option is undocumented/);
});

test('fails on a legacy anime() call', () => {
  expectFailure(
    [{ file: join('src', 'marquee.js'), append: '\nanime({ targets: [] });\n' }],
    'legacy anime() call',
  );
});

test('fails on an import that no module exports', () => {
  expectFailure(
    [{ file: join('src', 'slider.js'), append: "\nimport { notARealExport } from './defaults.js';\n" }],
    'does not export "notARealExport"',
  );
});

test('fails on a data-* attribute that names no option', () => {
  expectFailure(
    [{ file: join('demo', 'demo.js'), append: '\n// <div data-ajc-vanished="1"></div>\n' }],
    'data-ajc-vanished is not an option in src/defaults.js',
  );
});

test('fails on an unknown key inside a data-ajc payload', () => {
  expectFailure(
    [{ file: join('demo', 'demo.js'), append: `\n// <div data-ajc='{"vanished":1}'></div>\n` }],
    'data-ajc key "vanished" is not an option in src/defaults.js',
  );
});

test('fails when a README default drifts from the source', () => {
  expectFailure(
    [
      {
        file: 'README.md',
        find: '| `speed` | `number` | `600` |',
        replace: '| `speed` | `number` | `700` |',
      },
    ],
    '"speed" default is documented as 700 but src/defaults.js has 600',
  );
});

test('fails when the README documents an option that no longer exists', () => {
  expectFailure(
    [
      {
        file: 'README.md',
        find: '| `speed` | `number` | `600` | Transition duration in ms (`0` = instant). |',
        replace:
          '| `speed` | `number` | `600` | Transition duration in ms (`0` = instant). |\n| `vanished` | `number` | `1` | Removed option. |',
      },
    ],
    'documents "vanished", which is not an option in src/defaults.js',
  );
});

test('fails when an option loses its only documentation', () => {
  expectFailure(
    [
      {
        file: 'README.md',
        find: "| `mode` | `string` | `'slide'` | One of the thirteen modes above. Alias: `effect`. |",
        replace: '',
      },
    ],
    'declares "mode" but no README options table documents it',
  );
});

test('fails when a per-mode effect value drifts', () => {
  expectFailure(
    [{ file: 'README.md', pattern: /coverflowEffect:(\s*)\{ rotate: 42/, replace: 'coverflowEffect:$1{ rotate: 43' }],
    '"coverflowEffect.rotate" is documented as 43 but src/defaults.js has 42',
  );
});

test('fails when a per-mode effect disappears from the block', () => {
  expectFailure(
    [{ file: 'README.md', pattern: /^\s*marquee:\s*\{[^}]*\},\n/m, replace: '' }],
    'per-mode block does not document "marquee" — allowlist expects it there',
  );
});

test('fails when the stagger fallback prose stops matching src/slider.js', () => {
  expectFailure(
    [{ file: join('src', 'slider.js'), pattern: /\[data-ajc-reveal\]/g, replace: '[data-ajc-mark]' }],
    'no longer tries [data-ajc-reveal] first',
  );
});

test('fails when settings META describes an option that no longer exists', () => {
  expectFailure(
    [
      {
        file: join('demo', 'settings.js'),
        find: "syncClick: S('Clicking a slide also drives the synced sliders.'),",
        replace: "classPrefix: S('Clicking a slide also drives the synced sliders.'),",
      },
    ],
    'META describes "classPrefix", which is not an option in src/defaults.js',
  );
});

test('fails when an option has no settings descriptor', () => {
  expectFailure(
    [
      {
        file: join('src', 'defaults.js'),
        find: '  syncClick: false,',
        replace: '  syncClick: false,\n  legacyThing: true,',
      },
    ],
    'declares "legacyThing" but demo/settings.js META has no descriptor for it',
  );
});

test('fails when marquee duration stops being px per second', () => {
  expectFailure(
    [{ file: join('src', 'marquee.js'), pattern: /this\.speed\)\) \* 1000/, replace: 'this.speed)) * 60' }],
    'needs distance / speed * 1000',
  );
});
