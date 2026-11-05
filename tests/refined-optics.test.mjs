import { test } from 'node:test';
import assert from 'node:assert/strict';
import { refinedSurface, refinedDisplacement, normalize3 } from '../dist/optics.js';
import { springStep } from '../dist/dynamics.js';
const shape = { x: 0, y: 0, width: 200, height: 120, radii: [32, 32, 32, 32] };
const close = (x,y,e=1e-6) => assert.ok(Math.abs(x-y)<e, `${x} != ${y}`);

test('Refined analytic normals match numerical gradients, including mixed-material smooth unions', () => {
  const groups = [[shape], [{ ...shape, width: 80, height: 80, radii: [40,40,40,40] }, { ...shape, x: 96, width: 90, height: 100, thickness: .7, regular: 1, radii: [40,40,40,40] }]];
  for (const shapes of groups) for (let x=2;x<180;x+=2.3) for (const y of [8,13,32,50,73]) {
    const f = refinedSurface(x,y,shapes,56), eps=.0001;
    const hx = (refinedSurface(x+eps,y,shapes,56).height-refinedSurface(x-eps,y,shapes,56).height)/(2*eps);
    const hy = (refinedSurface(x,y+eps,shapes,56).height-refinedSurface(x,y-eps,shapes,56).height)/(2*eps);
    const numerical = normalize3([-hx,-hy,1]);
    for(let i=0;i<3;i++) close(f.normal[i], numerical[i], 2e-5);
    close(Math.hypot(...f.normal),1);
  }
});
test('Refined projection is bounded, continuous and zero for no optical interface', () => {
  for (const model of ['single','two-interface']) {
    let previous;
    for(let x=0;x<=200;x+=.1) {
      const f=refinedSurface(x,60,[shape]), d=refinedDisplacement(f,1.48,.6,model);
      assert.ok(d.every(Number.isFinite)); assert.ok(Math.hypot(...d)<=32);
      if(previous) assert.ok(Math.hypot(d[0]-previous[0],d[1]-previous[1])<.3);
      for(const value of refinedDisplacement(f,1,.6,model)) close(value,0);
      for(const value of refinedDisplacement(f,1.48,0,model)) close(value,0);
      previous=d;
    }
    assert.deepEqual(refinedDisplacement(refinedSurface(100,60,[shape]),1.48,.6,model),[0,0]);
  }
});
test('C2 height profile has stable center and vanishing slope at bevel endpoints', () => {
  const center=refinedSurface(100,60,[shape]); center.normal.forEach((n,i)=>close(n,i===2?1:0));
  close(refinedSurface(0,60,[shape]).height,0);
  const a=refinedSurface(.00001,60,[shape]); assert.ok(Math.abs(a.normal[0])<1e-8);
});
test('Exact damped spring is stable across 60/120 Hz, long pauses and release', () => {
  let a={value:0,velocity:0}, b={value:0,velocity:0};
  for(let i=0;i<30;i++) a=springStep(a,1,1/60,22);
  for(let i=0;i<60;i++) b=springStep(b,1,1/120,22);
  close(a.value,b.value); close(a.velocity,b.velocity);
  assert.ok(a.value<=1&&a.value>.999);
  for(let i=0;i<100;i++) a=springStep(a,0,i===0?100:1/60,22);
  assert.deepEqual(a,{value:0,velocity:0});
  assert.ok(Number.isFinite(springStep({value:.5,velocity:2},0,NaN).value));
});
