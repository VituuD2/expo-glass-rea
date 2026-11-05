# Liquid — Glass for React and Next.js

A web adaptation of [Expo GlassEffect](docs/reverse-engineering-report.md) with a reusable optical renderer and a Next.js integration fixture. CSS/SVG supplies the default material; an explicit scene texture enables geometry-dependent WebGL2 refraction, shared lens merging and dynamic lighting. This is an independent model, not Apple's renderer or the official Expo package.

## Run

Requires Node 22.12+ (tested on Node 24) and npm.

```sh
npm ci
npm run dev
```

Open the URL Vite prints, normally `http://127.0.0.1:5173`. The normal entry `/` has controls for material, tint, local/system appearance, interaction, animation, asymmetric/RTL corners, merge distance, drag, parent opacity, hide/show, unmount/remount and DOM refs. State stays in memory. Reset restores defaults. All running assets are local.

Open **`/lab`** for the optical laboratory: grid, checkerboard, typography, local photograph, moving scene and scrolling canvas text; card/circle/capsule; regular/clear; shared merging; individual effect toggles; normals, displacement vectors and composition diagnostics. High quality is selected there for deterministic comparisons. Library consumers default to automatic quality.

The refined default adds analytic normals, SDF antialiasing, linear-light texture filtering, independently controlled spectral edge radiance and wavelength refraction, spring interaction and light/dark navigation. Use **Surface profile → Previous stable shader** for A/B, or enable **Compare previous renderer**. Diagnostics show actual GPU/fallback state and resolution. See the [fidelity improvements and measured limits](docs/liquid-glass-fidelity-improvements.md); the supplied compressed reference can be played in the lab.

## Use in another app

The workspace package is private, not published. Build and install its tarball:

```sh
npm run build:lib
npm pack
# In the consuming app:
npm install /absolute/path/to/expo-glass-rea-react-0.1.0.tgz
```

```tsx
import '@expo-glass-rea/react/styles.css';
import { GlassContainer, GlassView } from '@expo-glass-rea/react';

export function Example() {
  return (
    <GlassContainer spacing={24} style={{ display: 'flex', gap: 12, padding: 24 }}>
      <GlassView
        glassEffectStyle={{ style: 'regular', animate: true, animationDuration: .5 }}
        tintColor={{ light: 'rgba(40,160,120,.2)', dark: 'rgba(90,80,180,.3)' }}
        isInteractive
        style={{ borderRadius: 24, padding: 24 }}>
        <button onClick={() => console.log('Clicked')}>Your action</button>
      </GlassView>
      <GlassView style={{ width: 80, height: 80, borderRadius: 40 }} />
    </GlassContainer>
  );
}
```

Import CSS once. Put glass over a patterned/photographic background to see filtering. Standard HTML attributes, events, className, children, CSS style and refs to `HTMLDivElement` are supported; refs are not native View instances. `isInteractive` adds hover/focus/press response without adding button semantics or focusability. React/React DOM are peers; no React Native or Expo dependency.

| Prop | Web contract |
|---|---|
| glassEffectStyle | regular (default), clear, none, or config object |
| config.animate | false by default; decoration transitions, children persist |
| config.animationDuration | Seconds; omitted/invalid uses 0.35s; zero is valid |
| tintColor | CSS string, `{light,dark}`, RN-shaped `{dynamic:{light,dark,highContrastLight?,highContrastDark?}}`, or known `{semantic:[...]}` |
| colorScheme | auto inherits CSS color-scheme; light/dark override locally |
| style corners | CSS physical/logical corners and RN Top/Bottom Start/End aliases; physical wins, including zero |
| style.borderCurve | circular/continuous → round/squircle when corner-shape is supported; browser rounding fallback |
| GlassContainer.spacing | Merge influence in CSS pixels; default 20; zero disables merging; independent of layout gap |

