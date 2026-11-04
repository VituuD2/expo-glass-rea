# Liquid — Glass for React and Next.js

A web reconstruction of the features in [the REA investigation](docs/reverse-engineering-report.md) of Expo GlassEffect 58.0.5: reusable components, an interactive playground and a Next.js integration fixture. CSS backdrop-filter supplies material; SVG approximates merging. This is not Apple's renderer or the official Expo package.

## Run

Requires Node 22.12+ (tested on Node 24) and npm.

```sh
npm ci
npm run dev
```

Open the URL Vite prints, normally `http://127.0.0.1:5173`. The normal entry `/` has controls for material, tint, local/system appearance, interaction, animation, asymmetric/RTL corners, merge distance, drag, parent opacity, hide/show, unmount/remount and DOM refs. State stays in memory. Reset restores defaults. All running assets are local.

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

## Next.js App Router

Import `@expo-glass-rea/react/styles.css` in `app/layout.tsx`. Render components from Server or Client Components. Emitted component files preserve `use client`; use a Client Component for handlers/state. Package reexports leave pure helpers callable on the server.

`isGlassEffectAPIAvailable()` and `isLiquidGlassAvailable()` are synchronous web capability checks: false without CSS/DOM; in browser true for backdrop-filter or its WebKit prefix. They indicate CSS support, not UIKit. Preferences can make surfaces opaque while helpers remain true. Query in an effect for UI indicators to avoid conditional server/client markup; components do this internally.

`tests/next-app` imports the actual built package/CSS into a Server Component and stateful Client Component, and calls the server helper. Build the library first, then `npm run dev:next` or `npm run build:next`.

## Checks and outputs

```sh
npm run typecheck
npm run build              # dist/ library; site-dist/ static demo
npm run build:next         # real Next production build
npx playwright install chromium
npm test                  # builds library; Node tests; Chromium + Next E2E
npm run preview
```

Playwright uses local ports 4173/4174. Reports, screenshots and failure traces go to ignored `playwright-report/` and `test-results/`. Persistent results and selected captures: [docs/reconstruction.md](docs/reconstruction.md), `docs/verification/`. Vite can warn about dropping use-client directives in its browser-only demo bundle; the separately emitted library preserves them and is exercised by Next.

## Differences and limits

- Unsupported backdrop-filter gets readable opaque surfaces; children/actions remain usable. Reduced transparency disables blur/merging; reduced motion disables transitions; forced colors use system colors. Media support varies by browser/OS.
- Browser compositing handles initial opacity/hidden and remounting, so the UIKit 0.02 threshold/per-frame visibility loop is not recreated.
- Merging is a shared approximate material behind individual views, based on measured axis-aligned boxes/scalar radii. Rotation/skew, elliptical corners and continuously animated CSS transforms need a more advanced compositor. JS drag/style/layout changes are tracked.
- CSS/SVG rendering is not pixel-equivalent to iOS. Chromium is tested; Safari/Firefox and native comparisons require separate checks. No iOS binary was available.
- Invalid enums recover to regular/auto; invalid numeric options use safe defaults/bounds. CSS color validity belongs to the browser. The 0.35s/20px defaults are web decisions, not recovered Apple constants. The potential native spacing-omission bug is not copied.

Evidence and reference license: [original MIT license](artifacts/package/LICENSE), [report](docs/reverse-engineering-report.md), [requirements/results](docs/reconstruction.md). `public/alpine.jpg` uses the same [Unsplash reference image](https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1600&fit=crop&q=85) as the supplied Expo demo; there are no runtime requests to Unsplash.
