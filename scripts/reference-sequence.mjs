import { chromium } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
const browser=await chromium.launch();
try {
  const page=await browser.newPage();
  await page.goto('http://127.0.0.1:4173/docs/references/WhatsApp%20Video%202026-11-04%20at%207.58.14%20PM.mp4');
  const result=await page.evaluate(async()=>{
    const video=document.querySelector('video'); video.pause(); video.muted=true;
    if(video.readyState<1)await new Promise(resolve=>video.onloadedmetadata=resolve);
    await new Promise(resolve=>{video.onseeked=resolve;video.currentTime=2.8;});
    const canvas=document.createElement('canvas');canvas.width=1696;canvas.height=590;const c=canvas.getContext('2d');
    c.fillStyle='#161616';c.fillRect(0,0,canvas.width,canvas.height);
    const samples=[];
    await new Promise(resolve=>{
      const capture=(_,metadata)=>{
        const i=samples.length,x=i%4*424,y=Math.floor(i/4)*118;
        c.drawImage(video,x,y,424,96);c.fillStyle='white';c.font='12px monospace';c.fillText(`${metadata.mediaTime.toFixed(4)} s / frame ${metadata.presentedFrames}`,x+8,y+112);
        samples.push({mediaTime:metadata.mediaTime,presentedFrames:metadata.presentedFrames});
        if(samples.length>=20){video.pause();resolve();}else video.requestVideoFrameCallback(capture);
      };
      video.requestVideoFrameCallback(capture);void video.play();
    });
    return{samples,sheet:canvas.toDataURL('image/png')};
  });
  await writeFile('docs/verification/fidelity/reference-sequence.png',Buffer.from(result.sheet.split(',')[1],'base64'));
  await writeFile('docs/verification/fidelity/reference-sequence.json',JSON.stringify({method:'20 consecutive requestVideoFrameCallback deliveries after seeking to 2.8 s; original aspect ratio retained. presentedFrames can audit skipped display deliveries.',samples:result.samples},null,2)+'\n');
  console.log(JSON.stringify(result.samples));
}finally{await browser.close();}
