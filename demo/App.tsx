import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { GlassContainer, GlassView, isGlassEffectAPIAvailable, isLiquidGlassAvailable } from '../src/index';
import type { GlassColorScheme, GlassStyle, GlassTintColor } from '../src/index';

const tints: { name: string; color?: GlassTintColor; swatch: string }[] = [
  { name: 'Natural', swatch: '#dfe9e8' },
  { name: 'Seafoam', color: 'rgba(62, 182, 162, .45)', swatch: '#70b4a6' },
  { name: 'Blue', color: 'rgba(54, 132, 219, .4)', swatch: '#83a9cf' },
  { name: 'Rose', color: 'rgba(218, 109, 136, .4)', swatch: '#d6a3b1' },
  { name: 'Dynamic', color: { dynamic: { light: 'rgba(245, 169, 85, .35)', dark: 'rgba(149, 107, 219, .45)' } }, swatch: 'linear-gradient(135deg,#eec08d 50%,#9383b5 50%)' },
  { name: 'Platform', color: { semantic: ['systemIndigo'] }, swatch: '#7779bb' },
];

function Icon({ name, size = 20 }: { name: 'sun' | 'arrow' | 'layers' | 'mountain' | 'heart' | 'compass' | 'move'; size?: number }) {
  const paths = {
    sun: 'M12 3v2m0 14v2M3 12h2m14 0h2M5.6 5.6 7 7m10 10 1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z',
    arrow: 'M5 12h14m-6-6 6 6-6 6',
    layers: 'm12 3 9 5-9 5-9-5 9-5Zm-9 9 9 5 9-5M3 16l9 5 9-5',
    mountain: 'm3 19 7-13 4 7 3-5 5 11H3Zm4-7 3 2 2-1',
    heart: 'M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z',
    compass: 'm16 8-3 5-5 3 3-5 5-3ZM21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
    move: 'M12 3v18M3 12h18M9 6l3-3 3 3M9 18l3 3 3-3M6 9l-3 3 3 3M18 9l3 3-3 3',
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]} /></svg>;
}

function Segments<T extends string>({ label, values, value, onChange }: { label: string; values: T[]; value: T; onChange: (value: T) => void }) {
  return <fieldset className="control-group"><legend>{label}</legend><div className="segments">{values.map((option) =>
    <button key={option} type="button" aria-pressed={option === value} onClick={() => onChange(option)}>{option}</button>
  )}</div></fieldset>;
}

