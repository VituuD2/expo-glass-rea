import { chromium } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  page.on('pageerror', e => console.log('pageerror', e.message));
  await page.goto('http://127.0.0.1:4173/lab');
  if (process.argv[2]) await page.getByLabel('Surface profile', { exact: true }).selectOption(process.argv[2]);
  await page.waitForTimeout(1000);
  console.log(await page.locator('[data-testid="optical-lens"]').evaluate(host => ({ renderer: host.dataset.glassRenderer, reason: host.dataset.glassRendererReason, shaderError: host.querySelector('canvas')?.dataset.glassError, stats: window.glassLabSamples?.at(-1) })));
  await page.screenshot({ path: `docs/verification/fidelity/${process.argv[2] ?? 'after'}-lab.png`, fullPage: true });
  await writeFile('docs/verification/fidelity/current-diagnostics.json', JSON.stringify(await page.evaluate(() => window.glassLabSamples?.at(-1)),null,2)+'\n');
} finally { await browser.close(); }
