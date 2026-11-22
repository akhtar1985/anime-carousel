/**
 * Projection tests for the visual modes.
 *
 * Every mode is pure geometry: given a signed slide distance `d`, it writes a
 * transform state. A NaN here would be invisible in unit tests of the progress
 * engine but would blank the slide in the browser, so each descriptor is swept
 * through a full transition and every numeric field is checked.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { DEFAULT_OPTIONS, MODES, normalizeOptions } from '../src/defaults.js';
import { EFFECTS, createGeometry, getEffect, toTransform } from '../src/layout.js';

const NUMERIC_KEYS = ['x', 'y', 'z', 'tz', 'rotateX', 'rotateY', 'rotateZ', 'scale', 'opacity', 'zIndex'];

const geometry = createGeometry({
  sizes: [200, 200, 200, 200, 200],
  gap: 10,
  viewport: 600,
  loop: true,
  centerMode: false,
  centerPadding: 0,
  slidesToShow: 1,
});

function baseState() {
  return {
    x: 0,
    y: 0,
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

test('every mode except marquee has an effect descriptor', () => {
  for (const mode of MODES) {
    if (mode === 'marquee') continue;
    assert.ok(EFFECTS[mode], `${mode} has no EFFECTS entry`);
  }
});

test('new visual modes keep every transform finite through a transition', () => {
  for (const mode of ['coverflow', 'wheel', 'helix', 'fold', 'zoom']) {
    const options = normalizeOptions({ mode });
    const effect = getEffect(mode);

    for (const vertical of [false, true]) {
      for (const d of [-2.5, -1, -0.35, 0, 0.35, 1, 2.5]) {
        const state = baseState();
        effect.apply(state, {
          d,
          index: 0,
          options,
          geo: geometry,
          slider: null,
          dir: 1,
          vertical,
          center: { x: 200, y: 150 },
        });

        for (const key of NUMERIC_KEYS) {
          assert.ok(Number.isFinite(state[key]), `${mode} at d=${d}: ${key} is ${state[key]}`);
        }
        assert.ok(!toTransform(state).includes('NaN'), `${mode} at d=${d}: transform is ${toTransform(state)}`);
      }
    }
  }
});

test('coverflow layout knobs project onto the expected neighbour state', () => {
  const options = normalizeOptions({
    mode: 'coverflow',
    coverflowEffect: { rotate: 30, depth: 120, scale: 0.8, offset: 18, tilt: 12, lift: 10, blur: 2, visible: 3 },
  });
  const effect = getEffect('coverflow');
  const state = baseState();
  effect.apply(state, {
    d: 1,
    index: 0,
    options,
    geo: geometry,
    slider: null,
    dir: 1,
    vertical: false,
    center: { x: 200, y: 150 },
  });

  assert.equal(effect.limit(options), 3);
  assert.equal(state.x, 18);
  assert.equal(state.y, -10);
  assert.equal(state.z, -120);
  assert.equal(state.rotateY, -30);
  assert.equal(state.rotateX, 12);
  assert.equal(state.scale, 0.8);
  assert.equal(state.filter, 'blur(2px)');
});

test('wheel and helix layout knobs project onto the expected neighbour state', () => {
  const wheelOptions = normalizeOptions({
    mode: 'wheel',
    wheelEffect: { radius: 200, angle: 30, scale: 0.8, opacity: 0.5, offset: 10, depth: 60, tilt: 12, blur: 1, visible: 3 },
  });
  const wheel = getEffect('wheel');
  const wheelState = baseState();
  wheel.apply(wheelState, {
    d: 1,
    index: 0,
    options: wheelOptions,
    geo: geometry,
    slider: null,
    dir: 1,
    vertical: false,
    center: { x: 200, y: 150 },
  });
  const wheelRise = 200 * (1 - Math.cos(Math.PI / 6));
  assert.equal(wheel.limit(wheelOptions), 3);
  assert.ok(Math.abs(wheelState.x - 310) < 1e-9);
  assert.ok(Math.abs(wheelState.y - (150 + wheelRise)) < 1e-9);
  assert.equal(wheelState.z, -60);
  assert.ok(Math.abs(wheelState.rotateZ - 30) < 1e-9);
  assert.equal(wheelState.rotateX, 12);
  assert.equal(wheelState.scale, 0.8);
  assert.equal(wheelState.opacity, 0.5);
  assert.equal(wheelState.filter, 'blur(1px)');
  assert.equal(wheelState.visible, true);

  const helixOptions = normalizeOptions({
    mode: 'helix',
    helixEffect: { radius: 200, rotate: 30, rise: 40, scale: 0.85, opacity: 0.6, offset: 10, depth: 50, tilt: 6, blur: 2, visible: 3 },
  });
  const helix = getEffect('helix');
  const helixState = baseState();
  helix.apply(helixState, {
    d: 1,
    index: 0,
    options: helixOptions,
    geo: geometry,
    slider: null,
    dir: 1,
    vertical: false,
    center: { x: 200, y: 150 },
  });
  assert.equal(helix.limit(helixOptions), 3);
  assert.ok(Math.abs(helixState.x - 310) < 1e-9);
  assert.equal(helixState.y, 190);
  assert.ok(Math.abs(helixState.z - ((Math.cos(Math.PI / 6) - 1) * 200 - 50)) < 1e-9);
  assert.ok(Math.abs(helixState.rotateY + 30) < 1e-9);
  assert.equal(helixState.rotateX, 6);
  assert.equal(helixState.scale, 0.85);
  assert.equal(helixState.opacity, 0.6);
  assert.equal(helixState.filter, 'blur(2px)');
  assert.equal(helixState.visible, true);
});

test('wheel and helix painted count hides distant slides', () => {
  for (const [mode, effectKey] of [['wheel', 'wheelEffect'], ['helix', 'helixEffect']]) {
    const options = normalizeOptions({ mode, [effectKey]: { opacity: 1, visible: 2 } });
    const effect = getEffect(mode);
    const near = baseState();
    const far = baseState();
    const ctx = { index: 0, options, geo: geometry, slider: null, dir: 1, vertical: false, center: { x: 200, y: 150 } };
    effect.apply(near, { ...ctx, d: 2 });
    effect.apply(far, { ...ctx, d: 5 });
    assert.equal(effect.limit(options), 2);
    assert.equal(near.visible, true);
    assert.equal(far.visible, false);
  }
});

test('zoom hides fully transparent neighbours from the a11y tree', () => {
  const options = normalizeOptions({ mode: 'zoom' });
  const effect = getEffect('zoom');

  for (const d of [-1, 1]) {
    const state = baseState();
    effect.apply(state, { d, index: 0, options, geo: geometry, slider: null, dir: 1, vertical: false, center: { x: 200, y: 150 } });
    assert.equal(state.opacity, 0);
    assert.equal(state.visible, false);
  }
});

test('the default 3D modes opt into a perspective context', () => {
  for (const mode of ['coverflow', 'cards', 'wheel', 'helix', 'flip', 'fold', 'cube', 'zoom']) {
    assert.equal(getEffect(mode).perspective, true, `${mode} must enable the 3D context`);
  }
  assert.ok(DEFAULT_OPTIONS.wheelEffect && DEFAULT_OPTIONS.helixEffect && DEFAULT_OPTIONS.foldEffect && DEFAULT_OPTIONS.zoomEffect);
});
