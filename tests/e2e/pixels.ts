import type { Page } from '@playwright/test';
/** Decode a captured screenshot with the browser's PNG decoder, outside the production renderer. */
export async function decodePixels(page: Page, png: Buffer) {
  return page.evaluate(async base64 => {
    const image = new Image(); image.src = `data:image/png;base64,${base64}`; await image.decode();
    const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
    const context = canvas.getContext('2d')!; context.drawImage(image, 0, 0);
    return { width: image.width, height: image.height, pixels: Array.from(context.getImageData(0, 0, image.width, image.height).data) };
  }, png.toString('base64'));
}
