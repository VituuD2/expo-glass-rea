import { chromium } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
const browser=await chromium.launch(),results=[];
try {
  const page=await browser.newPage({viewport:{width:1440,height:1100},deviceScaleFactor:1});await page.goto('http://127.0.0.1:4173/lab');
  await page.getByRole('checkbox',{name:'Motion response',exact:true}).uncheck();await page.getByRole('button',{name:'moving',exact:true}).click();
  for(const mode of ['full','no-spectrum','no-scattering','no-reflection']) {
    await page.getByRole('slider',{name:'Spectral edge light',exact:true}).fill(mode==='full'?'0.16':'0');
    await page.getByRole('checkbox',{name:'Scattering',exact:true}).setChecked(!['no-scattering','no-reflection'].includes(mode));
    await page.getByRole('checkbox',{name:'Reflection',exact:true}).setChecked(mode!=='no-reflection');
    await page.locator('[data-testid="optical-lens"][data-glass-renderer="webgl2"]').waitFor();
    const intervals=await page.evaluate(async()=>{for(let i=0;i<12;i++)await new Promise(requestAnimationFrame);const d=[];let prev=performance.now();for(let i=0;i<32;i++){const t=await new Promise(requestAnimationFrame);d.push(t-prev);prev=t;}return d.slice(1).sort((a,b)=>a-b);});
    const diagnostics=await page.evaluate(()=>({renderer:document.querySelector('[data-testid="optical-lens"]').dataset.glassRenderer,filter:window.glassLabSamples.at(-1)?.textureFiltering}));
    if(diagnostics.renderer!=='webgl2')throw Error('Fallback invalidates the optical benchmark');
    results.push({mode,...diagnostics,p50:intervals[Math.floor(intervals.length*.5)],p95:intervals[Math.floor(intervals.length*.95)]});console.log(results.at(-1));
  }
  await writeFile('docs/verification/fidelity/ablation.json',JSON.stringify(results,null,2)+'\n');
}finally{await browser.close();}
