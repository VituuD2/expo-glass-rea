import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GlassContainer, GlassView, type GlassBackgroundSource, type GlassDebugView, type GlassRenderingMode, type GlassRenderStats, type GlassStyle } from '../src/index';
import './optical-lab.css';
import { springStep } from '../src/dynamics';
import referenceVideo from '../docs/references/WhatsApp Video 2026-11-04 at 7.58.14 PM.mp4?url';

declare global { interface Window { glassLabSamples: GlassRenderStats[]; glassLabGroupSamples: GlassRenderStats[] } }
const scenes = ['grid', 'checkerboard', 'typography', 'photograph', 'moving', 'scrolling text', 'dark navigation', 'light navigation', 'dynamic interaction', 'pixel quality', 'color patches'] as const;
type Scene = typeof scenes[number];

export function OpticalLab() {
  const stage = useRef<HTMLDivElement>(null), backdrop = useRef<HTMLCanvasElement>(null), scroll = useRef<HTMLDivElement>(null);
  const listeners = useRef(new Set<() => void>());
  const [scene, setScene] = useState<Scene>('grid');
  const [shape, setShape] = useState('card');
  const [mode, setMode] = useState<GlassRenderingMode>('auto');
  const [quality, setQuality] = useState<'auto' | 'high' | 'low'>('high');
  const [profile, setProfile] = useState<'refined' | 'legacy'>('refined');
  const [model, setModel] = useState<'single' | 'two-interface'>('single');
  const [edgeSpectrum, setEdgeSpectrum] = useState(.16), [edgeLight, setEdgeLight] = useState(true);
  const [antialiasing, setAntialiasing] = useState(true), [motion, setMotion] = useState(true);
  const [resolutionScale, setResolutionScale] = useState(1), [maxPixelRatio, setMaxPixelRatio] = useState(2);
  const [textureFiltering, setTextureFiltering] = useState<'auto' | 'mipmap' | 'linear'>('auto');
  const [compare, setCompare] = useState(false), [tint, setTint] = useState('#ffffff');
  const [tintDensity, setTintDensity] = useState(0);
  const [selected, setSelected] = useState(0), [indicator, setIndicator] = useState(0);
  const indicatorSpring = useRef({ value: 0, velocity: 0 });
  const navLabels = ['Updates', 'Calls', 'Chats', 'You'];
  const isNav = scene.includes('navigation') || scene === 'dynamic interaction';
  const isDark = scene === 'dark navigation' || scene === 'dynamic interaction';
  const metricsKey = useRef('');
  const [variant, setVariant] = useState<GlassStyle>('clear');
  const [thickness, setThickness] = useState(.5), [strength, setStrength] = useState(.6), [roughness, setRoughness] = useState(.2);
  const [index, setIndex] = useState(1.48), [dispersion, setDispersion] = useState(0);
  const [debug, setDebug] = useState<GlassDebugView>('none');
  const [reflection, setReflection] = useState(true), [scattering, setScattering] = useState(true), [adaptive, setAdaptive] = useState(true), [shadows, setShadows] = useState(true);
  const [gap, setGap] = useState(16), [merge, setMerge] = useState(28);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [mounted, setMounted] = useState(true), [generation, setGeneration] = useState(0);
  const [stats, setStats] = useState<GlassRenderStats | null>(null), [clicked, setClicked] = useState(0);
  const drag = useRef<{ x: number; y: number; px: number; py: number } | null>(null);
  const source = useMemo<GlassBackgroundSource>(() => ({
    getSource: () => backdrop.current,
    getRect: () => backdrop.current?.getBoundingClientRect() ?? { left: 0, top: 0, width: 0, height: 0 },
    subscribe: invalidate => { listeners.current.add(invalidate); return () => { listeners.current.delete(invalidate); }; },
  }), []);
  const record = useCallback((sample: GlassRenderStats) => {
    (window.glassLabSamples ??= []).push(sample);
    if (window.glassLabSamples.length > 600) window.glassLabSamples.shift();
    const key = `${sample.activeRenderer}:${sample.fallbackReason}:${sample.canvasPixelWidth}:${sample.canvasPixelHeight}:${sample.qualityLevel}:${sample.shaderCompilationStatus}:${sample.textureFiltering}`;
    if (sample.frames === 1 || sample.frames % 20 === 0 || key !== metricsKey.current) { metricsKey.current = key; setStats(sample); }
  }, []);

  useEffect(() => {
    let frame = 0, last = performance.now();
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    const step = (now: number) => {
      if (reduced.matches || !motion) { indicatorSpring.current = { value: selected, velocity: 0 }; setIndicator(selected); return; }
      const next = springStep(indicatorSpring.current, selected, (now - last) / 1000, 22); last = now;
      indicatorSpring.current = next;
      if (Math.abs(next.value - selected) < .0005 && Math.abs(next.velocity) < .005) { setIndicator(selected); return; }
      setIndicator(next.value); frame = requestAnimationFrame(step);
    };
    const restart = () => { cancelAnimationFrame(frame); last = performance.now(); frame = requestAnimationFrame(step); };
    reduced.addEventListener('change', restart); restart();
    return () => { cancelAnimationFrame(frame); reduced.removeEventListener('change', restart); };
  }, [selected, motion]);
  const recordGroup = useCallback((sample: GlassRenderStats) => {
    (window.glassLabGroupSamples ??= []).push(sample);
    if (window.glassLabGroupSamples.length > 600) window.glassLabGroupSamples.shift();
  }, []);

  useEffect(() => {
    const canvas = backdrop.current!, c = canvas.getContext('2d')!, scroller = scroll.current!;
    const photo = new Image(); photo.src = '/alpine.jpg';
    let frame = 0, last = 0;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    let inView = true;
    const paint = (time = 0) => {
      const rect = canvas.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, maxPixelRatio);
      const width = Math.round(rect.width * dpr), height = Math.round(rect.height * dpr);
      if (!width || !height) return;
      if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
      const w = rect.width, h = rect.height;
      c.setTransform(dpr, 0, 0, dpr, 0, 0); c.fillStyle = '#ecf1f0'; c.fillRect(0, 0, w, h);
      const offset = scene === 'moving' && !reduced.matches ? time * .035 % 32 : 0;
      if (scene === 'photograph' && photo.complete && photo.naturalWidth) c.drawImage(photo, 0, 0, w, h);
      else if (isNav) {
        c.fillStyle = isDark ? '#111619' : '#e5ebe8'; c.fillRect(0, 0, w, h);
        c.fillStyle = isDark ? '#293f37' : '#b9d6ca'; c.fillRect(w * .04, 65, w * .38, 200);
        if (photo.complete && photo.naturalWidth) { c.globalAlpha = .42; c.drawImage(photo, w * .54, 45, w * .42, 260); c.globalAlpha = 1; }
        c.font = '600 32px system-ui'; c.fillStyle = isDark ? '#c7d7d1' : '#37554c';
        for (let y = 100; y < 340; y += 60) c.fillText('Messages / Design / Today', 24, y);
        c.fillStyle = isDark ? '#202725e8' : '#f2f7f1dc';
        c.beginPath(); c.roundRect(w * .08, 180, w * .84, 84, 42); c.fill();
        c.strokeStyle = isDark ? '#ffffff18' : '#244a3622'; c.lineWidth = 1; c.stroke();
      }
      else if (scene === 'color patches') {
        const colors = ['#000000', '#808080', '#ffffff', '#ff0000', '#00ff00', '#0000ff'];
        colors.forEach((color, i) => { c.fillStyle = color; c.fillRect(i * w / 6, 0, w / 6 + 1, h * .65); });
        const ramp = c.createLinearGradient(0, 0, w, 0); ramp.addColorStop(0, '#000'); ramp.addColorStop(1, '#fff');
        c.fillStyle = ramp; c.fillRect(0, h * .65, w, h * .35);
      }
      else if (scene === 'pixel quality') {
        c.fillStyle = '#f1f3ee'; c.fillRect(0, 0, w, h); c.save(); c.translate(w / 2, h / 2); c.rotate(.25);
        c.strokeStyle = '#162e3a'; c.lineWidth = .7; c.beginPath();
        for (let x = -w; x < w; x += 4) { c.moveTo(x, -h); c.lineTo(x, h); } c.stroke(); c.restore();
      }
      else if (scene === 'typography' || scene === 'scrolling text') {
        c.fillStyle = '#17302f'; c.font = '13px monospace';
        const dy = scene === 'scrolling text' ? scroller.scrollTop : 0;
        for (let y = 12 - dy % 25; y < h; y += 25) c.fillText('0123456789   The light bends; the foreground stays clear.   ABCDEFGHIJKLMNOPQRSTUVWXYZ', 12, y);
      } else {
        for (let x = -32 + offset; x < w; x += 32) for (let y = -32; y < h; y += 32) {
          if (scene === 'checkerboard') { c.fillStyle = (Math.round((x - offset) / 32) + Math.round(y / 32)) % 2 ? '#192d36' : '#f5f5ef'; c.fillRect(x, y, 32, 32); }
        }
        if (scene !== 'checkerboard') {
          c.strokeStyle = '#273e4d'; c.lineWidth = 1.5;
          c.beginPath(); for (let x = offset; x < w; x += 32) { c.moveTo(x, 0); c.lineTo(x, h); }
          for (let y = 0; y < h; y += 32) { c.moveTo(0, y); c.lineTo(w, y); } c.stroke();
          c.strokeStyle = '#d44839'; c.lineWidth = 2; c.beginPath(); c.moveTo(w * .5, 0); c.lineTo(w * .5, h); c.moveTo(0, h * .42); c.lineTo(w, h * .42); c.stroke();
        }
      }
      listeners.current.forEach(invalidate => invalidate());
    };
    const tick = (time: number) => {
      frame = 0;
      if (scene !== 'moving' || reduced.matches || document.hidden || !inView) return;
      if (time - last >= 1000 / 60 - .5) { paint(time); last = time; }
      frame = requestAnimationFrame(tick);
    };
    const restart = () => { cancelAnimationFrame(frame); paint(); if (scene === 'moving' && !reduced.matches && !document.hidden && inView) frame = requestAnimationFrame(tick); };
    const resize = new ResizeObserver(restart); resize.observe(canvas);
    const observer = new IntersectionObserver(([entry]) => { inView = entry.isIntersecting; restart(); }); observer.observe(canvas);
    photo.onload = restart; scroller.addEventListener('scroll', restart); reduced.addEventListener('change', restart); document.addEventListener('visibilitychange', restart);
    restart();
    return () => { cancelAnimationFrame(frame); resize.disconnect(); observer.disconnect(); photo.onload = null; scroller.removeEventListener('scroll', restart); reduced.removeEventListener('change', restart); document.removeEventListener('visibilitychange', restart); };
  }, [scene, maxPixelRatio, isNav, isDark]);

  const options = { renderingMode: mode, backgroundSource: source, opticalThickness: thickness, refractionStrength: strength, surfaceRoughness: roughness, adaptiveLighting: adaptive,
    opticalOptions: { profile, refractionModel: model, refractiveIndex: index, dispersion, edgeSpectrum, edgeIllumination: edgeLight, antialiasing, motion, resolutionScale, maxPixelRatio, textureFiltering, reflection, scattering, shadows, debug, quality } };
  const tintColor = `rgb(${parseInt(tint.slice(1, 3), 16)} ${parseInt(tint.slice(3, 5), 16)} ${parseInt(tint.slice(5, 7), 16)} / ${tintDensity})`;
  const range = (label: string, value: number, update: (v: number) => void, min: number, max: number, step = .01) => <label className="lab-range">{label}<output>{value.toFixed(step < 1 ? 2 : 0)}</output><input aria-label={label} type="range" min={min} max={max} step={step} value={value} onChange={e => update(+e.target.value)} /></label>;
  return <div className="optical-lab">
    <header className="lab-header"><a href="/">liquid<span> / optical lab</span></a><span>INDEPENDENT MATERIAL ENGINE · 01</span></header>
    <main>
      <div className="lab-intro"><div><p className="lab-eyebrow">LIGHT / GEOMETRY / MOTION</p><h1>See the bend.</h1><p>A shared optical surface, with every contribution exposed.</p></div><a href="https://developer.apple.com/videos/play/wwdc2025/219/">Inspired by Liquid Glass ↗</a></div>
      <div className="lab-layout">
        <section aria-label="Optical experiments">
          <div className="lab-scenes">{scenes.map(value => <button key={value} aria-pressed={scene === value} onClick={() => setScene(value)}>{value}</button>)}</div>
          <div ref={stage} className={`lab-stage ${isNav ? 'lab-stage--nav' : ''} ${isDark ? 'lab-stage--dark' : ''}`} data-testid="optical-stage">
            <div ref={scroll} className="lab-source-scroll" onScroll={() => {}} style={{ overflowY: scene === 'scrolling text' ? 'auto' : 'hidden' }}><canvas ref={backdrop} className="lab-source" aria-hidden="true" /><div style={{ height: scene === 'scrolling text' ? 1400 : 0 }} /></div>
            <GlassView renderingMode="css" glassEffectStyle={variant} className="lab-css-reference" style={{ borderRadius: 24, padding: 18 }}>CSS reference<small>Same scene · blur only</small></GlassView>
            <div role={isNav ? 'tablist' : undefined} aria-label={isNav ? 'Navigation calibration' : undefined} className="lab-navigation">
            {mounted && <GlassView {...options} tintColor={tintColor} colorScheme={isDark ? 'dark' : 'light'} key={generation} onRenderStats={record} glassEffectStyle={{ style: variant, animate: true, animationDuration: .35 }} isInteractive className={`lab-lens lab-lens--${shape} ${isNav ? 'lab-lens--nav' : ''}`} data-testid="optical-lens"
              style={{ borderRadius: isNav || shape !== 'card' ? 999 : 32, ...(isNav ? { left: `${8 + indicator * 21}%`, transform: 'none' } : { transform: `translate(${position.x}px,${position.y}px)` }) }}>
              {isNav ? <div className="lab-nav-labels" style={{ left: `${-indicator * 100}%` }}>{navLabels.map((label, i) => <button key={label} role="tab" aria-selected={i === selected} tabIndex={i === selected ? 0 : -1} aria-controls="lab-nav-panel" onClick={() => setSelected(i)} onKeyDown={e => { if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); const next = (i + (e.key === 'ArrowRight' ? 1 : 3)) % 4; setSelected(next); e.currentTarget.parentElement?.querySelectorAll('button')[next]?.focus(); } }}><span aria-hidden="true">{['◉', '♧', '▢', '◎'][i]}</span>{label}</button>)}</div> : <><button className="lab-drag" aria-label="Move optical lens" onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); drag.current = { x: e.clientX, y: e.clientY, px: position.x, py: position.y }; }}
                onPointerMove={e => { if (drag.current) setPosition({ x: Math.max(-90, Math.min(150, drag.current.px + e.clientX - drag.current.x)), y: Math.max(-60, Math.min(90, drag.current.py + e.clientY - drag.current.y)) }); }}
                onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }} onLostPointerCapture={() => { drag.current = null; }}
                onKeyDown={e => { const d: Record<string, number[]> = { ArrowLeft: [-10, 0], ArrowRight: [10, 0], ArrowUp: [0, -10], ArrowDown: [0, 10] }; if (d[e.key]) { e.preventDefault(); setPosition(p => ({ x: p.x + d[e.key][0], y: p.y + d[e.key][1] })); } }}>⤧ <span>Move</span></button>
              <small>REAL SPATIAL SAMPLING</small><strong>Through<br />the surface.</strong><button className="lab-action" onClick={() => setClicked(v => v + 1)}>Continue ↗</button></>}
            </GlassView>}
            </div>
            {isNav && <div id="lab-nav-panel" role="tabpanel" className="lab-nav-caption">{navLabels[selected]} · use arrow keys or tap another tab</div>}
            {compare && !isNav && <GlassView {...options} tintColor={tintColor} opticalOptions={{ ...options.opticalOptions, profile: 'legacy' }} glassEffectStyle={variant} className={`lab-lens lab-previous lab-lens--${shape}`} style={{ borderRadius: shape === 'card' ? 32 : 999 }}><small>PREVIOUS SHADER</small><strong>Through<br />the surface.</strong><span>Same scene · previous optics</span></GlassView>}
            <GlassContainer {...options} onRenderStats={recordGroup} spacing={merge} className="lab-merge" data-testid="optical-merge">
              <GlassView glassEffectStyle="regular" isInteractive style={{ position: 'absolute', left: `calc(50% - ${100 + gap / 2}px)`, top: 28, width: 100, height: 72, borderRadius: 36 }}><button onClick={() => setClicked(v => v + 1)}>Regular</button></GlassView>
              <GlassView glassEffectStyle="clear" isInteractive style={{ position: 'absolute', left: `calc(50% + ${gap / 2}px)`, top: 28, width: 100, height: 72, borderRadius: 36 }}><button onClick={() => setClicked(v => v + 1)}>Clear</button></GlassView>
            </GlassContainer>
          </div>
          <div className="lab-caption"><span>32 px grid · drag or use arrow keys · scroll the background in text mode</span><output aria-live="polite">Actions: {clicked}</output></div>
          <div className="lab-metrics" data-testid="optical-metrics"><span><b>{stats ? stats.cpuMs.toFixed(2) : '—'} ms</b>CPU submission</span><span><b>{stats?.gpuMs !== undefined ? `${stats.gpuMs.toFixed(2)} ms` : 'unavailable'}</b>GPU timer</span><span><b>{stats ? `${(stats.estimatedBytes / 1048576).toFixed(1)} MiB` : '—'}</b>per-lens buffer estimate</span></div>
          <p className="lab-source-note">The visible background is an explicit canvas scene supplied to the renderer. Typography is drawn into that canvas; arbitrary HTML is handled by the CSS fallback. No screenshot capture is used.</p>
          <details className="lab-diagnostics" open><summary>Renderer diagnostics</summary><pre data-testid="renderer-diagnostics">{JSON.stringify({ ...stats, ...(mode === 'css' ? { activeRenderer: 'css', fallbackReason: 'manual-css', canvasPixelWidth: 0, canvasPixelHeight: 0, effectiveRenderScale: 0, estimatedBytes: 0, shaderCompilationStatus: 'inactive' } : {}), GPUFrameTime: stats?.gpuMs ?? 'unavailable', profile }, null, 2)}</pre></details>
          <details className="lab-reference"><summary>Supplied iPhone reference · compressed recording</summary><video controls preload="none" src={referenceVideo} /><p>Qualitative reference only. The 848 × 192 WhatsApp clip cannot establish pixel-level color, original frame rate, device DPR, or native shader parameters.</p></details>
        </section>
        <aside className="lab-controls" aria-label="Optical controls">
          <label>Renderer<select aria-label="Renderer" value={mode} onChange={e => setMode(e.target.value as GlassRenderingMode)}><option value="auto">Auto · explicit source</option><option value="webgl2">WebGL2 · fall back on failure</option><option value="css">CSS reference</option></select></label>
          <label>Quality<select aria-label="Quality" value={quality} onChange={e => setQuality(e.target.value as typeof quality)}><option value="high">High · deterministic</option><option value="auto">Auto · adapt or use CSS</option><option value="low">Low · DPR 1</option></select></label>
          <label>Surface profile<select aria-label="Surface profile" value={profile} onChange={e => setProfile(e.target.value as typeof profile)}><option value="refined">Refined surface</option><option value="legacy">Previous stable shader</option></select></label>
          <label>Ray model<select aria-label="Ray model" value={model} onChange={e => setModel(e.target.value as typeof model)}><option value="single">Curved entry / calibrated</option><option value="two-interface">Curved entry + planar exit</option></select></label>
          <label className="lab-toggle"><input type="checkbox" checked={compare} onChange={e => setCompare(e.target.checked)} />Compare previous renderer</label>
          <label>Maximum pixel ratio<select aria-label="Maximum pixel ratio" value={maxPixelRatio} onChange={e => setMaxPixelRatio(+e.target.value)}>{[1, 1.5, 2, 3].map(n => <option key={n} value={n}>{n}× · capped by display DPR</option>)}</select></label>
          <label>Source filtering<select aria-label="Source filtering" value={textureFiltering} onChange={e => setTextureFiltering(e.target.value as typeof textureFiltering)}><option value="auto">Auto · static / live</option><option value="mipmap">Mipmaps · always rebuild</option><option value="linear">Linear · fresh base level</option></select></label>
          {range('Resolution scale', resolutionScale, setResolutionScale, .5, 1, .05)}
          <div className="lab-control-pair"><label>Geometry<select aria-label="Geometry" value={shape} onChange={e => setShape(e.target.value)}>{['card', 'circle', 'capsule'].map(v => <option key={v}>{v}</option>)}</select></label><label>Material<select aria-label="Material" value={variant} onChange={e => setVariant(e.target.value as GlassStyle)}>{['clear', 'regular', 'none'].map(v => <option key={v}>{v}</option>)}</select></label></div>
          {range('Thickness', thickness, setThickness, 0, 1)}{range('Refraction', strength, setStrength, 0, 1)}{range('Roughness', roughness, setRoughness, 0, 1)}{range('Refractive index', index, setIndex, 1, 2)}{range('Dispersion', dispersion, setDispersion, 0, 1)}
          {range('Spectral edge light', edgeSpectrum, setEdgeSpectrum, 0, 1)}
          <label className="lab-tint">Material tint<input aria-label="Material tint" type="color" value={tint} onChange={e => setTint(e.target.value)} /></label>
          {range('Tint density', tintDensity, setTintDensity, 0, 1)}
          <fieldset><legend>Contributions</legend>{[['Reflection', reflection, setReflection], ['Scattering', scattering, setScattering], ['Adaptive lighting', adaptive, setAdaptive], ['Shadows', shadows, setShadows], ['Edge illumination', edgeLight, setEdgeLight], ['Analytical antialiasing', antialiasing, setAntialiasing], ['Motion response', motion, setMotion]] .map(([label, value, update]) => <label className="lab-toggle" key={label as string}><input type="checkbox" checked={value as boolean} onChange={e => (update as (v: boolean) => void)(e.target.checked)} />{label as string}</label>)}</fieldset>
          <label>Inspect field<select aria-label="Inspect field" value={debug} onChange={e => setDebug(e.target.value as GlassDebugView)}>{['none', 'normals', 'displacement', 'layers'].map(v => <option key={v}>{v}</option>)}</select></label>
          {range('Element gap', gap, setGap, 0, 120, 1)}{range('Merge influence', merge, setMerge, 0, 80, 1)}
          <div className="lab-lifecycle"><button onClick={() => setMounted(v => !v)}>{mounted ? 'Unmount lens' : 'Mount lens'}</button><button onClick={() => setGeneration(v => v + 1)}>Recreate lens</button><button onClick={() => setPosition({ x: 0, y: 0 })}>Reset position</button></div>
        </aside>
      </div>
    </main>
  </div>;
}
