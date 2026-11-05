import { expect, test, type Page } from '@playwright/test';
import { capturePixels, instrumentPixels } from './gpu-pixels';
import { refinedSurface, srgbToLinear } from '../../src/optics';
const lens = (page: Page) => page.getByTestId('optical-lens');
async function isolate(page: Page) {
  for (const name of ['Reflection','Scattering','Adaptive lighting','Shadows','Edge illumination','Motion response']) await page.getByRole('checkbox', { name, exact: true }).uncheck();
  await page.getByRole('slider', { name: 'Spectral edge light', exact: true }).fill('0');
  await lens(page).scrollIntoViewIfNeeded(); await page.waitForTimeout(600);
}
test('DPR 1 / 1.5 / 2 / 3: analytic normals, SDF coverage and explicit resolution', async ({ browser }, info) => {
  test.setTimeout(60000);
  const samples = [];
  for (const dpr of [1,1.5,2,3]) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1100 }, deviceScaleFactor: dpr });
    const page = await context.newPage(); await instrumentPixels(page); await page.goto('/lab');
    await expect(lens(page)).toHaveAttribute('data-glass-renderer','webgl2'); await isolate(page);
    await page.getByLabel('Maximum pixel ratio', { exact: true }).selectOption('3');
    await page.getByLabel('Inspect field').selectOption('normals'); await capturePixels(page);
    const normal = await page.evaluate(() => {
      const data=window.glassPixelData!, host=document.querySelector<HTMLElement>('[data-testid="optical-lens"]')!;
      const ratio=data.width/(host.offsetWidth+56), x=Math.floor((28+12.5)*ratio), y=data.height-1-Math.floor((28+120.5)*ratio);
      const at=(y*data.width+x)*4;
      return { rgb:Array.from(data.pixels.slice(at,at+3)), ratio, width:data.width, cssWidth:host.offsetWidth+56 };
    });
    expect(Math.abs(normal.ratio-dpr)).toBeLessThan(.005);
    const actual=normal.rgb.map(v=>srgbToLinear(v/255)*2-1), expected=refinedSurface(12.5,120.5,[{x:0,y:0,width:290,height:240,radii:[32,32,32,32]}]).normal;
    actual.forEach((n,i)=>expect(Math.abs(n-expected[i])).toBeLessThan(.035));
    await page.getByLabel('Inspect field').selectOption('none'); await page.getByLabel('Geometry',{exact:true}).selectOption('circle'); await page.waitForTimeout(600); await capturePixels(page);
    const smooth=await page.evaluate(()=>{let fractional=0;for(let i=3;i<window.glassPixelData!.pixels.length;i+=4){const a=window.glassPixelData!.pixels[i];if(a>0&&a<255)fractional++;}return fractional;});
    expect(smooth).toBeGreaterThan(40);
    await page.getByRole('checkbox',{name:'Analytical antialiasing',exact:true}).uncheck(); await capturePixels(page);
    const hard=await page.evaluate(()=>{let fractional=0;for(let i=3;i<window.glassPixelData!.pixels.length;i+=4){const a=window.glassPixelData!.pixels[i];if(a>0&&a<255)fractional++;}return fractional;});
    expect(hard).toBe(0);
    samples.push({dpr,normal,decodedNormal:actual,fractionalEdgePixels:smooth,disabledAAFractionalPixels:hard});
    await page.screenshot({path:info.outputPath(`dpr-${dpr}.png`),fullPage:true}); await context.close();
  }
  await info.attach('resolution-and-normals',{body:JSON.stringify(samples),contentType:'application/json'});
});
test('Spectral radiance and wavelength refraction are independent, localized contributions', async ({page}, info) => {
  await instrumentPixels(page); await page.goto('/lab'); await expect(lens(page)).toHaveAttribute('data-glass-renderer','webgl2'); await isolate(page);
  await page.getByRole('button',{name:'dark navigation',exact:true}).click(); await page.waitForTimeout(650); await capturePixels(page);
  await page.evaluate(()=>{Object.assign(window,{pixelBaseline:window.glassPixelData!.pixels.slice()});});
  await page.getByRole('slider',{name:'Spectral edge light',exact:true}).fill('1'); await capturePixels(page);
  const differences=await page.evaluate(()=>{
    const data=window.glassPixelData!, old=(window as unknown as {pixelBaseline:Uint8Array}).pixelBaseline;
    let changed=0,center=0,alphaChanged=0;
    for(let y=0;y<data.height;y++)for(let x=0;x<data.width;x++){
      const at=(y*data.width+x)*4,d=Math.abs(old[at]-data.pixels[at])+Math.abs(old[at+1]-data.pixels[at+1])+Math.abs(old[at+2]-data.pixels[at+2]);
      if(d>2)changed++; if(x>data.width*.4&&x<data.width*.6&&y>data.height*.4&&y<data.height*.6&&d>0)center++;
      if(old[at+3]!==data.pixels[at+3])alphaChanged++;
    } return {changed,center,alphaChanged};
  });
  expect(differences.changed).toBeGreaterThan(20); expect(differences.center).toBe(0); expect(differences.alphaChanged).toBe(0);
  await page.screenshot({path:info.outputPath('spectral-navigation.png'),fullPage:true});
  await page.getByRole('slider',{name:'Spectral edge light',exact:true}).fill('0'); await page.getByRole('button',{name:'checkerboard',exact:true}).click(); await page.waitForTimeout(650); await capturePixels(page);
  await page.evaluate(()=>{Object.assign(window,{pixelBaseline:window.glassPixelData!.pixels.slice()});});
  await page.getByRole('slider',{name:'Dispersion',exact:true}).fill('1'); await capturePixels(page);
  const dispersion=await page.evaluate(()=>{const a=(window as unknown as {pixelBaseline:Uint8Array}).pixelBaseline,b=window.glassPixelData!.pixels;let changed=0,greenChanged=0;for(let i=0;i<a.length;i+=4){if(a[i]!==b[i]||a[i+2]!==b[i+2])changed++;if(a[i+1]!==b[i+1])greenChanged++;}return{changed,greenChanged};});
  expect(dispersion.changed).toBeGreaterThan(10); expect(dispersion.greenChanged).toBe(0);
  await info.attach('independent-color-contributions',{body:JSON.stringify({spectral:differences,dispersion}),contentType:'application/json'});
});
test('sRGB patches follow the documented linear-light clear backing without clipping',async({page},info)=>{
  await instrumentPixels(page); await page.goto('/lab'); await expect(lens(page)).toHaveAttribute('data-glass-renderer','webgl2'); await isolate(page);
  await page.getByRole('slider',{name:'Refraction',exact:true}).fill('0'); await page.getByRole('button',{name:'color patches',exact:true}).click(); await capturePixels(page);
  const patches=await page.evaluate(()=>{
    const data=window.glassPixelData!,host=document.querySelector<HTMLElement>('[data-testid="optical-lens"]')!,source=document.querySelector<HTMLCanvasElement>('.lab-source')!;
    const box=host.getBoundingClientRect(), rect=source.getBoundingClientRect(),ratio=data.width/(host.offsetWidth+56),colors=[[0,0,0],[128,128,128],[255,255,255],[255,0,0],[0,255,0],[0,0,255]];
    const linear=(v:number)=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4,encode=(v:number)=>v<=.0031308?v*12.92:1.055*v**(1/2.4)-.055;
    return [20,80,160,250].map(x=>{const at=((data.height-1-Math.floor((28+120)*ratio))*data.width+Math.floor((28+x)*ratio))*4,index=Math.floor((box.left-rect.left+x)/rect.width*6);return{actual:Array.from(data.pixels.slice(at,at+3)),expected:colors[index].map(c=>Math.round(encode(linear(c/255)*.982+.018)*255))};});
  });
  for(const patch of patches)patch.actual.forEach((c,i)=>expect(Math.abs(c-patch.expected[i])).toBeLessThanOrEqual(2));
  await info.attach('linear-color-patches',{body:JSON.stringify(patches),contentType:'application/json'});
});
test('Spring navigation settles and reduced motion keeps optical deformation at rest',async({page})=>{
  await page.goto('/lab'); await page.getByRole('button',{name:'dynamic interaction',exact:true}).click();
  await page.getByRole('tab',{name:'You',exact:false}).click();
  await expect(page.getByRole('tab',{selected:true})).toContainText('You');
  await expect.poll(()=>page.evaluate(()=>window.glassLabSamples?.at(-1)?.motionEnergy ?? 0)).toBeGreaterThan(.002);
  await expect.poll(()=>page.evaluate(()=>window.glassLabSamples?.at(-1)?.motionEnergy ?? 0)).toBe(0);
  await page.getByRole('tab',{selected:true}).focus(); await page.keyboard.down('Space');
  await expect.poll(()=>page.evaluate(()=>window.glassLabSamples?.at(-1)?.motionEnergy ?? 0)).toBeGreaterThan(.05);
  await page.keyboard.up('Space');
  await expect.poll(()=>page.evaluate(()=>window.glassLabSamples?.at(-1)?.motionEnergy ?? 0)).toBe(0);
  await page.emulateMedia({reducedMotion:'reduce'}); await page.getByRole('tab',{name:'Calls',exact:false}).click();
  await expect.poll(()=>page.evaluate(()=>window.glassLabSamples?.at(-1)?.motionEnergy ?? 0)).toBe(0);
  await expect(lens(page)).toHaveAttribute('data-glass-renderer','webgl2');
});
test('Live filtering uses fresh base levels and diagnostic overrides match the actual sampler',async({page})=>{
  await page.goto('/lab'); await expect(lens(page)).toHaveAttribute('data-glass-renderer','webgl2');
  await page.getByRole('button',{name:'moving',exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>window.glassLabSamples.at(-1)?.textureFiltering)).toBe('linear');
  for(const mode of ['mipmap','linear']) {
    await page.getByLabel('Source filtering',{exact:true}).selectOption(mode);
    await expect.poll(()=>page.evaluate(()=>window.glassLabSamples.at(-1)?.textureFiltering)).toBe(mode);
    const filter=await lens(page).locator('canvas').evaluate(canvas=>{const gl=(canvas as HTMLCanvasElement).getContext('webgl2')!;return{actual:gl.getTexParameter(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER),linear:gl.LINEAR,mipmap:gl.LINEAR_MIPMAP_LINEAR};});
    expect(filter.actual).toBe(mode==='mipmap'?filter.mipmap:filter.linear);
  }
});
