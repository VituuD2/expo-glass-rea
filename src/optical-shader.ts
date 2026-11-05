export const vertexShader = `#version 300 es
void main() {
  vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

export const fragmentShader = `#version 300 es
precision highp float;
uniform sampler2D uBackground;
uniform vec2 uResolution, uSize;
// canvas-local CSS pixel -> source UV, including source/host scrolling and positive scaling
uniform vec4 uMapping;
uniform int uCount, uDebug;
uniform vec4 uShapes[16], uRadii[16], uOptics[16], uTints[16], uStates[16];
uniform vec4 uLight;
uniform vec4 uEffects; // index, dispersion, reflection, scattering
uniform vec3 uFeatures; // shadow, adaptive, increased contrast
uniform float uMerge;
out vec4 outColor;
struct Field { float d; vec4 optics; vec4 tint; vec4 state; float size; };
float roundedRect(vec2 p, vec4 s, vec4 radii) {
  p -= s.xy + s.zw * .5;
  float r = p.y < 0.0 ? (p.x < 0.0 ? radii.x : radii.y) : (p.x < 0.0 ? radii.w : radii.z);
  vec2 q = abs(p) - s.zw * .5 + r;
  return length(max(q,0.0)) + min(max(q.x,q.y),0.0) - r;
}
Field field(vec2 p) {
  Field f = Field(1e6, vec4(0), vec4(0), vec4(0), 100.0);
  for (int i=0; i<16; i++) {
    if (i >= uCount) break;
    if (uStates[i].x <= .001) continue;
    float d = roundedRect(p, uShapes[i], uRadii[i]);
    float h = uMerge > .001 ? clamp(.5 + .5*(d-f.d)/uMerge,0.0,1.0) : (f.d < d ? 1.0 : 0.0);
    f.d = mix(d,f.d,h) - uMerge*h*(1.0-h);
    f.optics = mix(uOptics[i],f.optics,h);
    f.tint = mix(uTints[i],f.tint,h);
    f.state = mix(uStates[i],f.state,h);
    f.size = mix(min(uShapes[i].z,uShapes[i].w),f.size,h);
  }
  return f;
}
float heightOf(Field f) {
  float H = 48.0*f.optics.x*clamp(sqrt(f.size/100.0),.6,1.8)*f.state.x;
  H *= 1.0 - .1*uLight.w*f.state.y;
  return H*smoothstep(0.0,clamp(f.size*.2,8.0,32.0),-f.d);
}
vec3 toLinear(vec3 c) { return mix(c/12.92,pow((c+.055)/1.055,vec3(2.4)),step(vec3(.04045),c)); }
vec3 toSrgb(vec3 c) { c=max(c,vec3(0)); return mix(c*12.92,1.055*pow(c,vec3(1.0/2.4))-.055,step(vec3(.0031308),c)); }
vec3 source(vec2 p) { return toLinear(texture(uBackground,clamp(uMapping.xy + p*uMapping.zw,vec2(0),vec2(1))).rgb); }
float luminance(vec3 c) { return dot(c,vec3(.2126,.7152,.0722)); }
float segment(vec2 p, vec2 a, vec2 b) {
  vec2 v=b-a; return length(p-a-v*clamp(dot(p-a,v)/max(dot(v,v),.0001),0.0,1.0));
}
void main() {
  vec2 p=vec2(gl_FragCoord.x,uResolution.y-gl_FragCoord.y)*uSize/uResolution;
  Field f=field(p);
  float h=heightOf(f);
  // Raster derivatives evaluate the shared height once per fragment, instead of five SDF traversals.
  // gl_FragCoord.y increases upward while the material's y increases downward.
  vec3 n=normalize(vec3(-dFdx(h)*uResolution.x/uSize.x,dFdy(h)*uResolution.y/uSize.y,1));
  float aa=max(uSize.x/uResolution.x,.65);
  float mask=1.0-smoothstep(-aa,aa,f.d);
  vec3 original=source(p);
  if (f.d>2.0*aa) {
    if (uFeatures.x<.5 || f.d>30.0) { outColor=vec4(0); return; }
    float sd=field(p-vec2(2,7)).d;
    float shadow=(1.0-smoothstep(-4.0,24.0,sd))*(.07+.16*luminance(original))*f.state.x;
    outColor=vec4(0,0,0,shadow); return;
  }
  vec3 ray=refract(vec3(0,0,-1),n,1.0/uEffects.x);
  vec2 delta=ray.xy/max(.1,-ray.z)*h*f.optics.y;
  delta*=min(1.0,64.0/max(length(delta),.0001));
  vec2 sampleAt=p+delta;
  vec3 color=source(sampleAt);
  float blur=f.optics.z*(f.optics.w>.5 ? 6.0 : 2.0)*uEffects.w;
  if (blur>.001) {
    color=color*.4+(source(sampleAt+vec2(blur,0))+source(sampleAt-vec2(blur,0))
      +source(sampleAt+vec2(0,blur))+source(sampleAt-vec2(0,blur)))*.15;
  }
  if (uEffects.y>.001) {
    vec2 chrom=delta/max(length(delta),.0001)*uEffects.y*min(length(delta)/10.0,1.0);
    color.r=source(sampleAt+chrom).r; color.b=source(sampleAt-chrom).b;
  }
  // Continuous spatial adaptation; no binary light/dark flipping or readback of DOM pixels.
  vec3 ambient=(source(p+vec2(18,0))+source(p-vec2(18,0))+source(p+vec2(0,18))+source(p-vec2(0,18)))*.25;
  float y=luminance(ambient);
  float contrast=abs(luminance(original)-y);
  float backing=mix(.045,.19,f.optics.w) + uFeatures.y*(.08+contrast*.35) + uFeatures.z*.18;
  vec3 backingColor=mix(vec3(.018,.027,.04),vec3(1),f.state.z);
  color=mix(color,backingColor,clamp(backing,0.0,.65));
  // Beer-Lambert artistic absorption from resolved tint; CSS alpha controls density.
  vec3 transmission=exp(-(vec3(1)-f.tint.rgb)*f.tint.a*h/48.0);
  color=color*transmission+f.tint.rgb*(vec3(1)-transmission)*.2;
  float f0=pow((uEffects.x-1.0)/(uEffects.x+1.0),2.0);
  float fresnel=f0+(1.0-f0)*pow(1.0-clamp(n.z,0.0,1.0),5.0);
  vec3 light=normalize(vec3((uLight.xy-p)/max(f.size,60.0),1.5));
  vec3 halfway=normalize(light+vec3(0,0,1));
  float spec=pow(max(dot(n,halfway),0.0),mix(160.0,14.0,f.optics.z));
  float rim=1.0-smoothstep(0.0,6.0,-f.d);
  float energy=1.0+uLight.z*f.state.y*.45+uLight.w*f.state.y*.4;
  vec3 reflection=mix(vec3(.68,.80,.95),ambient,.18);
  color=mix(color,reflection,fresnel*uEffects.z);
  color+=(spec*.14+rim*max(dot(n,light),0.0)*.17)*energy*uEffects.z*(f0/.04);
  if (uDebug==1) color=n*.5+.5;
  if (uDebug==2) {
    color=vec3(.5+delta.x/128.0,.5+delta.y/128.0,.18);
    vec2 origin=(floor(p/22.0)+.5)*22.0;
    // Vectors are local samples of this smooth field; length is exaggerated for readability.
    vec2 tip=origin+delta*1.8;
    vec2 dir=delta/max(length(delta),.001), side=vec2(-dir.y,dir.x);
    float line=min(segment(p,origin,tip),min(segment(p,tip,tip-dir*4.0+side*3.0),segment(p,tip,tip-dir*4.0-side*3.0)));
    color=mix(color,vec3(.95),1.0-smoothstep(.4,1.1,line));
  }
  if (uDebug==3) color=vec3(mask,clamp(h/48.0,0.0,1.0),fresnel);
  outColor=vec4(toSrgb(color),mask*f.state.x);
}`;
