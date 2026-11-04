// Controlled replay of published JS; mocks do not simulate React Native or UIKit.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { SourceTextModule, SyntheticModule } from 'node:vm';

const root = new URL('../../artifacts/', import.meta.url);
const read = (path) => readFileSync(new URL(path, root));
const checks = [];
const ok = (name) => checks.push(name);
async function load(file, expo = {}) {
  const dependencies = {
    expo,
    'react-native': { View: 'mock:View' },
    'react/jsx-runtime': { jsx: (type, props) => ({ type, props }) },
  };
  const module = new SourceTextModule(read(`package/build/${file}.js`).toString(), {
    identifier: `published:${file}`,
  });
  await module.link((specifier) => {
    assert.ok(Object.hasOwn(dependencies, specifier), `Unexpected import: ${specifier}`);
    const exports = dependencies[specifier];
    return new SyntheticModule(Object.keys(exports), function () {
      for (const [key, value] of Object.entries(exports)) this.setExport(key, value);
    });
  });
  await module.evaluate();
  return module.namespace;
}

const metadata = JSON.parse(readFileSync(new URL('./npm-release.json', import.meta.url), 'utf8').replace(/^\uFEFF/, ''));
const archive = read('expo-glass-effect-58.0.5.tgz');
assert.equal(`sha512-${createHash('sha512').update(archive).digest('base64')}`, metadata.dist.integrity);
assert.equal(createHash('sha1').update(archive).digest('hex'), metadata.dist.shasum);
assert.equal(JSON.parse(read('package/package.json')).version, '58.0.5');
ok('Archive SHA-512/SHA-1 match npm metadata and package version is 58.0.5');

for (const name of ['isLiquidGlassAvailable', 'isGlassEffectAPIAvailable']) {
  assert.equal((await load(name))[name](), false);
  ok(`${name}: generic platform always false`);
  for (const initial of [true, false, undefined, 'truthy']) {
    let value = initial;
    let calls = 0;
    const module = await load(`${name}.ios`, {
      requireNativeModule(moduleName) {
        assert.equal(moduleName, 'ExpoGlassEffect');
        calls++;
        return { [name]: value };
      },
    });
    assert.equal(calls, 0);
    assert.equal(module[name](), !!initial);
    value = initial === undefined ? true : !initial;
    assert.equal(module[name](), initial === undefined ? true : !!initial);
    assert.equal(calls, initial === undefined ? 2 : 1);
    ok(`${name}: lazy access/cache/coercion with ${String(initial)}`);
  }
  let calls = 0;
  const module = await load(`${name}.ios`, {
    requireNativeModule() { calls++; throw new Error('synthetic missing native module'); },
  });
  assert.throws(module[name], /synthetic missing native module/);
  assert.throws(module[name], /synthetic missing native module/);
  assert.equal(calls, 2);
  ok(`${name}: native lookup errors propagate and are retried on next call`);
}

const props = {
  glassEffectStyle: { style: 'clear', animate: true, animationDuration: 0.5 },
  tintColor: '#ff0000', isInteractive: true, colorScheme: 'dark', spacing: 20,
  style: { borderRadius: 12 }, children: { synthetic: 'child' },
  ref: { current: null }, accessibilityLabel: 'Synthetic glass', testID: 'glass',
};
for (const name of ['GlassView', 'GlassContainer']) {
  const fallback = (await load(name)).default(props);
  assert.equal(fallback.type, 'mock:View');
  assert.deepEqual(fallback.props, props);
  assert.equal(fallback.props.children, props.children);
  assert.equal(fallback.props.ref, props.ref);
  ok(`${name}: generic wrapper forwards all props/children/ref to View`);
  const native = function MockNativeView() {};
  const requests = [];
  const ios = await load(`${name}.ios`, {
    requireNativeView(...args) { requests.push(args); return native; },
  });
  assert.deepEqual(requests, [['ExpoGlassEffect', name]]);
  if (name === 'GlassView') {
    const result = ios.default(props);
    assert.equal(result.type, native);
    assert.deepEqual(result.props, props);
    assert.equal(result.props.ref, props.ref);
  } else {
    assert.equal(ios.default, native);
  }
  ok(`${name}: iOS requests correct native view eagerly; wrapper/export preserved`);
}

console.log(JSON.stringify({
  target: 'expo-glass-effect@58.0.5', node: process.version,
  archive_sha256: createHash('sha256').update(archive).digest('hex'),
  scope: 'Published JavaScript with synthetic dependency mocks; no React render, Metro, native bridge or UIKit execution',
  passed: checks.length, checks,
}, null, 2));
