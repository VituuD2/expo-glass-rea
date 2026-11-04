import { expect, test, type Page } from '@playwright/test';

const surface = (page: Page) => page.getByTestId('main-glass');
const effect = (page: Page) => surface(page).locator('.glass-view__effect');
const range = async (page: Page, label: string, value: string) => {
  const slider = page.getByRole('slider', { name: label, exact: true });
  await slider.fill(value);
};

test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto('/');
  await expect(surface(page)).toHaveAttribute('data-glass-supported', 'true');
  (page as Page & { runtimeErrors?: string[] }).runtimeErrors = errors;
});
test.afterEach(async ({ page }) => {
  expect((page as Page & { runtimeErrors?: string[] }).runtimeErrors ?? []).toEqual([]);
});

test('F01/F02/F03: material variants keep content and animate only the decoration', async ({ page }) => {
  await expect(effect(page)).toHaveCSS('backdrop-filter', 'blur(18px) saturate(1.6)');
  await expect(effect(page)).toHaveCSS('transition-duration', '0.5s');
  const originalBox = await surface(page).boundingBox();
  await page.getByRole('button', { name: 'none', exact: true }).click();
  await expect(effect(page)).toHaveCSS('opacity', '0');
  await expect(surface(page).getByRole('heading')).toHaveText('Take thescenic route.');
  await expect(surface(page).getByRole('button', { name: 'Save destination' })).toBeVisible();
  expect(await surface(page).boundingBox()).toEqual(originalBox);
  await page.getByRole('button', { name: 'clear', exact: true }).click();
  await expect(effect(page)).toHaveCSS('backdrop-filter', 'blur(5px) saturate(1.25)');
  await expect(effect(page)).toHaveCSS('opacity', '1');
  await page.getByRole('checkbox', { name: 'Animate transitions', exact: true }).uncheck();
  await expect(effect(page)).toHaveCSS('transition-duration', '0s');
  await page.getByRole('checkbox', { name: 'Animate transitions', exact: true }).check();
  await range(page, 'Animation duration', '1.2');
  await expect(effect(page)).toHaveCSS('transition-duration', '1.2s');
});

test('F04/F06: CSS, semantic and dynamic tint follow local and system themes', async ({ page }) => {
  await page.getByRole('button', { name: 'Seafoam tint' }).click();
  await expect.poll(() => effect(page).evaluate((node) => getComputedStyle(node, '::after').backgroundColor)).toBe('rgba(62, 182, 162, 0.45)');
  await page.getByRole('button', { name: 'Dynamic tint' }).click();
  const light = await effect(page).evaluate((node) => getComputedStyle(node, '::after').backgroundColor);
  await page.getByRole('button', { name: 'dark', exact: true }).click();
  await expect(surface(page)).toHaveCSS('color-scheme', 'dark');
  await expect.poll(() => effect(page).evaluate((node) => getComputedStyle(node, '::after').backgroundColor)).not.toBe(light);
  await page.getByRole('button', { name: 'Platform tint' }).click();
  await expect.poll(() => effect(page).evaluate((node) => getComputedStyle(node, '::after').backgroundColor)).toBe('rgb(88, 86, 214)');
  await page.getByRole('button', { name: 'auto', exact: true }).click();
  await expect(surface(page)).toHaveAttribute('data-glass-color-scheme', 'auto');
  await page.getByRole('button', { name: 'Dynamic tint' }).click();
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect.poll(() => effect(page).evaluate((node) => getComputedStyle(node, '::after').backgroundColor)).toBe('rgba(149, 107, 219, 0.45)');
});

