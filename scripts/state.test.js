/**
 * Regression tests for the progress state machine.
 *
 * `progress` is fractional while a transition runs, but it must resolve back
 * onto a whole slide. The bugs these tests pin down all shared one cause:
 * resolving a target against the fractional value instead of the nearest index,
 * so an interrupted drag left the slider permanently off-grid.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { resolveProgress, stepProgress } from '../src/utils.js';

test('a drag released off-grid snaps to the nearest slide', () => {
  assert.equal(resolveProgress(1, 1.25, 5, true), 1);
  assert.equal(resolveProgress(0, 0.188, 5, true), 0);
});

test('rapid next() calls advance one slide from the nearest index', () => {
  assert.equal(stepProgress(1.936, 1, 1, 5, true), 3);
  assert.equal(resolveProgress(3, 1.936, 5, true), 3);
});

test('loop navigation keeps monotonic progress across the boundary', () => {
  assert.equal(stepProgress(4, 1, 1, 5, true), 5);
  assert.equal(stepProgress(0, -1, 1, 5, true), -1);
  assert.equal(resolveProgress(0, 35, 5, true), 35);
});

test('goTo takes the shortest wrap in loop mode', () => {
  assert.equal(resolveProgress(2, 0, 5, true), 2);
  assert.equal(resolveProgress(3, 0, 5, true), -2);
  assert.equal(resolveProgress(4, 0, 5, true), -1);
  assert.equal(resolveProgress(3, 35, 5, true), 33);
  assert.equal(resolveProgress(4, 35, 5, true), 34);
});

test('non-loop targets clamp to the last reachable index', () => {
  assert.equal(resolveProgress(9, 0, 5, false, 2), 2);
  assert.equal(resolveProgress(-2, 0, 5, false, 2), 0);
  assert.equal(stepProgress(2.4, 1, 2, 5, false, 2), 2);
});

test('fractional requests and sub-one steps are normalised', () => {
  assert.equal(resolveProgress(1.6, 0, 5, true), 2);
  assert.equal(stepProgress(0, 1, 0, 5, false, 2), 1);
});

test('large steps keep their direction instead of taking the shorter wrap', () => {
  assert.equal(stepProgress(0, 1, 3, 5, true), 3);
  assert.equal(stepProgress(1, -1, 3, 5, true), -2);
});

test('an off-grid sequence settles on integers after every step', () => {
  let progress = 0.188;
  for (let index = 0; index < 4; index += 1) {
    progress = stepProgress(progress, 1, 1, 5, true);
    assert.ok(Number.isInteger(progress), `progress ${progress} is not a whole slide`);
  }
});
