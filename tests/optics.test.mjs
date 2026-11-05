import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createElement as h } from 'react';
import { renderToString } from 'react-dom/server';
import { GlassView, GlassContainer } from '../dist/index.js';
import { normalize3, refract3, schlick, smoothMin, roundedRectDistance, surfaceHeight, heightNormal, projectedDisplacement, srgbToLinear, linearToSrgb } from '../dist/optics.js';
import { selectRenderer } from '../dist/renderer-selection.js';

const close = (a, b, e = 1e-8) => assert.ok(Math.abs(a - b) < e, `${a} != ${b}`);
test('Snell: normal incidence, 45 degree air/glass and total internal reflection', () => {
  assert.deepEqual(refract3([0, 0, -1], [0, 0, 1], 1 / 1.5), [0, 0, -1]);
  const ray = refract3([Math.SQRT1_2, 0, -Math.SQRT1_2], [0, 0, 1], 1 / 1.5);
  close(Math.asin(ray[0]) * 180 / Math.PI, 28.1255057020557);
  close(Math.hypot(...ray), 1);
  assert.equal(refract3([Math.sqrt(.75), 0, -.5], [0, 0, 1], 1.5), null);
});
test('Fresnel: dielectric normal value, grazing limit, monotonicity', () => {
  close(schlick(1, 1, 1.5), .04); close(schlick(0, 1, 1.5), 1);
  let last = 1; for (let c = 0; c <= 1; c += .01) { const f = schlick(c); assert.ok(f <= last); last = f; }
});
test('Normal and Snell displacement are finite, normalized, continuous and symmetric', () => {
  const shape = { x: 0, y: 0, width: 200, height: 120, radii: [32, 32, 32, 32] };
  const height = (x, y) => surfaceHeight(roundedRectDistance(x, y, shape), 120, .5);
  let previous;
  for (let x = 0; x <= 200; x += .1) {
    const n = heightNormal(height, x, 60), delta = projectedDisplacement(n, height(x, 60));
    close(Math.hypot(...n), 1); assert.ok(delta.every(Number.isFinite));
    assert.ok(Math.hypot(...delta) <= 64);
    if (previous) assert.ok(Math.hypot(delta[0] - previous[0], delta[1] - previous[1]) < .5);
    previous = delta;
  }
  const left = projectedDisplacement(heightNormal(height, 12, 60), height(12, 60));
  const right = projectedDisplacement(heightNormal(height, 188, 60), height(188, 60));
  close(left[0], -right[0]); assert.ok(Math.abs(left[0]) > 1);
  assert.deepEqual(projectedDisplacement([0, 0, 1], 24), [0, 0]);
  assert.deepEqual(projectedDisplacement(normalize3([1, 0, 1]), 0), [0, 0]);
  assert.deepEqual(projectedDisplacement(normalize3([1, 0, 1]), 24, 1), [0, 0]);
  assert.deepEqual(normalize3([0, 0, 0]), [0, 0, 1]);
});
test('SDF: box, circle, capsule and rounded corner distances have known analytic values', () => {
  const box = { x: 0, y: 0, width: 100, height: 100, radii: [0, 0, 0, 0] };
  close(roundedRectDistance(50, 50, box), -50); close(roundedRectDistance(110, 50, box), 10);
  const circle = { ...box, radii: [50, 50, 50, 50] };
  close(roundedRectDistance(0, 0, circle), Math.hypot(50, 50) - 50);
  close(roundedRectDistance(50, 0, circle), 0);
  const capsule = { ...circle, width: 200 };
  close(roundedRectDistance(100, 50, capsule), -50); close(roundedRectDistance(200, 50, capsule), 0);
});
test('Smooth union: symmetry, exact far branch, continuous bridge and finite normals', () => {
  close(smoothMin(2, 2, 20), -3); close(smoothMin(-10, 30, 20), -10);
  close(smoothMin(1, 2, 0), 1); close(smoothMin(2, 5, 20), smoothMin(5, 2, 20));
  const a = { x: 0, y: 0, width: 80, height: 80, radii: [40, 40, 40, 40] };
  const b = { ...a, x: 96 };
  const union = (x, y) => smoothMin(roundedRectDistance(x, y, a), roundedRectDistance(x, y, b), 56);
  assert.ok(union(88, 40) < 0);
  const height = (x, y) => surfaceHeight(union(x, y), 80, .5);
  for (let x = 75; x < 101; x += .1) close(Math.hypot(...heightNormal(height, x, 40)), 1);
});
test('Linear color transfers round trip and preserve known sRGB breakpoint', () => {
  close(srgbToLinear(.04045), .0031308049535603713);
  for (const value of [0, .01, .1, .5, 1]) close(linearToSrgb(srgbToLinear(value)), value, 1e-7);
});
test('Renderer selection: explicit sources, manual overrides, failed context, opaque preference', () => {
  assert.equal(selectRenderer('auto', true, true, false), 'webgl2');
  for (const [mode, source, gpu, opaque] of [['auto', false, true, false], ['css', true, true, false], ['webgl2', true, false, false], ['auto', true, true, true]]) assert.equal(selectRenderer(mode, source, gpu, opaque), 'css');
});
test('SSR optical props do not evaluate callbacks, touch DOM or leak onto HTML', () => {
  const backgroundSource = { getSource() { throw Error('SSR must not call'); }, getRect() { throw Error('SSR must not call'); } };
  const props = { backgroundSource, renderingMode: 'webgl2', opticalThickness: .8, refractionStrength: .7, opticalOptions: { debug: 'normals' } };
  for (const Component of [GlassView, GlassContainer]) {
    const html = renderToString(h(Component, props, h('button', null, 'Accessible child')));
    assert.match(html, /data-glass-renderer="css"/); assert.match(html, /Accessible child/);
    assert.doesNotMatch(html, /backgroundSource=|opticalOptions=|opticalThickness=|refractionStrength=/);
  }
});