test('F05/F15/F18: pointer, keyboard, child action and DOM ref remain usable', async ({ page }) => {
  const before = await effect(page).evaluate((node) => getComputedStyle(node).boxShadow);
  await surface(page).hover();
  await expect.poll(() => effect(page).evaluate((node) => getComputedStyle(node).boxShadow)).not.toBe(before);
  await page.getByRole('checkbox', { name: 'Interactive material' }).uncheck();
  await expect(surface(page)).toHaveAttribute('data-glass-interactive', 'false');
  const button = surface(page).getByRole('button', { name: 'Save destination' });
  await button.focus();
  await page.keyboard.press('Enter');
  await expect(surface(page).getByRole('button', { name: 'Unsave destination' })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Inspect ref' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'DOM ref connected' })).toBeVisible();
  const handle = surface(page).getByRole('button', { name: 'Move glass card' });
  const start = await surface(page).boundingBox();
  await handle.focus();
  await page.keyboard.press('ArrowRight');
  await expect.poll(async () => (await surface(page).boundingBox())!.x).toBe(start!.x + 10);
  await handle.hover();
  const box = await handle.boundingBox();
  await page.mouse.move(box!.x + 8, box!.y + 8);
  await page.mouse.down();
  await page.mouse.move(box!.x + 38, box!.y + 28);
  await page.mouse.up();
  await expect.poll(async () => (await surface(page).boundingBox())!.x).toBeGreaterThan(start!.x + 10);
});

test('F07: logical corners resolve with local RTL, physical styles remain stable', async ({ page }) => {
  await page.getByRole('checkbox', { name: 'Asymmetric corners' }).check();
  await expect(surface(page)).toHaveCSS('border-top-left-radius', '60px');
  await expect(surface(page)).toHaveCSS('border-bottom-right-radius', '8px');
  await page.getByRole('checkbox', { name: 'Right to left' }).check();
  await expect(surface(page)).toHaveCSS('border-top-right-radius', '60px');
  await expect(surface(page)).toHaveCSS('border-bottom-left-radius', '8px');
  await range(page, 'Corner radius', '0');
  await expect(surface(page)).toHaveCSS('border-top-left-radius', '0px');
  await page.getByRole('checkbox', { name: 'Continuous corners' }).check();
  if (await page.evaluate(() => CSS.supports('corner-shape', 'squircle'))) {
    await expect.poll(() => surface(page).evaluate((node) => getComputedStyle(node).getPropertyValue('corner-shape'))).toMatch(/squircle|superellipse\(2\)/);
  }
});

test('F08: merge mask updates pixels with spacing, style and resize', async ({ page }) => {
  const group = page.getByTestId('merge-group');
  await expect(group.locator('mask path')).toHaveCount(3);
  const paths = await group.locator('mask path').evaluateAll((nodes) => nodes.map((node) => node.getAttribute('d')));
  await range(page, 'Merge distance', '0');
  await expect(group.locator('mask')).toHaveCount(0);
  const separated = await group.screenshot();
  await range(page, 'Merge distance', '70');
  await expect(group.locator('mask path')).toHaveCount(3);
  await expect(group.locator('feGaussianBlur')).toHaveAttribute('stdDeviation', String(70 / 2.4));
  const merged = await group.screenshot();
  expect(merged.equals(separated)).toBe(false);
  await page.getByRole('button', { name: 'none', exact: true }).click();
  await expect(group.locator('mask path')).toHaveCount(0);
  await page.getByRole('button', { name: 'regular', exact: true }).click();
  await expect(group.locator('mask path')).toHaveCount(3);
  expect(await group.locator('mask path').evaluateAll((nodes) => nodes.map((node) => node.getAttribute('d')))).toEqual(paths);
  await page.setViewportSize({ width: 900, height: 1000 });
  await expect(group.locator('mask path')).toHaveCount(3);
});

test('F08/F11: container remount disconnects observers and replaces mask IDs', async ({ page }) => {
  await page.addInitScript(() => {
    const activeResize = new Set<ResizeObserver>();
    const activeMutation = new Set<MutationObserver>();
    const Resize = window.ResizeObserver;
    const Mutation = window.MutationObserver;
    window.ResizeObserver = class extends Resize {
      observe(target: Element, options?: ResizeObserverOptions) { activeResize.add(this); super.observe(target, options); }
      disconnect() { activeResize.delete(this); super.disconnect(); }
    };
    window.MutationObserver = class extends Mutation {
      observe(target: Node, options?: MutationObserverInit) { activeMutation.add(this); super.observe(target, options); }
      disconnect() { activeMutation.delete(this); super.disconnect(); }
    };
    Object.assign(window, { activeGlassObservers: () => [activeResize.size, activeMutation.size] });
  });
  await page.reload();
  const group = page.getByTestId('merge-group');
  await expect(group.locator('mask path')).toHaveCount(3);
  for (let index = 0; index < 3; index++) {
    const oldId = await group.locator('mask').getAttribute('id');
    await page.getByRole('button', { name: 'Remount', exact: true }).click();
    await expect(group.locator('mask path')).toHaveCount(3);
    expect(await group.locator('mask').getAttribute('id')).not.toBe(oldId);
    await expect.poll(() => page.evaluate(() => (window as unknown as { activeGlassObservers(): number[] }).activeGlassObservers())).toEqual([1, 1]);
  }
});

test('F09/F10/F11: fade, hidden and repeated remount restore visible material', async ({ page }) => {
  await range(page, 'Parent opacity', '0');
  await expect(page.getByTestId('surface-stage')).toHaveCSS('opacity', '0');
  await range(page, 'Parent opacity', '1');
  await expect(page.getByTestId('surface-stage')).toHaveCSS('opacity', '1');
  await page.getByRole('button', { name: 'Hide parent', exact: true }).click();
  await expect(surface(page)).toBeHidden();
  await page.getByRole('button', { name: 'Show parent', exact: true }).click();
  await expect(surface(page)).toBeVisible();
  for (let index = 0; index < 3; index++) {
    await page.getByRole('button', { name: 'Unmount card', exact: true }).click();
    await expect(surface(page)).toHaveCount(0);
    await page.getByRole('button', { name: 'Mount card', exact: true }).click();
    await expect(effect(page)).toHaveCSS('backdrop-filter', 'blur(18px) saturate(1.6)');
  }
  await page.getByRole('button', { name: 'Remount', exact: true }).click();
  await expect(surface(page)).toBeVisible();
});

test('F12/F13/F14: unsupported capability has readable fallback and working content', async ({ page }) => {
  await page.addInitScript(() => {
    const original = CSS.supports.bind(CSS);
    CSS.supports = ((...args: string[]) => args[0].includes('backdrop-filter') ? false : Reflect.apply(original, CSS, args)) as typeof CSS.supports;
  });
  await page.reload();
  await expect(surface(page)).toHaveAttribute('data-glass-supported', 'false');
  await expect(effect(page)).toHaveCSS('backdrop-filter', 'none');
  await expect(page.getByTestId('capabilities')).toHaveText('Opaque fallback');
  await surface(page).getByRole('button', { name: 'Save destination' }).click();
  await expect(surface(page).getByRole('button', { name: 'Unsave destination' })).toBeVisible();
});

test('F19: reduced motion/transparency and forced colors preserve readable content', async ({ page }) => {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }, { name: 'prefers-reduced-transparency', value: 'reduce' }] });
  await expect(effect(page)).toHaveCSS('transition-duration', '0s');
  await expect(effect(page)).toHaveCSS('backdrop-filter', 'none');
  await expect(page.getByTestId('merge-group').locator('.glass-container__material')).toBeHidden();
  await expect(page.getByTestId('capabilities')).toHaveText('Glass supported');
  await page.emulateMedia({ forcedColors: 'active' });
  await expect(effect(page)).toHaveCSS('backdrop-filter', 'none');
  await expect(surface(page).getByRole('heading')).toBeVisible();
});

