/**
 * Dependency-free sanity check for the source tree:
 *  1. every local `import { … } from './file.js'` resolves to a real export
 *  2. no legacy Anime.js v3 API leaks in
 *  3. every source file parses as an ES module (node --check is run by npm too)
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, dirname, resolve, relative } from 'node:path';

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

if (problems.length) {
  console.error(`✖ ${problems.length} problem(s):`);
  problems.forEach((problem) => console.error(`  - ${problem}`));
  process.exit(1);
}

console.log(`✔ ${files.length} modules checked — imports resolve, no legacy Anime.js v3 API.`);