export function App() {
  const [material, setMaterial] = useState<GlassStyle>('regular');
  const [scheme, setScheme] = useState<GlassColorScheme>('light');
  const [interactive, setInteractive] = useState(true);
  const [tint, setTint] = useState(0);
  const [animate, setAnimate] = useState(true);
  const [duration, setDuration] = useState(.5);
  const [radius, setRadius] = useState(28);
  const [asymmetric, setAsymmetric] = useState(false);
  const [continuous, setContinuous] = useState(false);
  const [rtl, setRtl] = useState(false);
  const [spacing, setSpacing] = useState(28);
  const [opacity, setOpacity] = useState(1);
  const [hidden, setHidden] = useState(false);
  const [mounted, setMounted] = useState(true);
  const [generation, setGeneration] = useState(0);
  const [saved, setSaved] = useState(false);
  const [api, setApi] = useState(false);
  const [design, setDesign] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [refStatus, setRefStatus] = useState('');
  const cardRef = useRef<HTMLDivElement>(null);
  const scene = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; startX: number; startY: number } | null>(null);

  useEffect(() => { setApi(isGlassEffectAPIAvailable()); setDesign(isLiquidGlassAvailable()); }, []);
  const effect = { style: material, animate, animationDuration: duration };
  const stopDrag = () => { drag.current = null; };
  const move = (event: PointerEvent<HTMLButtonElement>) => {
    if (!drag.current || !scene.current) return;
    const bounds = scene.current.getBoundingClientRect();
    setPosition({
      x: Math.max(-bounds.width * .2, Math.min(bounds.width * .2, drag.current.startX + event.clientX - drag.current.x)),
      y: Math.max(-90, Math.min(100, drag.current.startY + event.clientY - drag.current.y)),
    });
  };
  const reset = () => {
    setMaterial('regular'); setScheme('light'); setInteractive(true); setTint(0); setAnimate(true);
    setDuration(.5); setRadius(28); setAsymmetric(false); setContinuous(false); setRtl(false); setSpacing(28); setOpacity(1);
    setHidden(false); setMounted(true); setPosition({ x: 0, y: 0 }); setSaved(false); setRefStatus('');
  };

  return <>
    <a className="skip-link" href="#playground">Skip to playground</a>
    <header className="site-header"><a href="#" className="brand" aria-label="Liquid home"><span className="brand-mark"><Icon name="layers" size={19} /></span>liquid<span className="brand-dot">.</span></a>
      <nav aria-label="Main"><a className="nav-active" href="#playground">Playground</a><a href="#use-it">Use in your app <span aria-hidden="true">↗</span></a></nav>
      <span className="header-tag">A material, reimagined</span>
    </header>
    <main>
      <section className="intro"><div><div className="eyebrow"><span /> GLASS, WITHOUT THE BOUNDARIES</div><h1>A little depth.<br /><em>A different feeling.</em></h1>
        <p>Light-catching surfaces that let the world through.<br className="desktop-break" /> Shape the glass. Find your own kind of clarity.</p></div>
        <div className="intro-note"><span className="note-symbol">✳</span><p>Inspired by native materials.<br />Made for the open web.</p><span className="version">REACT + NEXT.JS · V0.1</span></div>
      </section>
      <section id="playground" className="playground" aria-label="Glass playground">
        <div className="preview-column">
          <div className="preview-topline"><span><span className="live-dot" /> LIVE PREVIEW</span><span>01 — ALPINE ESCAPE</span></div>
          <div ref={scene} className="scene" data-testid="scene" dir={rtl ? 'rtl' : 'ltr'}>
            <img className="scene-image" src="/alpine.jpg" alt="" />
            <div className="scene-shade" />
            <div className="scene-heading"><span className="scene-location"><Icon name="mountain" size={17} /> Somewhere worth slowing down.</span><span className="weather"><Icon name="sun" size={17} /> 18°</span></div>
            <div className="surface-stage" style={{ opacity }} hidden={hidden} data-testid="surface-stage">
              {mounted && <GlassView key={generation} ref={cardRef} className="destination-card" data-testid="main-glass"
                glassEffectStyle={effect} tintColor={tints[tint].color} isInteractive={interactive} colorScheme={scheme}
                style={{ borderRadius: radius, borderCurve: continuous ? 'continuous' : 'circular', borderTopStartRadius: asymmetric ? 60 : undefined, borderBottomEndRadius: asymmetric ? 8 : undefined, transform: `translate(${position.x}px, ${position.y}px)` }}>
                <div className="card-top"><span className="tiny-label">OFF THE BEATEN PATH</span>
                  <button className="drag-handle" aria-label="Move glass card" title="Drag, or use arrow keys"
                    onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); drag.current = { x: event.clientX, y: event.clientY, startX: position.x, startY: position.y }; }}
                    onPointerMove={move} onPointerUp={stopDrag} onPointerCancel={stopDrag}
                    onKeyDown={(event) => { const steps: Record<string, [number, number]> = { ArrowLeft: [-10, 0], ArrowRight: [10, 0], ArrowUp: [0, -10], ArrowDown: [0, 10] }; if (steps[event.key]) { event.preventDefault(); const [x, y] = steps[event.key]; setPosition((p) => ({ x: Math.max(-100, Math.min(100, p.x + x)), y: Math.max(-90, Math.min(100, p.y + y)) })); } }}><Icon name="move" size={16} /></button></div>
                <h2>Take the<br />scenic route.</h2><p>Less rush. More wonder.</p>
                <div className="card-bottom"><span><strong>Dolomites</strong><small>46.4102° N, 11.8440° E</small></span>
                  <button className="save-button" aria-label={saved ? 'Unsave destination' : 'Save destination'} aria-pressed={saved} onClick={() => setSaved(!saved)}><Icon name={saved ? 'heart' : 'arrow'} /></button></div>
              </GlassView>}
            </div>
            <div className="scene-bottom"><span className="scene-caption">A WINDOW, NOT A WALL.</span><GlassContainer key={generation} spacing={spacing} className="essentials" data-testid="merge-group">
              {(['compass', 'mountain', 'heart'] as const).map((icon, i) => <GlassView key={icon} glassEffectStyle={effect} tintColor={tints[tint].color} colorScheme={scheme} isInteractive={interactive}
                style={{ width: i === 1 ? 54 : 46, height: i === 1 ? 54 : 46, borderRadius: 50 }}><button aria-label={['Explore', 'View mountains', 'Toggle favorite'][i]} onClick={() => setSaved((v) => !v)}><Icon name={icon} size={19} /></button></GlassView>)}
            </GlassContainer></div>
            <span className="scene-grain" aria-hidden="true" />
          </div>
          <div className="preview-footer"><span><Icon name="move" size={14} /> Move the card. See the light change.</span><span className="browser-status" role="status" data-testid="capabilities">{api && design ? 'Glass supported' : 'Opaque fallback'}</span></div>
        </div>
        <aside className="editor" aria-label="Material controls">
          <div className="editor-heading"><div><span className="eyebrow">MAKE IT YOURS</span><h2>The material</h2></div><button className="reset-button" onClick={reset}>Reset <span aria-hidden="true">↺</span></button></div>
          <Segments label="Glass style" values={['regular', 'clear', 'none'] as GlassStyle[]} value={material} onChange={setMaterial} />
          <fieldset className="control-group"><legend>Tint <span>{tints[tint].name}</span></legend><div className="swatches">{tints.map((entry, index) => <button key={entry.name} aria-label={`${entry.name} tint`} aria-pressed={tint === index} style={{ background: entry.swatch }} onClick={() => setTint(index)}>{index === tint && <span aria-hidden="true">✓</span>}</button>)}</div></fieldset>
          <Segments label="Appearance" values={['auto', 'light', 'dark'] as GlassColorScheme[]} value={scheme} onChange={setScheme} />
          <label className="toggle-row"><span>Interactive material<small>A little response to your touch</small></span><input type="checkbox" checked={interactive} onChange={(e) => setInteractive(e.target.checked)} /></label>
          <div className="editor-divider" />
          <label className="range-label">Corner radius <output>{radius}px</output><input type="range" aria-label="Corner radius" min="0" max="60" value={radius} onChange={(e) => setRadius(+e.target.value)} /></label>
          <label className="range-label">Merge distance <output>{spacing}px</output><input type="range" aria-label="Merge distance" min="0" max="80" value={spacing} onChange={(e) => setSpacing(+e.target.value)} /></label>
          <div className="mini-toggles"><label><input type="checkbox" checked={asymmetric} onChange={(e) => setAsymmetric(e.target.checked)} />Asymmetric corners</label><label><input type="checkbox" checked={rtl} onChange={(e) => setRtl(e.target.checked)} />Right to left</label><label><input type="checkbox" checked={continuous} onChange={(e) => setContinuous(e.target.checked)} />Continuous corners</label></div>
          <div className="editor-divider" />
          <label className="toggle-row"><span>Animate transitions</span><input type="checkbox" checked={animate} onChange={(e) => setAnimate(e.target.checked)} /></label>
          <label className="range-label compact">Duration <output>{duration.toFixed(1)}s</output><input type="range" aria-label="Animation duration" min="0" max="2" step="0.1" value={duration} onChange={(e) => setDuration(+e.target.value)} /></label>
          <p className="editor-hint">Try <button onClick={() => setMaterial(material === 'none' ? 'regular' : 'none')}>fading the material {material === 'none' ? 'in' : 'out'} <span aria-hidden="true">↗</span></button>. The content stays.</p>
        </aside>
      </section>
      <section className="lifecycle-panel" aria-labelledby="lifecycle-title"><div><span className="eyebrow">BUILT FOR REAL INTERFACES</span><h2 id="lifecycle-title">A surface that comes back.</h2><p>Fade a parent, hide it, or start fresh. Your glass follows along.</p></div><div className="lifecycle-controls">
        <label className="range-label">Parent opacity <output>{Math.round(opacity * 100)}%</output><input type="range" aria-label="Parent opacity" min="0" max="1" step="0.01" value={opacity} onChange={(e) => setOpacity(+e.target.value)} /></label>
        <div className="lifecycle-buttons"><button aria-pressed={hidden} onClick={() => setHidden(!hidden)}>{hidden ? 'Show parent' : 'Hide parent'}</button><button onClick={() => setMounted(!mounted)}>{mounted ? 'Unmount card' : 'Mount card'}</button><button onClick={() => { setMounted(true); setGeneration((g) => g + 1); }}>Remount</button><button onClick={() => setRefStatus(cardRef.current ? `DOM ref connected · ${Math.round(cardRef.current.getBoundingClientRect().width)}px wide` : 'Card is unmounted')}>Inspect ref</button></div>
        <p className="ref-status" role="status">{refStatus}</p></div></section>
      <section id="use-it" className="use-it"><div><span className="eyebrow">YOUR NEXT INTERFACE</span><h2>Drop it into React.</h2><p>Two components. The props you know.<br />Works with React apps and the Next.js App Router.</p><span className="adaptation-note">Web materials use CSS and SVG. Native iOS rendering will look different.</span></div><pre aria-label="React usage example"><code><span className="code-muted">// Import the stylesheet once in your app</span>{'\n'}import '@expo-glass-rea/react/styles.css';{'\n'}import {'{ GlassView }'} from '@expo-glass-rea/react';{'\n\n'}{'<GlassView'}{'\n'}  glassEffectStyle="regular"{'\n'}  isInteractive{'\n'}  style={'{{ borderRadius: 24, padding: 24 }}'}{'\n'}{'>'}{'\n'}  Your content, with a little depth.{'\n'}{'</GlassView>'}</code></pre></section>
    </main>
    <footer className="site-footer"><a className="brand" href="#">liquid<span className="brand-dot">.</span></a><span>A study in light, depth & possibility.</span><span>BUILT FOR THE WEB <span aria-hidden="true">↗</span></span></footer>
  </>;
}
