'use client';

import { useState } from 'react';
import { GlassContainer, GlassView } from '@expo-glass-rea/react';

export function ClientDemo() {
  const [visible, setVisible] = useState(true);
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
  </>;
}
