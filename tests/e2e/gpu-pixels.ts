import { expect, type Page } from '@playwright/test';
declare global { interface Window {
  glassPixelCapture: number;
  glassPixelData?: { width: number; height: number; pixels: Uint8Array; id: number };
} }
/** Test-only readback at the draw boundary. Production rendering never calls readPixels. */
export async function instrumentPixels(page: Page) {
  await page.addInitScript(() => {
    const draw = WebGL2RenderingContext.prototype.drawArrays;
    WebGL2RenderingContext.prototype.drawArrays = function (mode: number, first: number, count: number) {
      draw.call(this, mode, first, count);
      const canvas = this.canvas;
      if (window.glassPixelCapture && canvas instanceof HTMLCanvasElement && canvas.closest('[data-testid="optical-lens"]')) {
        const pixels = new Uint8Array(canvas.width * canvas.height * 4), id = window.glassPixelCapture;
        this.readPixels(0,0,canvas.width,canvas.height,this.RGBA,this.UNSIGNED_BYTE,pixels);
        window.glassPixelData = { width: canvas.width, height: canvas.height, pixels, id };
        window.glassPixelCapture = 0;
      }
    };
  });
}
export async function capturePixels(page: Page) {
  await page.getByTestId('optical-lens').scrollIntoViewIfNeeded();
  const id = await page.evaluate(() => { const next=(window.glassPixelData?.id ?? 0)+1; window.glassPixelCapture=next; dispatchEvent(new Event('resize')); return next; });
  await expect.poll(() => page.evaluate(() => window.glassPixelData?.id)).toBe(id);
}
