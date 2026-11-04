import { GlassView, isGlassEffectAPIAvailable } from '@expo-glass-rea/react';
import { ClientDemo } from './surface';

export default function Page() {
  return <main style={{ padding: 40, minHeight: '100vh', background: 'linear-gradient(130deg, #60999a, #d8b99c)' }}>
    <h1>Next.js glass integration</h1>
    <p data-testid="server-capability">Server API available: {String(isGlassEffectAPIAvailable())}</p>
    <GlassView data-testid="server-glass" style={{ padding: 20, borderRadius: 20 }}><p>Rendered from a Server Component</p></GlassView>
    <ClientDemo />
  </main>;
}
