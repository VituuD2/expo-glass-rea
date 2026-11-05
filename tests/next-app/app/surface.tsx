'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { GlassContainer, GlassView, type GlassBackgroundSource } from '@expo-glass-rea/react';

export function ClientDemo() {
  const [visible, setVisible] = useState(true);
  const sourceCanvas = useRef<HTMLCanvasElement>(null);
  const source = useMemo<GlassBackgroundSource>(() => ({
    getSource: () => sourceCanvas.current,
    getRect: () => sourceCanvas.current?.getBoundingClientRect() ?? { left: 0, top: 0, width: 0, height: 0 },
  }), []);
  useEffect(() => {
    const canvas = sourceCanvas.current!, context = canvas.getContext('2d')!;
    context.fillStyle = '#edf1ea'; context.fillRect(0, 0, 300, 180);
    context.strokeStyle = '#20443c'; context.beginPath();
    for (let x = 0; x < 300; x += 20) { context.moveTo(x, 0); context.lineTo(x, 180); }
    for (let y = 0; y < 180; y += 20) { context.moveTo(0, y); context.lineTo(300, y); }
    context.stroke();
  }, []);
  return <>
    <button onClick={() => setVisible(!visible)}>Toggle material</button>
    <GlassContainer spacing={28} style={{ display: 'flex', gap: 12, padding: 20 }}>
      <GlassView data-testid="next-glass" glassEffectStyle={{ style: visible ? 'regular' : 'none', animate: true }} style={{ padding: 24, borderRadius: 20 }}><button>Hydrated child</button></GlassView>
      <GlassView style={{ width: 80, height: 80, borderRadius: 40 }} />
    </GlassContainer>
    <GlassContainer spacing={12} data-testid="second-container" style={{ display: 'flex', gap: 8, padding: 12 }}>
      <GlassView style={{ width: 40, height: 40, borderRadius: 20 }} />
      <GlassView style={{ width: 40, height: 40, borderRadius: 20 }} />
    </GlassContainer>
    <div style={{ position: 'relative', width: 300, height: 180 }}>
      <canvas ref={sourceCanvas} width={300} height={180} aria-hidden="true" />
      <GlassView backgroundSource={source} data-testid="next-optical" glassEffectStyle="clear" style={{ position: 'absolute', left: 80, top: 24, width: 150, height: 110, borderRadius: 24, padding: 20 }}>
        <button onClick={() => setVisible(v => !v)}>Hydrated optical child</button>
      </GlassView>
    </div>
  </>;
}
