import { chromium } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import os from 'node:os';
const summarize = values => {
  const sorted=values.filter(Number.isFinite).sort((a,b)=>a-b),get=p=>sorted.length?sorted[Math.min(sorted.length-1,Math.floor(p*sorted.length))]:null;
  return {count:sorted.length,p50:get(.5),p95:get(.95),max:sorted.at(-1)??null};
};
const browser=await chromium.launch();
const result={capturedAt:new Date().toISOString(),platform:`${os.platform()} ${os.release()} ${os.arch()}`,cpu:os.cpus()[0]?.model,browser:browser.version(),method:'Headless Chromium, 1440x1100 viewport. 24 RAF warmup then 80 sampled callbacks (79 intervals). High quality, motion off for moving-source cases; actual spring navigation for static-source cases. Timer queries are draw-only, uploadCpuMs is submission-only; total RAF cadence includes all browser work. No test-only readPixels instrumentation.',cases:[]};
try {
  const cases=[];
  for(const dpr of [1,2])for(const shapes of [2,16])for(const profile of ['legacy','refined'])cases.push({dpr,shapes,profile,scene:'moving'});
  for(const profile of ['legacy','refined'])cases.push({dpr:2,shapes:1,profile,scene:'dark navigation'});
  for(const scenario of cases) {
    const page=await browser.newPage({viewport:{width:1440,height:1100},deviceScaleFactor:scenario.dpr});
    await page.goto('http://127.0.0.1:4173/lab');
    await page.getByLabel('Surface profile',{exact:true}).selectOption(scenario.profile);
    await page.waitForFunction(()=>document.querySelector('[data-testid="optical-lens"]')?.dataset.glassRenderer==='webgl2');
    if(scenario.scene==='moving')await page.getByRole('checkbox',{name:'Motion response',exact:true}).uncheck();
    if(scenario.shapes===16)await page.getByTestId('optical-merge').evaluate(group=>{
      const template=group.querySelector('[data-glass-view]');for(let i=2;i<16;i++)group.appendChild(template.cloneNode(true));
      group.querySelectorAll('[data-glass-view]').forEach((view,i)=>Object.assign(view.style,{width:'48px',height:'48px',left:`${12+i%8*96}px`,top:`${4+Math.floor(i/8)*54}px`}));
    });
    await page.getByRole('button',{name:scenario.scene,exact:true}).click();
    const sample=await page.evaluate(async navigation=>{
      for(let i=0;i<24;i++)await new Promise(requestAnimationFrame);
      window.glassLabSamples=[];window.glassLabGroupSamples=[];
      let last=performance.now();const intervals=[];
      for(let i=0;i<80;i++){
        if(navigation&&i%20===0)document.querySelectorAll('[role="tab"]')[(i/20+1)%4].click();
        const now=await new Promise(requestAnimationFrame);intervals.push(now-last);last=now;
      }
      const gl=document.querySelector('[data-testid="optical-lens"] canvas').getContext('webgl2'),ext=gl.getExtension('WEBGL_debug_renderer_info');
      const unique=values=>[...new Map(values.map(s=>[s.frames,s])).values()];
      return{intervals:intervals.slice(1),lens:unique(window.glassLabSamples),group:unique(window.glassLabGroupSamples),renderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER)};
    },scenario.scene!=='moving');
    if(scenario.scene==='moving')await page.getByRole('button',{name:'grid',exact:true}).click();
    await page.mouse.move(0,0);await page.waitForTimeout(650);
    await page.evaluate(()=>{window.glassLabSamples=[];window.glassLabGroupSamples=[];});await page.waitForTimeout(250);
    const idle=await page.evaluate(()=>({lens:window.glassLabSamples.length,group:window.glassLabGroupSamples.length}));
    const entry={...scenario,renderer:sample.renderer,rafMs:summarize(sample.intervals),lensCpuMs:summarize(sample.lens.map(s=>s.cpuMs)),groupCpuMs:summarize(sample.group.map(s=>s.cpuMs)),lensUploadCpuMs:summarize(sample.lens.map(s=>s.uploadCpuMs)),lensGpuMs:summarize(sample.lens.map(s=>s.gpuMs)),groupGpuMs:summarize(sample.group.map(s=>s.gpuMs)),estimatedBytes:(sample.lens.at(-1)?.estimatedBytes??0)+(scenario.shapes>1?(sample.group.at(-1)?.estimatedBytes??0):0),effectivePixelRatio:sample.lens.at(-1)?.pixelRatio,idleCallbacks250ms:idle};
    result.cases.push(entry);await writeFile('docs/verification/fidelity/benchmark.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(entry));await page.close();
  }
}finally{await browser.close();}
