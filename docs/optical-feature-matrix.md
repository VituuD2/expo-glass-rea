# Optical implementation baseline

Inspected revision: `1488c96` (2026-11-04), before implementation. Working tree initially contained two untracked user references: `docs/estudo_liquid_glass.md` and `docs/simulador_liquid_glass.html`; both are preserved. No root/ancestor AGENTS.md was found. The Next fixture has its own instructions. The requested audit filename was absent; `estudo_liquid_glass.md` is the supplied audit, read in full. Simulator and existing reconstruction/reverse-engineering reports were inspected separately.

Evidence labels: CONFIRMED = public documented contract; OBSERVED = executed controlled experiment; INFERRED = independent model supported by computation; HYPOTHETICAL = unverified mechanism. Source inspection confirms code presence, not visual equivalence to UIKit.

| Feature | Original code evidence | Baseline status | Implementation decision / acceptance |
|---|---|---|---|
| DOM children, refs, events, SSR | GlassView.tsx, existing Next fixture | Implemented | Preserve four runtime exports and content semantics |
| Regular / clear / none, tint, theme, corners | options.ts, styles.css | Implemented appearance approximation | Preserve CSS path and add optical material inputs |
| Blur / transmission | CSS blur(18px/5px), RGBA | Visually approximated | Blur is convolution, not displaced sampling |
| Spatial refraction | No texture or displacement in src | Missing | Geometry must deform a grid with scattering/reflection disabled |
| Normal field / Fresnel / depth | No normal/optical calculation | Missing | Independent SDF height model and projected Snell ray |
| Pointer light / press | CSS hover/focus/active shadows | Partial | Normal-based moving light, press depth; keep HTML focus/actions |
| Merging | GlassContainer SVG blur + alpha threshold, roundedPath | Silhouette approximation | Preserve SVG fallback; shared SDF optics when source exists |
| Shape morph / materialization | CSS decoration transitions | Partial | Re-measure animated geometry; interpolate optical presence |
| Adaptive contrast/shadow | System/local theme only | Missing background analysis | Continuous shader luminance adaptation; no automatic DOM text recoloring |
| Accessibility | Reduced motion/transparency, forced colors CSS | Implemented with platform limits | Suppress GPU work under opaque preferences; maintain children |
| Arbitrary DOM pixels | Browser backdrop filter only | Browser constraint | CSS fallback; never imply WebGL can read composited DOM |
| Media / canvas pixels | No source contract | Missing architecture | Explicit origin-clean texture + viewport rectangle + invalidation |
| Rotation, skew, elliptical corners | Axis-aligned boxes, scalar radii | Architectural constraint | Deterministic CSS fallback for unsupported GPU geometry |
| Performance | No GPU engine or measurements | Unmeasured | Batched container, capped resolution/shapes, dirty scheduling, offscreen pause; reproducible timing |
| Native fidelity | No Apple runtime/captures | Unvalidated | No percentage or pixel-parity claims |

The smallest useful architecture change is an optional decorative WebGL2 layer inside the existing components, accepting an explicit background source. A shared layer in GlassContainer avoids independent optical seams. CSS/SVG remains the default for unprovided sources. SVG displacement and WebGPU are evaluated in the architecture document; neither is presumed to solve DOM texture acquisition.

Primary behavioral references: [Apple UIGlassEffect](https://developer.apple.com/documentation/uikit/uiglasseffect), [container composition](https://developer.apple.com/documentation/uikit/uiglasscontainereffect), [Meet Liquid Glass](https://developer.apple.com/videos/play/wwdc2025/219/), [Expo](https://docs.expo.dev/versions/latest/sdk/glass-effect/). Final evidence and validation status are tracked in [liquid-glass-fidelity.md](liquid-glass-fidelity.md).
