import { expect, test, type Page } from '@playwright/test';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { decodePixels } from './pixels';
const lens = (page: Page) => page.getByTestId('optical-lens');
test('Optical renderer compiles, bends the grid and keeps foreground usable', async ({ page }, info) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/lab');
  await expect(lens(page)).toHaveAttribute('data-glass-renderer', 'webgl2');
  await expect(page.getByTestId('optical-merge')).toHaveAttribute('data-glass-renderer', 'webgl2');
  await page.getByRole('checkbox', { name: 'Reflection', exact: true }).uncheck();
  await page.getByRole('checkbox', { name: 'Scattering', exact: true }).uncheck();
  await page.getByRole('checkbox', { name: 'Adaptive lighting', exact: true }).uncheck();
  await page.getByRole('checkbox', { name: 'Shadows', exact: true }).uncheck();
  await page.getByRole('slider', { name: 'Refraction', exact: true }).fill('0');
  await page.waitForTimeout(450);
  const plain = await lens(page).screenshot();
  await page.getByRole('slider', { name: 'Refraction', exact: true }).fill('1');
  const refracted = await lens(page).screenshot();
  expect(refracted.equals(plain)).toBe(false);
  const a = await decodePixels(page, plain), b = await decodePixels(page, refracted);
  let rimDifference = 0, centerDifference = 0, changed = 0;
  for (let y = 40; y < a.height - 40; y++) for (let x = 0; x < a.width; x++) {
    const i = (y * a.width + x) * 4;
    const difference = Math.abs(a.pixels[i] - b.pixels[i]) + Math.abs(a.pixels[i + 1] - b.pixels[i + 1]) + Math.abs(a.pixels[i + 2] - b.pixels[i + 2]);
    if (x < 30 || x >= a.width - 30) { rimDifference += difference; if (difference > 20) changed++; }
    if (x > a.width / 2 - 10 && x < a.width / 2 + 10) centerDifference += difference;
  }
  expect(changed).toBeGreaterThan(100);
  expect(rimDifference).toBeGreaterThan(centerDifference * 2 + 1000);
  await info.attach('spatial-displacement-metrics', { body: JSON.stringify({ changedRimPixels: changed, rimDifference, centerDifference }), contentType: 'application/json' });
  await page.screenshot({ path: info.outputPath('optical-grid.png'), fullPage: true });
  await lens(page).getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByText('Actions: 1')).toBeVisible();
  await lens(page).getByRole('button', { name: 'Move optical lens' }).focus();
  const before = await lens(page).boundingBox(); await page.keyboard.press('ArrowRight');
  expect((await lens(page).boundingBox())!.x).toBe(before!.x + 10);
  for (const shape of ['circle', 'capsule', 'card']) { await page.getByLabel('Geometry', { exact: true }).selectOption(shape); await expect(lens(page)).toHaveAttribute('data-glass-renderer', 'webgl2'); }
  for (const debug of ['normals', 'displacement', 'layers', 'none']) { await page.getByLabel('Inspect field').selectOption(debug); await lens(page).screenshot({ path: info.outputPath(`field-${debug}.png`) }); }
  expect(errors).toEqual([]);
});

