import { chromium } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';

const percentile = (values, p) => { const sorted = values.filter(Number.isFinite).sort((a,b) => a-b); return sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))] : null; };
const summarize = values => ({ count: values.length, p50: percentile(values,.5), p95: percentile(values,.95), max: values.length ? Math.max(...values) : null });
const browser = await chromium.launch();
const automatic = process.argv.includes('--auto');
const results = automatic ? JSON.parse(await readFile('docs/verification/optical-benchmark.json', 'utf8')) : { capturedAt: new Date().toISOString(), platform: `${os.platform()} ${os.release()} ${os.arch()}`, cpu: os.cpus()[0]?.model, browser: browser.version(), methodology: 'Headless Chromium; 40 warmup RAFs then 120 sampled RAF intervals. CPU includes DOM measurement/upload submission; asynchronous GPU queries exclude uploads/composition. No total-frame GPU guarantee. Source is redrawn on canvas and uploaded only after notification. High quality; automatic quality scaling disabled.', cases: [] };
try {
  for (const [dpr, shapes] of (automatic ? [[2,16]] : [[1,2],[1,16],[2,2],[2,16]])) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1100 }, deviceScaleFactor: dpr });
    await page.goto('http://127.0.0.1:4173/lab');
    await page.locator('[data-testid="optical-lens"][data-glass-renderer="webgl2"]').waitFor();
    if (shapes === 16) await page.locator('[data-testid="optical-merge"]').evaluate(group => {
      const template = group.querySelector('[data-glass-view]');
      for (let i = 2; i < 16; i++) group.appendChild(template.cloneNode(true));
      group.querySelectorAll('[data-glass-view]').forEach((view, i) => Object.assign(view.style, { width: '48px', height: '48px', left: `${12 + (i % 8) * 96}px`, top: `${4 + Math.floor(i / 8) * 54}px` }));
    });
    await page.getByRole('button', { name: 'moving', exact: true }).click();
    if (automatic) await page.getByLabel('Quality', { exact: true }).selectOption('auto');
    const sample = await page.evaluate(async () => {
      for (let i = 0; i < 40; i++) await new Promise(requestAnimationFrame);
      window.glassLabSamples = []; window.glassLabGroupSamples = [];
      const intervals = []; let last = performance.now();
      for (let i = 0; i < 120; i++) { const now = await new Promise(requestAnimationFrame); intervals.push(now-last); last = now; }
      const canvas = document.querySelector('[data-testid="optical-lens"] canvas'), gl = canvas.getContext('webgl2'), ext = gl.getExtension('WEBGL_debug_renderer_info');
      return { intervals: intervals.slice(1), lens: window.glassLabSamples, group: window.glassLabGroupSamples, renderer: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER), activePaths: [...document.querySelectorAll('[data-testid="optical-lens"], [data-testid="optical-merge"]')].map(e => ({ renderer: e.dataset.glassRenderer, reason: e.dataset.glassRendererReason })) };
    });
    await page.getByRole('button', { name: 'grid', exact: true }).click();
    await page.waitForTimeout(450); await page.mouse.move(0,0);
    await page.evaluate(() => { window.glassLabSamples = []; window.glassLabGroupSamples = []; });
    await page.waitForTimeout(250);
    const idle = await page.evaluate(() => ({ lens: window.glassLabSamples.length, group: window.glassLabGroupSamples.length }));
    const record = { dpr, requestedGroupShapes: shapes, actualGroupShapes: sample.group.at(-1)?.shapes, renderer: sample.renderer, frameIntervalMs: summarize(sample.intervals), lensCpuMs: summarize(sample.lens.map(s=>s.cpuMs)), groupCpuMs: summarize(sample.group.map(s=>s.cpuMs)), lensGpuMs: summarize(sample.lens.map(s=>s.gpuMs).filter(Number.isFinite)), groupGpuMs: summarize(sample.group.map(s=>s.gpuMs).filter(Number.isFinite)), estimatedBytes: (sample.lens.at(-1)?.estimatedBytes ?? 0)+(sample.group.at(-1)?.estimatedBytes ?? 0), idleDrawsOver250ms: idle };
    if (automatic) results.adaptiveCase = { ...record, capturedAt: new Date().toISOString(), activePaths: sample.activePaths };
    else results.cases.push(record);
    console.log(JSON.stringify(automatic ? results.adaptiveCase : record)); await page.close();
  }
  await writeFile('docs/verification/optical-benchmark.json', JSON.stringify(results,null,2)+'\n');
} finally { await browser.close(); }
