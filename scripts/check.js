/**
 * Dependency-free sanity check for the source tree:
 *  1. every local `import { … } from './file.js'` resolves to a real export
 *  2. no legacy Anime.js v3 API leaks in
 *  3. every source file parses as an ES module (node --check is run by npm too)
 *  4. every data-* attribute in the demo pages/scripts still names a real option
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, dirname, resolve, relative } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = resolve(process.cwd());
const problems = [];
const files = [];

function walk(directory) {
  for (const entry of readdirSync(directory)) {
    const full = join(directory, entry);
    if (statSync(full).isDirectory()) walk(full);
    else if (full.endsWith('.js')) files.push(full);
  }
}

walk(join(root, 'src'));

const exportsOf = new Map();

function collectExports(file, source) {
  const names = new Set();
  const declaration = /\bexport\s+(?:async\s+)?(?:function|class|const|let|var)\s+([A-Za-z0-9_$]+)/g;
  let match;
  while ((match = declaration.exec(source))) names.add(match[1]);

  const list = /\bexport\s*\{([^}]+)\}/g;
  while ((match = list.exec(source))) {
    match[1]
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean)
      .forEach((part) => {
        const alias = part.split(/\s+as\s+/);
        names.add((alias[1] || alias[0]).trim());
      });
  }
  if (/\bexport\s+default\b/.test(source)) names.add('default');
  exportsOf.set(file, names);
}

for (const file of files) collectExports(file, readFileSync(file, 'utf8'));

for (const file of files) {
  const source = readFileSync(file, 'utf8');
  const label = relative(root, file);

  for (const [index, line] of source.split('\n').entries()) {
    if (/\banime\s*\(/.test(line)) problems.push(`${label}:${index + 1} legacy anime() call`);
    // `easing` is our public option name, but Anime.js must receive `ease`:
    if (/animate\([^)]*\beasing\s*:/.test(line) || /createTimeline\([^)]*\beasing\s*:/.test(line)) {
      problems.push(`${label}:${index + 1} legacy "easing" passed to Anime.js (use "ease")`);
    }
    if (/direction\s*:\s*['"]alternate/.test(line)) problems.push(`${label}:${index + 1} legacy alternate direction`);
  }

  const importPattern = /import\s+(?:([A-Za-z0-9_$]+)\s*,?\s*)?(?:\{([^}]*)\})?\s*from\s*['"]([^'"]+)['"]/g;
  let match;
  while ((match = importPattern.exec(source))) {
    const [, defaultName, named, specifier] = match;
    if (!specifier.startsWith('.')) continue;
    const target = resolve(dirname(file), specifier);
    if (!exportsOf.has(target)) {
      problems.push(`${label}: cannot resolve "${specifier}"`);
      continue;
    }
    const available = exportsOf.get(target);
    if (defaultName && !available.has('default')) {
      problems.push(`${label}: "${specifier}" has no default export`);
    }
    if (named) {
      named
        .split(',')
        .map((part) => part.trim())
        .filter(Boolean)
        .forEach((part) => {
          const imported = part.split(/\s+as\s+/)[0].trim();
          if (!available.has(imported)) {
            problems.push(`${label}: "${specifier}" does not export "${imported}"`);
          }
        });
    }
  }
}

/*
 * 4. Demo data-* attributes must still name a real option.
 *
 * `readDataAttributes()` silently drops any data attribute whose key is not in
 * DEFAULT_OPTIONS, so a renamed or deleted option leaves the demo pages quietly
 * doing nothing. Resolve every attribute the demo markup/scripts mention the
 * same way the runtime does (kebab → camel → alias) and fail on strays.
 */
const { DEFAULT_OPTIONS, ALIASES, DATA_ALIASES } = await import(
  pathToFileURL(join(root, 'src', 'defaults.js')).href,
);

// Never readable from attributes, so a data-* form of these is always a mistake.
const PRIVATE_KEYS = new Set(['classes', 'ariaLabels', 'onInit']);

// Demo hooks and plugin-internal markers that are deliberately not options.
const NON_OPTION_ATTRIBUTES = new Set([
  'ajc',
  'ajc-reveal',
  'ajc-track',
  'ajc-viewport',
  'ajc-index',
  'ajc-page',
  'ajc-lazy-scanned',
  'src',
  'srcset',
  'background',
  'api',
  'copy',
  'copy-config',
  'copy-group',
  'copy-install',
  'group',
  'mini',
  'mode-try',
  'opt',
  'out',
  'search',
]);

const kebab = (key) => key.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
const optionAttributes = new Set(Object.keys(DEFAULT_OPTIONS).filter((key) => !PRIVATE_KEYS.has(key)).map(kebab));
for (const key of Object.keys(DATA_ALIASES)) optionAttributes.add(kebab(key));

