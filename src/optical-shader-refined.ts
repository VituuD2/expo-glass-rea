/** Independent calibrated surface; the previous shader remains in optical-shader.ts for A/B comparison. */
export const refinedFragmentShader = `#version 300 es
precision highp float;
uniform sampler2D uBackground;
uniform vec2 uResolution,uSize;
uniform vec4 uMapping,uLight,uEffects,uRefinement;
uniform vec3 uFeatures;
uniform int uCount,uDebug;
uniform float uMerge;
uniform float uMipmaps;
uniform vec4 uShapes[16],uRadii[16],uOptics[16],uTints[16],uStates[16],uMotions[16];
out vec4 outColor;
struct Field {
  float d; vec2 g;
  vec4 optics; vec4 tint; vec4 state; vec4 motion;
  float size; float amplitude; vec2 ga; float bevel; vec2 gb;
};
vec3 roundedField(vec2 p,vec4 s,vec4 radii,vec2 stretch) {
  p=(p-s.xy-s.zw*.5)/stretch;
  float r=p.y<0.0?(p.x<0.0?radii.x:radii.y):(p.x<0.0?radii.w:radii.z);
  vec2 q=abs(p)-s.zw*.5+r;
  vec2 positive=max(q,0.0);
  float l=length(positive);
  vec2 gradient=l>.00001?positive/l:(q.x>q.y?vec2(1,0):vec2(0,1));
  gradient*=sign(p);
  float scale=min(stretch.x,stretch.y);
  return vec3((l+min(max(q.x,q.y),0.0)-r)*scale,gradient/stretch*scale);
}
Field field(vec2 p) {
  Field f=Field(1e6,vec2(0),vec4(0),vec4(0),vec4(0),vec4(0),100.0,0.0,vec2(0),16.0,vec2(0));
  for(int i=0;i<16;i++) {
    if(i>=uCount) break;
    if(uStates[i].x<.001) continue;
    vec4 m=uMotions[i];
    vec2 stretch=vec2(1)+abs(m.xy)*.018-vec2(.012,.022)*m.z;
    vec3 dg=roundedField(p,uShapes[i],uRadii[i],stretch);
    float size=min(uShapes[i].z,uShapes[i].w);
    float amplitude=32.0*uOptics[i].x*clamp(sqrt(size/110.0),.65,1.45)*uStates[i].x;
    amplitude*=mix(1.0,.94,uOptics[i].w)*(1.0-.07*m.z+.025*length(m.xy));
    float bevel=clamp(size*mix(.24,.22,uOptics[i].w),10.0,30.0);
    float a=uMerge>.001?clamp(.5+.5*(dg.x-f.d)/uMerge,0.0,1.0):(f.d<dg.x?1.0:0.0);
    vec2 weightGradient=(a>0.0&&a<1.0)?(dg.yz-f.g)/(2.0*uMerge):vec2(0);
    f.ga=a*f.ga+(f.amplitude-amplitude)*weightGradient;
    f.gb=a*f.gb+(f.bevel-bevel)*weightGradient;
    f.amplitude=mix(amplitude,f.amplitude,a);
    f.bevel=mix(bevel,f.bevel,a);
    f.d=mix(dg.x,f.d,a)-uMerge*a*(1.0-a);
    f.g=mix(dg.yz,f.g,a);
    f.optics=mix(uOptics[i],f.optics,a); f.tint=mix(uTints[i],f.tint,a);
    f.state=mix(uStates[i],f.state,a); f.motion=mix(m,f.motion,a); f.size=mix(size,f.size,a);
  }
  return f;
}
vec3 surface(Field f) {
  float q=clamp(-f.d/f.bevel,0.0,1.0);
  float ramp=q*q*q*(q*(q*6.0-15.0)+10.0);
  float derivative=30.0*q*q*(q-1.0)*(q-1.0);
  vec2 gq=(q>0.0&&q<1.0)?-f.g/f.bevel+f.d*f.gb/(f.bevel*f.bevel):vec2(0);
  return vec3(f.amplitude*ramp,f.ga*ramp+f.amplitude*derivative*gq);
}
vec3 encode(vec3 c) { c=clamp(c,0.0,1.0); return mix(c*12.92,1.055*pow(c,vec3(1.0/2.4))-.055,step(vec3(.0031308),c)); }
vec2 uvAt(vec2 p) {
  vec2 texel=.5/vec2(textureSize(uBackground,0));
  return clamp(uMapping.xy+p*uMapping.zw,texel,vec2(1)-texel);
}
// SRGB8_ALPHA8 performs decode before filtering. All material arithmetic below is linear RGB.
vec3 source(vec2 p) { return texture(uBackground,uvAt(p)).rgb; }
vec3 scattering(vec2 p,float radius) {
  if(radius<.65) return source(p);
  // Cached scale-space sample for static scenes; fresh base-level kernel for live sources.
  float lod=max(0.0,log2(max(radius*length(uMapping.zw*vec2(textureSize(uBackground,0)))*.7,1.0)));
  if(uMipmaps>.5) return textureLod(uBackground,uvAt(p),max(lod,.5)).rgb;
  return source(p)*.4+(source(p+vec2(radius*.65,radius*.35))+source(p-vec2(radius*.65,radius*.35))+
    source(p+vec2(-radius*.35,radius*.65))+source(p-vec2(-radius*.35,radius*.65)))*.15;
}
vec2 displacement(vec3 n,float height,float amplitude,float index,float strength) {
  vec3 entry=refract(vec3(0,0,-1),n,1.0/index);
  vec2 delta=height*entry.xy/max(.12,-entry.z);
  if(uRefinement.w>.5) {
    vec3 exitRay=refract(entry,vec3(0,0,1),index);
    if(dot(exitRay,exitRay)>.001) delta+=amplitude*.18*exitRay.xy/max(.12,-exitRay.z);
  }
  delta*=strength;
  return delta*min(1.0,32.0/max(length(delta),.00001));
}
float luminance(vec3 c) { return dot(c,vec3(.2126,.7152,.0722)); }
vec3 spectralRadiance(float phase) {
  // Stylized spectral environment lobe, not a claim of thin-film interference or an Apple kernel.
  vec3 centers=vec3(.18,.48,.78);
  vec3 offset=(vec3(fract(phase))-centers)*4.2;
  vec3 bands=exp(-offset*offset);
  return bands/max(max(bands.r,bands.g),max(bands.b,.001));
}
float segment(vec2 p,vec2 a,vec2 b) { vec2 v=b-a; return length(p-a-v*clamp(dot(p-a,v)/max(dot(v,v),.0001),0.0,1.0)); }
void main() {
  vec2 p=vec2(gl_FragCoord.x,uResolution.y-gl_FragCoord.y)*uSize/uResolution;
  Field f=field(p);
  // Derivatives are computed before divergent exterior branches. The normal itself is analytic.
  float aa=max(fwidth(f.d)*.5,.25*min(uSize.x/uResolution.x,uSize.y/uResolution.y));
  float mask=uRefinement.z>.5?1.0-smoothstep(-aa,aa,f.d):step(f.d,0.0);
  vec3 original=source(p);
  float shadow=0.0;
  if(uFeatures.x>.5&&f.d>-aa&&f.d<26.0) {
    float sd=field(p-vec2(1.5,4.0)).d;
    shadow=(1.0-smoothstep(-2.0,21.0,sd))*(.025+.075*luminance(original))*f.state.x;
  }
  if(f.d>aa) {
    outColor=vec4(0,0,0,shadow); return;
  }
  vec3 h=surface(f);
  vec3 n=normalize(vec3(-h.yz,1));
  float material=f.optics.w;
  float strength=f.optics.y*mix(1.0,.88,material);
  vec2 delta=displacement(n,h.x,f.amplitude,uEffects.x,strength);
  // Fade displacement near the explicit source boundary rather than pulling clamped edge stripes.
  vec2 uv=uMapping.xy+p*uMapping.zw;
  vec2 room=min(uv,1.0-uv)/max(abs(uMapping.zw),vec2(.000001));
  float coverage=smoothstep(0.0,18.0,min(room.x,room.y)); delta*=coverage;
  float blur=f.optics.z*mix(1.6,5.5,material)*uEffects.w;
  vec3 color=scattering(p+delta,blur);
  if(uEffects.y>.001) {
    float spread=uEffects.y*.012;
    vec2 dr=displacement(n,h.x,f.amplitude,max(1.0,uEffects.x-spread),strength)*coverage;
    vec2 db=displacement(n,h.x,f.amplitude,min(2.0,uEffects.x+spread*1.3),strength)*coverage;
    dr=delta+clamp(dr-delta,vec2(-.7),vec2(.7)); db=delta+clamp(db-delta,vec2(-.7),vec2(.7));
    color.r=scattering(p+dr,blur).r; color.b=scattering(p+db,blur).b;
  }
  float density=max(length(uMapping.zw*vec2(textureSize(uBackground,0))),.001);
  float ambientLOD=max(0.0,log2(max(density*clamp(f.size*.08,8.0,24.0),1.0)));
  vec3 ambient=uMipmaps>.5?textureLod(uBackground,uvAt(p),ambientLOD).rgb:
    (source(p+vec2(16,0))+source(p-vec2(16,0))+source(p+vec2(0,16))+source(p-vec2(0,16)))*.25;
  float y=luminance(ambient),contrast=abs(luminance(original)-y);
  float backing=mix(.018,.115,material)+uFeatures.y*(.014+contrast*mix(.09,.22,material))+uFeatures.z*.16;
  vec3 backingColor=mix(vec3(.012,.018,.025),vec3(1),f.state.z);
  color=mix(color,backingColor,min(backing,.52));
  vec3 transmission=exp(-(1.0-f.tint.rgb)*f.tint.a*h.x/48.0);
  color=color*transmission+f.tint.rgb*(1.0-transmission)*.16;
  color=mix(color,f.tint.rgb,f.tint.a*mix(.025,.055,material));
  float f0=pow((uEffects.x-1.0)/(uEffects.x+1.0),2.0);
  float nv=max(n.z,.001),fresnel=f0+(1.0-f0)*pow(1.0-nv,5.0);
  vec3 light=normalize(vec3((uLight.xy-p)/max(f.size,70.0),1.8));
  vec3 halfVector=normalize(light+vec3(0,0,1));
  float nl=max(dot(n,light),.001),nh=max(dot(n,halfVector),0.0);
  float alpha=mix(.13,.44,f.optics.z),alpha2=alpha*alpha;
  float denominator=nh*nh*(alpha2-1.0)+1.0;
  float D=alpha2/(3.14159265*denominator*denominator);
  float k=pow(alpha+1.0,2.0)/8.0;
  float visibility=(nv/(nv*(1.0-k)+k))*(nl/(nl*(1.0-k)+k));
  float specular=D*visibility*fresnel/max(4.0*nv,.01);
  vec2 direction=normalize(light.xy+vec2(.00001));
  float orientation=pow(max(dot(f.g,direction),0.0),5.0);
  float inset=max(-f.d,0.0),rimOffset=(inset-.7)/(.5+f.optics.z*.7),rim=exp(-rimOffset*rimOffset);
  float rimRadiance=rim*(.006+.065*orientation)*uRefinement.y;
  float energy=1.0+f.motion.w*.16+f.motion.z*.22;
  float shine=(1.0-exp(-specular*3.0))*mix(.2,.16,material);
  vec3 env=mix(vec3(.48,.55,.64),ambient,.65);
  color=mix(color,env,fresnel*uEffects.z*.55);
  vec3 highlight=vec3(shine*uEffects.z+rimRadiance)*(f0/.04)*energy;
  if(uRefinement.x>.001&&nv<.999&&inset<f.bevel*.95) {
    float arcOffset=(inset-f.bevel*.38)/max(f.bevel*.19,1.0),arc=exp(-arcOffset*arcOffset);
    float directional=orientation+.25*pow(max(dot(f.g,-direction),0.0),7.0);
    float phase=atan(f.g.y,f.g.x)/6.2831853+.5+.12*light.x+.08*n.x;
    highlight+=spectralRadiance(phase)*uRefinement.x*arc*directional*(1.0-nv)*.22*(f0/.04)*energy;
  }
  // Bounded screen-referred blend: no hard white clipping, HDR or P3 claim.
  color+=(1.0-color)*clamp(highlight,0.0,.65);
  if(uDebug==1) color=n*.5+.5;
  if(uDebug==2) {
    color=vec3(.5+delta.x/64.0,.5+delta.y/64.0,.15);
    vec2 origin=(floor(p/22.0)+.5)*22.0,tip=origin+delta*2.0;
    vec2 dir=delta/max(length(delta),.001),side=vec2(-dir.y,dir.x);
    float line=min(segment(p,origin,tip),min(segment(p,tip,tip-dir*4.0+side*3.0),segment(p,tip,tip-dir*4.0-side*3.0)));
    color=mix(color,vec3(.95),1.0-smoothstep(.35,.35+aa,line));
  }
  if(uDebug==3) color=vec3(mask,clamp(h.x/32.0,0.0,1.0),fresnel);
  float glassAlpha=mask*f.state.x,coverageAlpha=glassAlpha+shadow*(1.0-glassAlpha);
  outColor=vec4(encode(color)*glassAlpha/max(coverageAlpha,.00001),coverageAlpha);
}`;