test('Live texture, scrolling, resize, materialization, merging and idle scheduling', async ({ page }, info) => {
  await page.goto('/lab'); await expect(lens(page)).toHaveAttribute('data-glass-renderer', 'webgl2');
  for (const scene of ['checkerboard', 'typography', 'photograph', 'moving']) {
    await page.getByRole('button', { name: scene, exact: true }).click();
    await expect(lens(page)).toHaveAttribute('data-glass-renderer', 'webgl2');
    await lens(page).screenshot({ path: info.outputPath(`${scene}.png`) });
  }
  const movingA = await lens(page).screenshot(); await page.waitForTimeout(90); const movingB = await lens(page).screenshot();
  expect(movingA.equals(movingB)).toBe(false);
  await page.getByRole('button', { name: 'scrolling text', exact: true }).click();
  const beforeScroll = await lens(page).screenshot();
  await page.locator('.lab-source-scroll').evaluate(e => { e.scrollTop = 72; });
  await expect.poll(() => page.locator('.lab-source-scroll').evaluate(e => e.scrollTop)).toBe(72);
  expect((await lens(page).screenshot()).equals(beforeScroll)).toBe(false);
  await page.getByRole('button', { name: 'grid', exact: true }).click();
  const group = page.getByTestId('optical-merge');
  await page.getByRole('slider', { name: 'Merge influence' }).fill('0'); const separated = await group.screenshot();
  await page.getByRole('slider', { name: 'Merge influence' }).fill('60');
  expect((await group.screenshot()).equals(separated)).toBe(false);
  await expect(group.locator('mask')).toHaveCount(0);
  await expect(group.locator('.glass-optical-canvas')).toHaveCount(1);
  await page.getByLabel('Material', { exact: true }).selectOption('none'); await page.waitForTimeout(420);
  await expect(lens(page).getByRole('button', { name: 'Continue' })).toBeVisible();
  await page.getByLabel('Material', { exact: true }).selectOption('clear'); await page.waitForTimeout(420);
  await page.mouse.move(0, 0);
  await page.evaluate(() => { window.glassLabSamples = []; }); await page.waitForTimeout(200);
  expect(await page.evaluate(() => window.glassLabSamples.length)).toBe(0);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(lens(page)).toHaveAttribute('data-glass-renderer', 'webgl2');
  await page.screenshot({ path: info.outputPath('optical-mobile.png'), fullPage: true });
});

test('Fallbacks for manual CSS, unsupported geometry and missing WebGL retain actions', async ({ page }) => {
  await page.goto('/lab'); await expect(lens(page)).toHaveAttribute('data-glass-renderer', 'webgl2');
  await lens(page).evaluate(e => { e.style.rotate = '15deg'; });
  await expect(lens(page)).toHaveAttribute('data-glass-renderer-reason', 'unsupported-transform');
  await lens(page).evaluate(e => { e.style.rotate = 'none'; });
  await expect(lens(page)).toHaveAttribute('data-glass-renderer', 'webgl2');
  await lens(page).evaluate(e => { e.style.scale = '-1'; });
  await expect(lens(page)).toHaveAttribute('data-glass-renderer-reason', 'unsupported-transform');
  await lens(page).evaluate(e => { e.style.scale = 'none'; });
  await expect(lens(page)).toHaveAttribute('data-glass-renderer', 'webgl2');
  await lens(page).evaluate(e => { e.style.setProperty('--glass-radius-uniform', 'calc(10% + 4px)'); });
  const calculatedCorner = await lens(page).evaluate(e => getComputedStyle(e).borderTopLeftRadius);
  if (calculatedCorner.includes('calc(')) await expect(lens(page)).toHaveAttribute('data-glass-renderer-reason', 'unsupported-corners');
  await lens(page).evaluate(e => { e.style.setProperty('--glass-radius-uniform', '32px'); });
  await expect(lens(page)).toHaveAttribute('data-glass-renderer', 'webgl2');
  await lens(page).evaluate(e => { e.style.setProperty('--glass-radius-uniform', '20px 40px'); });
  await expect(lens(page)).toHaveAttribute('data-glass-renderer-reason', 'elliptical-corners');
  const group = page.getByTestId('optical-merge');
  await group.evaluate(root => { const template = root.querySelector('[data-glass-view]')!; for (let i = 0; i < 15; i++) root.appendChild(template.cloneNode(true)); });
  await expect(group).toHaveAttribute('data-glass-renderer-reason', 'shape-limit');
  await page.getByLabel('Renderer', { exact: true }).selectOption('css');
  await expect(lens(page)).toHaveAttribute('data-glass-renderer', 'css');
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, kind: string, ...args: unknown[]) {
      return kind === 'webgl2' ? null : Reflect.apply(original, this, [kind, ...args]);
    } as typeof original;
  });
  await page.reload();
  await expect(lens(page)).toHaveAttribute('data-glass-renderer-reason', 'webgl2-initialization');
  await lens(page).getByRole('button', { name: 'Continue' }).click(); await expect(page.getByText('Actions: 1')).toBeVisible();
});