const demoFiles = [];
const collectDemoScripts = (directory) => {
  for (const entry of readdirSync(directory)) {
    const full = join(directory, entry);
    if (statSync(full).isDirectory()) collectDemoScripts(full);
    else if (full.endsWith('.js')) demoFiles.push(full);
  }
};
collectDemoScripts(join(root, 'demo'));

// The option attributes themselves live in the pages and the README, not in
// demo/*.js. Only the README's Data attributes section is scanned, so prose
// elsewhere (e.g. "data-attribute parsing") is never mistaken for markup.
for (const page of ['index.html', 'settings.html', 'README.md']) {
  const full = join(root, page);
  try {
    if (statSync(full).isFile()) demoFiles.push(full);
  } catch {
    /* page is optional */
  }
}

/** Blank out everything outside `## heading`, keeping line numbers exact. */
const sliceSection = (text, heading) => {
  const lines = text.split('\n');
  const start = lines.findIndex((line) => line.trim() === heading);
  if (start === -1) return '';
  let end = lines.length;
  for (let index = start + 1; index < lines.length; index += 1) {
    if (/^#{1,2}\s/.test(lines[index])) {
      end = index;
      break;
    }
  }
  return lines.map((line, index) => (index >= start && index < end ? line : '')).join('\n');
};

const attributePattern = /\bdata-([a-z0-9]+(?:-[a-z0-9]+)*)/gi;
const seenAttributes = new Set();

const isPlainObject = (value) =>
  !!value && typeof value === 'object' && !Array.isArray(value);

/**
 * Validate the keys of a `data-ajc='{…}'` payload. Unknown keys survive
 * `normalizeOptions()` as inert extra properties, so they have to be caught
 * here. Nested effect objects are checked against their own defaults.
 */
function validatePayload(payload, label, line, scope = DEFAULT_OPTIONS, prefix = '') {
  let checked = 0;
  for (const [key, value] of Object.entries(payload)) {
    // Aliases are a top-level concern; nested effect keys must match exactly.
    const canonical = scope === DEFAULT_OPTIONS ? ALIASES[key] || key : key;
    if (!(canonical in scope)) {
      problems.push(`${label}:${line} data-ajc key "${prefix}${key}" is not an option in src/defaults.js`);
      continue;
    }
    checked++;
    const fallback = scope[canonical];
    if (isPlainObject(fallback) && isPlainObject(value)) {
      checked += validatePayload(value, label, line, fallback, `${prefix}${key}.`);
    }
  }
  return checked;
}

const ajcPattern = /data-ajc\s*=\s*(['"])([\s\S]*?)\1/gi;
let ajcKeysChecked = 0;

for (const file of demoFiles) {
  const raw = readFileSync(file, 'utf8');
  const source = file.endsWith('.md') ? sliceSection(raw, '## Data attributes') : raw;
  const label = relative(root, file);

  for (const payload of source.matchAll(ajcPattern)) {
    const line = source.slice(0, payload.index).split('\n').length;
    // Template-built payloads are resolved at runtime; nothing static to check.
    if (payload[2].includes('${')) continue;
    let parsed;
    try {
      parsed = JSON.parse(payload[2]);
    } catch {
      problems.push(`${label}:${line} data-ajc payload is not valid JSON`);
      continue;
    }
    if (isPlainObject(parsed)) ajcKeysChecked += validatePayload(parsed, label, line);
  }

  for (const [index, line] of source.split('\n').entries()) {
    for (const match of line.matchAll(attributePattern)) {
      const attribute = match[1].toLowerCase();
      if (NON_OPTION_ATTRIBUTES.has(attribute)) continue;
      seenAttributes.add(attribute);
      if (optionAttributes.has(attribute)) continue;
      problems.push(
        `${label}:${index + 1} data-${attribute} is not an option in src/defaults.js`,
      );
    }
  }
}

/*
 * 5. The README options table must match DEFAULT_OPTIONS.
 *
 * The tables are hand-written prose while settings.html renders the same data
 * from source, so a renamed option or retuned default left the README lying
 * with no signal. Only rows under an `Option | Type | Default | Description`
 * header are checked; the Type column is documentation, not a contract.
 */
const formatValue = (value) =>
  typeof value === 'string' ? `'${value}'` : JSON.stringify(value);

/** Parse a Default cell such as `600`, `'slide'`, `null` or `{ a: 1 }`. */
function parseDocumentedDefault(text) {
  const raw = text.trim();
  if (raw === 'null') return { kind: 'scalar', value: null };
  if (raw === 'true' || raw === 'false') return { kind: 'scalar', value: raw === 'true' };
  if (/^-?\d+(?:\.\d+)?$/.test(raw)) return { kind: 'scalar', value: Number(raw) };
  if (/^'.*'$/.test(raw) || /^".*"$/.test(raw)) return { kind: 'scalar', value: raw.slice(1, -1) };
  if (raw.startsWith('{') && raw.endsWith('}')) {
    const pairs = [];
    const pairPattern = /([A-Za-z0-9_$]+)\s*:\s*(-?\d+(?:\.\d+)?|'(?:[^']*)'|"(?:[^"]*)"|true|false|null)/g;
    for (const pair of raw.slice(1, -1).matchAll(pairPattern)) {
      const inner = parseDocumentedDefault(pair[2]);
      if (inner) pairs.push([pair[1], inner.value]);
    }
    if (pairs.length) return { kind: 'object', pairs };
    // Shorthand key list, e.g. `{ region, prev, next, dots, slide }`.
    const keys = raw
      .slice(1, -1)
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean);
    if (keys.length && keys.every((key) => /^[A-Za-z0-9_$]+$/.test(key))) return { kind: 'keys', keys };
    return null;
  }
  return null;
}

