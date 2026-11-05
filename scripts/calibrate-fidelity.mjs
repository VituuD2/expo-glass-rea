import { chromium } from '@playwright/test';
import { mkdir,writeFile } from 'node:fs/promises';
import { refinedSurface,refinedDisplacement,surfaceHeight,heightNormal,roundedRectDistance,projectedDisplacement } from '../dist/optics.js';
const folder='docs/verification/fidelity'; await mkdir(folder,{recursive:true});
const browser=await chromium.launch();
const captures=[];
try {
  const page=await browser.newPage({viewport:{width:1440,height:1100},deviceScaleFactor:2,reducedMotion:'reduce'});
  await page.goto('http://127.0.0.1:4173/lab');
  await page.getByRole('checkbox',{name:'Motion response',exact:true}).uncheck();
  for(const scene of ['grid','typography','photograph','dark navigation','light navigation','pixel quality']) {
    await page.getByRole('button',{name:scene,exact:true}).click();
    for(const mode of ['legacy','single','two-interface']) {
      await page.getByLabel('Surface profile',{exact:true}).selectOption(mode==='legacy'?'legacy':'refined');
      await page.getByLabel('Ray model',{exact:true}).selectOption(mode==='two-interface'?'two-interface':'single');
      const lens=page.getByTestId('optical-lens'); await lens.locator('canvas').waitFor();
      await page.waitForFunction(()=>document.querySelector('[data-testid="optical-lens"]')?.dataset.glassRenderer==='webgl2');
      await page.waitForTimeout(200);
      const file=`${scene.replaceAll(' ','-')}-${mode}.png`;
      await page.getByTestId('optical-stage').screenshot({path:`${folder}/${file}`});
      captures.push({scene,mode,file,diagnostics:await page.evaluate(()=>window.glassLabSamples.at(-1))});
    }
  }
  const shape={x:0,y:0,width:290,height:240,radii:[32,32,32,32]};
  const oldHeight=(x,y)=>surfaceHeight(roundedRectDistance(x,y,shape),240,.5);
  const metrics=[];
  for(const mode of ['legacy','single','two-interface']) {
    let maxDisplacement=0,maxAdjacentChange=0,previous;
    for(let x=0;x<=290;x+=.1) {
      const delta=mode==='legacy'?projectedDisplacement(heightNormal(oldHeight,x,120),oldHeight(x,120)):refinedDisplacement(refinedSurface(x,120,[shape]),1.48,.6,mode);
      maxDisplacement=Math.max(maxDisplacement,Math.hypot(...delta));
      if(previous)maxAdjacentChange=Math.max(maxAdjacentChange,Math.hypot(delta[0]-previous[0],delta[1]-previous[1])); previous=delta;
    }
    metrics.push({mode,maxDisplacementCssPx:maxDisplacement,maxChangePerTenthCssPx:maxAdjacentChange});
  }
  await writeFile(`${folder}/calibration.json`,JSON.stringify({capturedAt:new Date().toISOString(),browser:browser.version(),devicePixelRatio:2,notes:'Aligned static stage captures, reduced motion, same explicit canvas scene. Apple footage is unaligned/compressed and is not used for pixel metrics. CPU model scan is not native optical ground truth.',metrics,captures},null,2)+'\n');
  console.log(JSON.stringify(metrics,null,2));
}finally{await browser.close();}