test('Context loss/recovery and repeated StrictMode remount release resources', async ({ page }) => {
  await page.goto('/lab'); await expect(lens(page)).toHaveAttribute('data-glass-renderer', 'webgl2');
  await lens(page).locator('canvas').evaluate(canvas => {
    const gl = (canvas as HTMLCanvasElement).getContext('webgl2')!, extension = gl.getExtension('WEBGL_lose_context')!;
    extension.loseContext(); setTimeout(() => extension.restoreContext(), 500);
  });
  await expect(lens(page)).toHaveAttribute('data-glass-renderer-reason', 'context-lost');
  await expect(lens(page)).toHaveAttribute('data-glass-renderer', 'webgl2');
  for (let i = 0; i < 3; i++) {
    await page.getByRole('button', { name: 'Unmount lens', exact: true }).click(); await expect(lens(page)).toHaveCount(0);
    await page.getByRole('button', { name: 'Mount lens', exact: true }).click(); await expect(lens(page)).toHaveAttribute('data-glass-renderer', 'webgl2');
    await expect(lens(page).locator('canvas')).toHaveCount(1);
  }
});

test('Opaque preferences suppress GPU, reduced motion pauses source, focus/content survive', async ({ page }) => {
  await page.goto('/lab'); await expect(lens(page)).toHaveAttribute('data-glass-renderer', 'webgl2');
  await page.getByRole('button', { name: 'moving', exact: true }).click();
  await page.emulateMedia({ reducedMotion: 'reduce' }); await page.waitForTimeout(100);
  await page.evaluate(() => { window.glassLabSamples = []; }); await page.waitForTimeout(120);
  expect(await page.evaluate(() => window.glassLabSamples.length)).toBe(0);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-transparency', value: 'reduce' }] });
  await expect(lens(page)).toHaveAttribute('data-glass-renderer-reason', 'accessibility');
  await expect(lens(page).locator('canvas')).toBeHidden();
  await page.emulateMedia({ forcedColors: 'active' });
  const button = lens(page).getByRole('button', { name: 'Continue' }); await button.focus(); await page.keyboard.press('Enter');
  await expect(page.getByText('Actions: 1')).toBeVisible();
});

test('Origin-tainted canvas fails at texture upload and recovers to readable CSS', async ({ page }) => {
  const bytes = await readFile('public/alpine.jpg');
  const server = createServer((_, response) => { response.writeHead(200, { 'Content-Type': 'image/jpeg' }); response.end(bytes); });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const address = server.address(); if (!address || typeof address === 'string') throw Error('No port');
    await page.goto('/lab'); await expect(lens(page)).toHaveAttribute('data-glass-renderer', 'webgl2');
    await page.evaluate(async url => { const image = new Image(); image.src = url; await image.decode(); const canvas = document.querySelector<HTMLCanvasElement>('.lab-source')!; canvas.getContext('2d')!.drawImage(image, 0, 0); }, `http://127.0.0.1:${address.port}/image.jpg`);
    await page.getByRole('button', { name: 'typography', exact: true }).click();
    await expect(lens(page)).toHaveAttribute('data-glass-renderer-reason', 'source-security');
    await lens(page).getByRole('button', { name: 'Continue' }).click(); await expect(page.getByText('Actions: 1')).toBeVisible();
  } finally { await new Promise<void>(resolve => server.close(() => resolve())); }
});

test('Next.js explicit texture source hydrates without a server/client mismatch', async ({ page, request }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  const html = await (await request.get('http://127.0.0.1:4174')).text();
  expect(html).toContain('data-testid="next-optical"');
  await page.goto('http://127.0.0.1:4174');
  await expect(page.getByTestId('next-optical')).toHaveAttribute('data-glass-renderer', 'webgl2');
  await page.getByRole('button', { name: 'Hydrated optical child', exact: true }).click();
  await expect(page.getByTestId('next-glass')).toHaveAttribute('data-glass-style', 'none');
  expect(errors).toEqual([]);
});