const readmeFile = join(root, 'README.md');
let documentedOptionCount = 0;

try {
  const readmeLines = readFileSync(readmeFile, 'utf8').split('\n');
  const cellsOf = (line) =>
    line
      .trim()
      .replace(/^\|/, '')
      .replace(/\|$/, '')
      .split('|')
      .map((cell) => cell.trim());

  for (let index = 0; index < readmeLines.length; index += 1) {
    if (!/^\s*\|/.test(readmeLines[index])) continue;
    const header = cellsOf(readmeLines[index]);
    if (header.length !== 4 || header[0] !== 'Option' || header[2] !== 'Default') continue;

    let row = index + 2; // skip the | --- | separator
    for (; row < readmeLines.length && /^\s*\|/.test(readmeLines[row]); row += 1) {
      const cells = cellsOf(readmeLines[row]);
      if (cells.length !== 4) continue;
      const lineNumber = row + 1;
      const names = [...cells[0].matchAll(/`([^`]+)`/g)].map((match) => match[1]);
      const documented = parseDocumentedDefault(cells[2].replace(/^`|`$/g, '').trim());
      if (!documented) {
        problems.push(`README.md:${lineNumber} unreadable default for "${cells[0]}" — cannot verify it`);
        continue;
      }

      for (const name of names) {
        const canonical = ALIASES[name] || name;
        if (!(canonical in DEFAULT_OPTIONS)) {
          problems.push(`README.md:${lineNumber} documents "${name}", which is not an option in src/defaults.js`);
          continue;
        }
        documentedOptionCount += 1;
        const actual = DEFAULT_OPTIONS[canonical];

        if (documented.kind === 'keys') {
          if (!isPlainObject(actual)) {
            problems.push(`README.md:${lineNumber} "${name}" is documented as an object but the source default is ${formatValue(actual)}`);
            continue;
          }
          const actualKeys = Object.keys(actual);
          for (const missing of actualKeys.filter((key) => !documented.keys.includes(key))) {
            problems.push(`README.md:${lineNumber} "${name}" does not document "${missing}"`);
          }
          for (const extra of documented.keys.filter((key) => !actualKeys.includes(key))) {
            problems.push(`README.md:${lineNumber} "${name}.${extra}" is not in the source default`);
          }
          continue;
        }

        if (documented.kind === 'object') {
          if (!isPlainObject(actual)) {
            problems.push(`README.md:${lineNumber} "${name}" is documented as an object but the source default is ${formatValue(actual)}`);
            continue;
          }
          const actualKeys = Object.keys(actual);
          const documentedKeys = documented.pairs.map(([key]) => key);
          for (const missing of actualKeys.filter((key) => !documentedKeys.includes(key))) {
            problems.push(`README.md:${lineNumber} "${name}" omits "${missing}" (source default ${formatValue(actual[missing])})`);
          }
          for (const [key, value] of documented.pairs) {
            if (!(key in actual)) {
              problems.push(`README.md:${lineNumber} "${name}.${key}" is not in the source default`);
            } else if (actual[key] !== value) {
              problems.push(
                `README.md:${lineNumber} "${name}.${key}" is documented as ${formatValue(value)} but src/defaults.js has ${formatValue(actual[key])}`,
              );
            }
          }
          continue;
        }

        if (documented.kind === 'scalar' && !(documented.value === actual && typeof documented.value === typeof actual)) {
          problems.push(
            `README.md:${lineNumber} "${name}" default is documented as ${formatValue(documented.value)} but src/defaults.js has ${formatValue(actual)}`,
          );
        }
      }
    }
    index = row;
  }
} catch {
  problems.push('README.md is missing — cannot verify the options table');
}

if (problems.length) {
  console.error(`✖ ${problems.length} problem(s):`);
  problems.forEach((problem) => console.error(`  - ${problem}`));
  process.exit(1);
}

console.log(`✔ ${files.length} modules checked — imports resolve, no legacy Anime.js v3 API.`);
console.log(
  `✔ ${seenAttributes.size} documented data-* attributes and ${ajcKeysChecked} data-ajc keys — every one still maps to an option.`,
);
console.log(`✔ ${documentedOptionCount} documented options — names and defaults match src/defaults.js.`);
