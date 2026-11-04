import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import * as library from '@expo-glass-rea/react';
import { normalizeEffect, tintColors, glassStyle } from '../dist/options.js';
import { roundedPath } from '../dist/geometry.js';

test('F16: published entry exports exactly the four runtime members', () => {
  assert.deepEqual(Object.keys(library).sort(), ['GlassContainer', 'GlassView', 'isGlassEffectAPIAvailable', 'isLiquidGlassAvailable'].sort());
});
test('F12/F13: SSR import and both capability helpers are safe without DOM', () => {
  assert.equal(library.isGlassEffectAPIAvailable(), false);
  assert.equal(library.isLiquidGlassAvailable(), false);
});
test('F13: capability detection accepts prefix-only APIs and does not cache SSR false', () => {
  try {
    globalThis.CSS = { supports: (property) => property === '-webkit-backdrop-filter' };
    assert.equal(library.isGlassEffectAPIAvailable(), true);
    assert.equal(library.isLiquidGlassAvailable(), true);
    globalThis.CSS = { supports: () => false };
    assert.equal(library.isGlassEffectAPIAvailable(), false);
    globalThis.CSS = {};
    assert.equal(library.isGlassEffectAPIAvailable(), false);
  } finally { delete globalThis.CSS; }
});
test('F01/F02/F15: SSR forwards DOM attributes/children while stripping material props', () => {
  const html = renderToStaticMarkup(h(library.GlassView, { id: 'glass', 'aria-label': 'Surface', glassEffectStyle: 'none', isInteractive: true, tintColor: 'red' }, h('button', null, 'Still here')));
  assert.match(html, /id="glass"/);
  assert.match(html, /aria-label="Surface"/);
  assert.match(html, /data-glass-style="none"/);
  assert.match(html, /<button>Still here<\/button>/);
  assert.doesNotMatch(html, /glassEffectStyle=|tintColor=|isInteractive=/);
});
test('F02/F03: defaults, accepted styles, duration zero and invalid input recovery', () => {
  assert.deepEqual(normalizeEffect(), { style: 'regular', animate: false, duration: .35 });
  for (const style of ['regular', 'clear', 'none']) assert.equal(normalizeEffect(style).style, style);
  assert.deepEqual(normalizeEffect({ style: 'none', animate: true, animationDuration: 0 }), { style: 'none', animate: true, duration: 0 });
  for (const duration of [-1, NaN, Infinity, '2']) assert.equal(normalizeEffect({ style: 'clear', animationDuration: duration }).duration, .35);
  for (const value of [null, 7, {}, { style: 'unknown', animate: 'true' }]) assert.deepEqual(normalizeEffect(value), { style: 'regular', animate: false, duration: .35 });
});
test('F04: CSS, dynamic/high contrast and known semantic colors', () => {
  assert.deepEqual(tintColors('red'), ['red', 'red', 'red', 'red']);
  assert.deepEqual(tintColors({ light: 'white', dark: 'black' }), ['white', 'black', 'white', 'black']);
  assert.deepEqual(tintColors({ dynamic: { light: 'white', dark: 'black', highContrastLight: 'yellow', highContrastDark: 'blue' } }), ['white', 'black', 'yellow', 'blue']);
  assert.deepEqual(tintColors({ semantic: ['notAColor', 'systemBlue'] }), ['#007aff', '#007aff', '#007aff', '#007aff']);
  for (const value of [null, 1, {}, { dynamic: 5 }, { semantic: ['__proto__'] }]) assert.deepEqual(tintColors(value), ['transparent', 'transparent', 'transparent', 'transparent']);
});
test('F07: zero overrides, logical aliases and removal of native-only borderCurve', () => {
  const style = glassStyle({ borderRadius: 20, borderTopLeftRadius: 0, borderTopStartRadius: 42, borderBottomEndRadius: -3, borderCurve: 'continuous', padding: 16 });
  assert.equal(style['--glass-radius-tl'], '0px');
  assert.equal(style['--glass-radius-ts'], '42px');
  assert.equal(style['--glass-radius-be'], '0px');
  assert.equal(style.cornerShape, 'squircle');
  assert.equal(style.padding, 16);
  assert.equal('borderTopStartRadius' in style, false);
  assert.equal('borderCurve' in style, false);
});
test('F08: omitted spacing works in SSR and invalid spacing is bounded safely', () => {
  for (const spacing of [undefined, NaN, Infinity, 'bad']) {
    assert.match(renderToStaticMarkup(h(library.GlassContainer, { spacing }, 'Children')), /data-glass-spacing="20"/);
  }
  const noFusion = renderToStaticMarkup(h(library.GlassContainer, { spacing: -1 }, 'Children'));
  assert.match(noFusion, /data-glass-spacing="0"/);
  assert.doesNotMatch(noFusion, /<svg/);
});
test('F08: shape generation handles asymmetric and oversized radii without invalid coordinates', () => {
  const path = roundedPath({ x: 10, y: 5, width: 40, height: 20, radii: [100, 100, 0, 10] });
  assert.match(path, /^M/);
  assert.match(path, /Z$/);
  assert.doesNotMatch(path, /NaN|Infinity/);
  assert.ok(path.includes('50'));
});