Known semantic colors: systemBlue, systemIndigo, systemRed, systemGreen, label and systemBackground; unknown semantic names produce transparent tint. Arbitrary Apple color names are unavailable. Use CSS/system colors or explicit dynamic values. Contrast variants use `prefers-contrast: more` when supported. For auto OS appearance, set `color-scheme: light dark` on your document; explicit parent schemes are inherited.

## Actual refraction over an explicit scene

Ordinary WebGL cannot read arbitrary composited HTML behind a component. Supply the same opaque image/video/canvas pixels that your application displays, plus the viewport rectangle over which they are stretched. All ordinary DOM backgrounds continue to use CSS/SVG. No screenshots or cross-origin bypass are used.

```tsx
'use client';
import { useMemo, useRef } from 'react';
import { GlassView, type GlassBackgroundSource } from '@expo-glass-rea/react';

export function Scene() {
  const image = useRef<HTMLImageElement>(null);
  const invalidators = useRef(new Set<() => void>());
  const background = useMemo<GlassBackgroundSource>(() => ({
    getSource: () => image.current,
    getRect: () => image.current?.getBoundingClientRect()
      ?? { left: 0, top: 0, width: 0, height: 0 },
    subscribe: invalidate => {
      invalidators.current.add(invalidate);
      return () => { invalidators.current.delete(invalidate); };
    },
  }), []);
  return <div style={{ position: 'relative', width: 600, maxWidth: '100%' }}>
    <img ref={image} src="/scene.jpg" alt="Mountain landscape"
      onLoad={() => invalidators.current.forEach(fn => fn())}
      style={{ display: 'block', width: '100%' }} />
    <GlassView backgroundSource={background} glassEffectStyle="clear" isInteractive
      style={{ position: 'absolute', left: 40, top: 40, padding: 28, borderRadius: 28 }}>
      <button>Continue</button>
    </GlassView>
  </div>;
}
```

Import the library stylesheet once. For several merging surfaces, move `backgroundSource` to `GlassContainer`; its eligible descendants share one optical field and GPU context. A child with its own source opts out of that shared field. Call subscribed invalidators after updating canvas pixels or externally changing the source/layout. `dynamic: true` continuously uploads video or other synchronized producers while visible, capped at 60Hz. Text drawn into a source canvas is refracted; DOM foreground children stay sharp. The source rectangle does not infer object-fit, cropping, layer occlusion or CSS background geometry.

| Optical prop | Contract |
|---|---|
| renderingMode | `auto` (default), `css`, `webgl2`; GPU modes still fall back on failure |
| backgroundSource | Ready, origin-clean bitmap/media plus viewport rectangle and invalidation |
| refractionStrength / opticalThickness / surfaceRoughness | [0,1], defaults .6 / .5 / .2 |
| adaptiveLighting | Default true; local material adaptation; no DOM text recoloring |
| opticalOptions | Index [1,2], dispersion [0,1] (off by default), reflection/scattering/shadows toggles |
| opticalOptions.debug | `none`, `normals`, `displacement`, `layers` |
| opticalOptions.quality | `auto` (default, resolution reduction and pressure fallback), `high`, `low` |
| opticalOptions.profile | `refined` (default) or `legacy` for the previous shader |
| opticalOptions.refractionModel | `single` (default) or experimental `two-interface` |
| opticalOptions.edgeSpectrum / edgeIllumination | Localized spectral amount [0,1] (default .16), independent edge-light toggle |
| opticalOptions.antialiasing / motion | Default true; diagnostic AA override and optional spring response |
| opticalOptions.maxPixelRatio / resolutionScale | Explicit maximum DPR [1,3] (default 2), scale [.5,1] (default 1); resource caps still apply |
| opticalOptions.textureFiltering | `auto` (default): static cached mipmaps / fresh live samples; `mipmap` or `linear` overrides |
| onRenderStats | CPU submission, optional asynchronous GPU draw timer, allocation estimate, draw/upload counts |

