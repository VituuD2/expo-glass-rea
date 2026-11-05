import { chromium } from '@playwright/test';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const videoPath = 'docs/references/WhatsApp Video 2026-11-04 at 7.58.14 PM.mp4';
const output = 'docs/verification/fidelity';
await mkdir(output, { recursive: true });
const browser = await chromium.launch();
let previous;
try { previous = JSON.parse(await readFile(`${output}/reference-inspection.json`, 'utf8')); } catch { /* First capture. */ }
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  await page.goto('http://127.0.0.1:4173/lab');
  await page.locator('[data-testid="optical-lens"][data-glass-renderer="webgl2"]').waitFor();
  await page.waitForTimeout(500);
  if (!previous) await page.screenshot({ path: `${output}/before-lab.png`, fullPage: true });
  const diagnostics = await page.locator('[data-testid="optical-lens"]').evaluate(host => {
    const canvas = host.querySelector('canvas'), gl = canvas.getContext('webgl2');
    return { activeRenderer: host.dataset.glassRenderer, fallbackReason: host.dataset.glassRendererReason,
      devicePixelRatio, canvasPixelWidth: canvas.width, canvasPixelHeight: canvas.height,
      source: { type: 'HTMLCanvasElement', width: document.querySelector('.lab-source').width, height: document.querySelector('.lab-source').height },
      stats: window.glassLabSamples?.at(-1), context: gl.getParameter(gl.VERSION) };
  });
  await page.goto(`http://127.0.0.1:4173/${encodeURI(videoPath)}`);
  const result = await page.evaluate(async () => {
    const video = document.querySelector('video'); video.pause();
    if (video.readyState < 1) await new Promise((resolve, reject) => { video.onloadedmetadata = resolve; video.onerror = reject; });
    const width = video.videoWidth, height = video.videoHeight, duration = video.duration;
    const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
    const context = canvas.getContext('2d');
    const sheet = document.createElement('canvas'); sheet.width = 4 * 424; sheet.height = 2 * 120;
    const c = sheet.getContext('2d'); c.fillStyle = '#242424'; c.fillRect(0,0,sheet.width,sheet.height);
    const samples = [];
    let first;
    for (let i = 0; i < 8; i++) {
      const t = Math.min(duration - .05, .1 + duration * i / 8);
      await new Promise(resolve => { video.onseeked = resolve; video.currentTime = t; });
      context.drawImage(video, 0,0); if (!i) first = canvas.toDataURL('image/png');
      const x = (i % 4)*424, y = Math.floor(i/4)*120;
      c.drawImage(canvas, 0,0,width,height,x,y,424,96);
      c.fillStyle = '#fff'; c.font = '14px monospace'; c.fillText(`${t.toFixed(3)} s`,x+8,y+114);
      samples.push(t);
    }
    return { width,height,duration,samples, first, sheet: sheet.toDataURL('image/png') };
  });
  const { first, sheet, ...metadata } = result;
  await writeFile(`${output}/reference-frame.png`, Buffer.from(first.split(',')[1], 'base64'));
  await writeFile(`${output}/reference-contact.png`, Buffer.from(sheet.split(',')[1], 'base64'));
  await writeFile(`${output}/reference-inspection.json`, JSON.stringify({ path: videoPath, sha256: createHash('sha256').update(await readFile(videoPath)).digest('hex'), ...metadata, diagnostics: previous?.diagnostics ?? diagnostics, limitation: 'WhatsApp-compressed reference; qualitative shape/motion observation only. Sampling times are seek requests, not asserted original-frame timestamps. Initial renderer diagnostics are preserved on rerun.' },null,2)+'\n');
  console.log(JSON.stringify({ ...metadata, diagnostics },null,2));
} finally { await browser.close(); }