test('F18: mobile layout, control reset and screenshots', async ({ page }, testInfo) => {
  await page.screenshot({ path: testInfo.outputPath('playground-desktop.png'), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(surface(page)).toBeVisible();
  await page.getByRole('button', { name: 'clear', exact: true }).click();
  await page.getByRole('button', { name: 'Reset', exact: false }).click();
  await expect(surface(page)).toHaveAttribute('data-glass-style', 'regular');
  await page.screenshot({ path: testInfo.outputPath('playground-mobile.png'), fullPage: true });
});

test('F16/F17: real Next.js Server Component, helpers and client hydration', async ({ page, request }) => {
  const response = await request.get('http://127.0.0.1:4174');
  const html = await response.text();
  expect(response.ok()).toBe(true);
  expect(html).toContain('Server API available:');
  expect(html).toContain('Rendered from a Server Component');
  await page.goto('http://127.0.0.1:4174');
  await expect(page.getByTestId('server-capability')).toHaveText('Server API available: false');
  await expect(page.getByTestId('server-glass')).toHaveAttribute('data-glass-supported', 'true');
  await page.getByRole('button', { name: 'Toggle material' }).click();
  await expect(page.getByTestId('next-glass')).toHaveAttribute('data-glass-style', 'none');
  await expect(page.getByRole('button', { name: 'Hydrated child' })).toBeVisible();
  await expect(page.getByTestId('second-container').locator('mask path')).toHaveCount(2);
  const ids = await page.locator('mask').evaluateAll((nodes) => nodes.map((node) => node.id));
  expect(new Set(ids).size).toBe(2);
});