test('Explicit image, bitmap, offscreen canvas and live video texture uploads', async ({ page }) => {
  await page.goto('/lab');
  const results = await page.evaluate(async () => {
    // Exercise the same internal engine through its source contract, without a second demo API.
    const { OpticalRenderer } = await import(`/src/${'optical-renderer'}.ts`);
    const host = document.createElement('div'), canvas = document.createElement('canvas');
    host.className = 'glass-view'; host.dataset.glassStyle = 'clear';
    host.style.cssText = 'position:fixed;left:0;top:0;width:200px;height:100px;z-index:10';
    canvas.style.display = 'block'; host.appendChild(canvas); document.body.appendChild(host);
    const image = new Image(); image.src = '/alpine.jpg'; await image.decode();
    const bitmap = await createImageBitmap(image), offscreen = new OffscreenCanvas(200, 100);
    offscreen.getContext('2d')!.drawImage(image, 0, 0, 200, 100);
    const producer = document.createElement('canvas'); producer.width = 200; producer.height = 100;
    producer.getContext('2d')!.drawImage(image, 0, 0, 200, 100);
    const stream = producer.captureStream(30), video = document.createElement('video');
    video.muted = true; video.srcObject = stream; await video.play();
    let current: HTMLImageElement | ImageBitmap | OffscreenCanvas | HTMLVideoElement = image;
    let active = false, reason = '', uploads = 0;
    const engine = new OpticalRenderer(host, canvas, { getSource: () => current, getRect: () => host.getBoundingClientRect(), dynamic: true }, false,
      (next: boolean, why: string) => { active = next; reason = why; });
    engine.configure({ opticalThickness: 0, adaptiveLighting: false, opticalOptions: { reflection: false, scattering: false }, onRenderStats: (s: { uploads: number }) => { uploads = s.uploads; } });
    const results: { kind: string; active: boolean; reason: string; uploads: number }[] = [];
    try {
      engine.start();
      for (const [kind, value] of [['image', image], ['bitmap', bitmap], ['offscreen', offscreen], ['video', video]] as const) {
        current = value;
        for (let i = 0; i < 5; i++) await new Promise(requestAnimationFrame);
        results.push({ kind, active, reason, uploads });
      }
    } finally { engine.dispose(); host.remove(); stream.getTracks().forEach(t => t.stop()); video.srcObject = null; bitmap.close(); }
    return results;
  });
  expect(results.map(r => r.kind)).toEqual(['image', 'bitmap', 'offscreen', 'video']);
  for (const result of results) { expect(result.active).toBe(true); expect(result.uploads).toBeGreaterThan(0); }
});

test('Pending renderer import can be unmounted without creating an abandoned context', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.route('**/src/optical-renderer.ts*', async route => { await new Promise(resolve => setTimeout(resolve, 700)); await route.continue(); });
  await page.goto('/lab');
  await page.getByRole('button', { name: 'Unmount lens', exact: true }).click();
  await expect(lens(page)).toHaveCount(0);
  await expect(page.getByTestId('optical-merge')).toHaveAttribute('data-glass-renderer', 'webgl2');
  expect(errors).toEqual([]);
});

test('Automatic quality responds to sustained scheduling pressure and can be overridden', async ({ page }) => {
  // Controlled clock pressure: exercises the policy without depending on CI GPU speed.
  await page.addInitScript(() => { const raf = requestAnimationFrame; window.requestAnimationFrame = fn => raf(time => fn(time + 80)); });
  await page.goto('/lab'); await expect(lens(page)).toHaveAttribute('data-glass-renderer', 'webgl2');
  await page.getByRole('button', { name: 'moving', exact: true }).click();
  await page.getByLabel('Quality', { exact: true }).selectOption('auto');
  await expect(lens(page)).toHaveAttribute('data-glass-renderer-reason', 'performance-budget', { timeout: 15000 });
  await page.getByLabel('Quality', { exact: true }).selectOption('high');
  await expect(lens(page)).toHaveAttribute('data-glass-renderer', 'webgl2');
});
