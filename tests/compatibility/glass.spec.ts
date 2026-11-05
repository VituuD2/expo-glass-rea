import { expect, test } from '@playwright/test';
test('Actual GPU path or capability fallback is identifiable and keeps HTML usable', async ({ page }, info) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/lab');
  const available = await page.evaluate(() => !!document.createElement('canvas').getContext('webgl2'));
  const lens = page.getByTestId('optical-lens');
  if (available) {
    await expect(lens).toHaveAttribute('data-glass-renderer', 'webgl2');
    await expect(page.getByTestId('renderer-diagnostics')).toContainText('compiled');
    await page.getByLabel('Surface profile', { exact: true }).selectOption('legacy');
    await expect(lens).toHaveAttribute('data-glass-renderer', 'webgl2');
    await page.getByLabel('Surface profile', { exact: true }).selectOption('refined');
    await expect(lens).toHaveAttribute('data-glass-renderer', 'webgl2');
  } else await expect(lens).toHaveAttribute('data-glass-renderer-reason', 'webgl2-initialization');
  await lens.getByRole('button', { name: 'Continue' }).click(); await expect(page.getByText('Actions: 1')).toBeVisible();
  await page.getByLabel('Renderer', { exact: true }).selectOption('css');
  await expect(lens).toHaveAttribute('data-glass-renderer', 'css');
  await info.attach('capabilities', { body: JSON.stringify({ browser: info.project.name, webgl2: available }), contentType: 'application/json' });
  expect(errors).toEqual([]);
});
test('Navigation, reduced motion, resize and Next client hydration', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/lab');
  await page.getByRole('button', { name: 'dark navigation', exact: true }).click();
  const tab = page.getByRole('tab', { selected: true }); await tab.focus(); await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('tab', { name: 'Calls', exact: false })).toHaveAttribute('aria-selected', 'true');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.getByRole('tab', { name: 'Chats', exact: false }).click();
  await expect(page.getByRole('tab', { name: 'Chats', exact: false })).toHaveAttribute('aria-selected', 'true');
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.goto('http://127.0.0.1:4174');
  await page.getByRole('button', { name: 'Hydrated optical child', exact: true }).click();
  await expect(page.getByTestId('next-glass')).toHaveAttribute('data-glass-style', 'none');
  expect(errors).toEqual([]);
});