Containers own shared lighting/effect/debug options. Per-child material, tint, thickness, strength and roughness shape the shared surface. Inspect `data-glass-renderer` / `data-glass-renderer-reason` for the active backend. At most 16 eligible shapes per optical container; unsupported corners/transforms, source size/security failures and context loss restore CSS/SVG. Dynamic texture upload has a real cost; group compatible elements and profile target devices.

Read the [mathematical derivation](docs/optical-rendering-model.md), [architecture and source matrix](docs/web-renderer-architecture.md), [UIKit study](docs/uikit-renderer-study.md), and [validated behavior, performance and gaps](docs/liquid-glass-fidelity.md).

## Next.js App Router

Import `@expo-glass-rea/react/styles.css` in `app/layout.tsx`. Render components from Server or Client Components. Emitted component files preserve `use client`; use a Client Component for handlers/state. Package reexports leave pure helpers callable on the server.

`isGlassEffectAPIAvailable()` and `isLiquidGlassAvailable()` are synchronous web capability checks: false without CSS/DOM; in browser true for backdrop-filter or its WebKit prefix. They indicate CSS support, not UIKit. Preferences can make surfaces opaque while helpers remain true. Query in an effect for UI indicators to avoid conditional server/client markup; components do this internally.

`tests/next-app` imports the actual built package/CSS into a Server Component and stateful Client Component, and calls the server helper. Build the library first, then `npm run dev:next` or `npm run build:next`.

Background getter functions belong inside a Client Component; they cannot cross the Server Component serialization boundary. The fixture also exercises an explicit canvas source through SSR/hydration.

## Checks and outputs

```sh
npm run typecheck
npm run build              # dist/ library; site-dist/ static demo
npm run build:next         # real Next production build
npx playwright install chromium
npm test                  # builds library; Node tests; Chromium + Next E2E
npx playwright install firefox webkit  # additional engines for test:compat
npm run preview
# In a separate terminal, start npm run dev -- --port 4173 --strictPort, then:
npm run benchmark:optics
npm run benchmark:optics -- --auto
# Refined/previous paired validation (current implementation):
npm run test:compat
npm run calibrate:fidelity
npm run benchmark:fidelity
```

Playwright uses local ports 4173/4174. Reports, screenshots and failure traces go to ignored `playwright-report/` and `test-results/`. Current fidelity results, paired benchmarks and captures go to `docs/verification/fidelity/`; previous `optical-browser-results.json` and `optical-benchmark.json` are preserved as historical reports. Vite can warn about dropping use-client directives in its browser-only demo bundle; the separately emitted library preserves them and is exercised by Next.

## Differences and limits

- Unsupported backdrop-filter gets readable opaque surfaces; children/actions remain usable. Reduced transparency disables blur/merging; reduced motion disables transitions; forced colors use system colors. Media support varies by browser/OS.
- Browser compositing handles initial opacity/hidden and remounting, so the UIKit 0.02 threshold/per-frame visibility loop is not recreated.
- CSS merging remains an SVG silhouette approximation. With an explicit scene, merging uses one SDF/height/normal field and refracts through the bridge. Axis-aligned rounded rectangles, circles, capsules, translations and positive host scaling are supported; unsupported geometry selects CSS. Active CSS geometry transitions are remeasured.
- CSS/SVG rendering is not pixel-equivalent to iOS. Chromium, Firefox and Windows WebKit passed the recorded browser checks; real iPhone Safari, hardware-GPU performance and controlled native comparisons remain unvalidated. The supplied compressed reference video supports qualitative observation only.
- Invalid enums recover to regular/auto; invalid numeric options use safe defaults/bounds. CSS color validity belongs to the browser. The 0.35s/20px defaults are web decisions, not recovered Apple constants. The potential native spacing-omission bug is not copied.

Evidence and reference license: [original MIT license](artifacts/package/LICENSE), [report](docs/reverse-engineering-report.md), [requirements/results](docs/reconstruction.md). `public/alpine.jpg` uses the same [Unsplash reference image](https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1600&fit=crop&q=85) as the supplied Expo demo; there are no runtime requests to Unsplash.
