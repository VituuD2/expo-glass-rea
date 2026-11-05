import { expect, test } from '@playwright/test';
import { decodePixels } from './pixels';

test('SVG experiment distinguishes element filtering from actual backdrop displacement', async ({ page }, info) => {
  await page.setContent(`<style>
    .scene{position:relative;width:240px;height:120px;background:repeating-linear-gradient(90deg,#000 0 2px,#fff 2px 24px)}
    .overlay{position:absolute;inset:20px;background:transparent}
  </style><svg width="0" height="0"><defs><filter id="shift" x="-50%" y="-50%" width="200%" height="200%" color-interpolation-filters="sRGB">
    <feFlood flood-color="rgb(255,128,128)" result="map"/><feDisplacementMap in="SourceGraphic" in2="map" scale="24" xChannelSelector="R" yChannelSelector="G"/>
  </filter></defs></svg><div class="scene"><div class="overlay"></div></div>`);
  const scene = page.locator('.scene'), overlay = page.locator('.overlay');
  const baseline = await decodePixels(page, await scene.screenshot());
  await overlay.evaluate(e => { (e as HTMLElement).style.filter = 'url(#shift)'; });
  const element = await decodePixels(page, await scene.screenshot());
  await overlay.evaluate(e => { (e as HTMLElement).style.filter = 'none'; (e as HTMLElement).style.backdropFilter = 'url(#shift)'; });
  const backdrop = await decodePixels(page, await scene.screenshot());
  const difference = (pixels: number[]) => {
    let count = 0;
    for (let y = 40; y < 80; y++) for (let x = 40; x < 200; x++) {
      const i = (y * 240 + x) * 4; if (Math.abs(pixels[i] - baseline.pixels[i]) > 30) count++;
    }
    return count;
  };
  const result = { elementChangedPixels: difference(element.pixels), backdropChangedPixels: difference(backdrop.pixels), urlSyntaxAccepted: await page.evaluate(() => CSS.supports('backdrop-filter', 'url(#shift)')) };
  expect(result.elementChangedPixels).toBe(0);
  await info.attach('svg-backdrop-experiment', { body: JSON.stringify(result), contentType: 'application/json' });
  console.log('SVG displacement experiment:', result);
});
