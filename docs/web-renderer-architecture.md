# Web optical renderer architecture

> The source/lifecycle contract below remains applicable. Rendering quality, analytic normals, mipmaps and the adaptive policy were subsequently revised; [fidelity improvements](liquid-glass-fidelity-improvements.md) is the current validation record. The previous shader is retained for A/B comparison.

The public `GlassView` / `GlassContainer` system is unchanged. Four existing runtime exports remain; additional optical types and optional props extend it. Default consumers retain CSS/SVG. A supplied background texture enables a lazy-loaded WebGL2 decoration. No new dependency was added.

## Feasibility decision

| Approach | What it can read | Strengths | Constraints / decision |
|---|---|---|---|
| CSS backdrop-filter | Browser-defined backdrop image, up to the backdrop root | Live DOM blur, clipping and native composition | Cannot expose that image as a WebGL texture; default fallback |
| SVG filter on an element | Element's rendered SourceGraphic | Displacement, lighting, compositing primitives | Filtering a transparent overlay does not refract the page behind it |
| SVG URL in backdrop-filter | Backdrop image in supporting engines | Can actually displace DOM in tested Chromium | Syntax support is not pixel support; no portable capability proof; retained only as an experiment |
| WebGL2 | Explicit origin-clean TexImageSource | One-pass shared geometry, refraction, shading | Cannot read arbitrary composited DOM; selected optical backend |
| WebGPU | Explicit buffers/textures/external images | Compute, explicit pipelines and synchronization | Same missing-DOM-source problem; no measured benefit for this one-pass workload; deferred |
| Hybrid | Explicit scene source + HTML foreground, CSS fallback | Genuine refraction and accessible controls | Application must provide current scene pixels and mapping |

Backdrop roots, nested opacity, filters, masks and blending affect which content a browser backdrop filter can see. This is browser composition, not a texture-export API. [Filter Effects Level 2 (editor's draft)](https://drafts.csswg.org/filter-effects-2/). SVG SourceGraphic, filter regions and feDisplacementMap operate on defined image inputs; they do not automatically turn the page into an input texture. [Filter Effects Level 1](https://www.w3.org/TR/filter-effects-1/). WebGL and WebGPU accept explicitly specified pixel resources, with origin restrictions. [WebGL 2 specification](https://registry.khronos.org/webgl/specs/latest/2.0/), [WebGPU specification](https://www.w3.org/TR/webgpu/).

The reproducible Chromium experiment (`tests/e2e/svg-feasibility.spec.ts`) used an analytic constant map (24px scale, R=1, G≈.5) on a line background. Element filter: **0 changed pixels** in the sampled region. Backdrop URL filter: **1040 changed pixels**. Both are OBSERVED in Chromium 156 only. This proves a useful distinction, not a portable SVG refraction engine. No runtime backend is selected using CSS.supports(url(...)) alone. The production Tier 2 remains the existing CSS + SVG merge mask; the experiment does not silently enable URL displacement for all browsers.

## Background support contract

`GlassBackgroundSource` contains `getSource()`, `getRect()`, optional `subscribe(invalidate)` and optional `dynamic`. The rectangle describes the **entire supplied opaque bitmap stretched over a viewport rectangle**. Getters must be cheap and return current data. Notifications must occur after source painting, not before it. A returned bitmap/media element remains application-owned; the renderer does not close ImageBitmaps or pause videos supplied by the app.

| Visible background | CSS fallback | Optical backend |
|---|---|---|
| CSS solid/gradient/background image | Live blur/composition | Redraw equivalent pixels into an explicit scene; no automatic CSS rasterization |
| HTMLImageElement | Live DOM image | Ready, same-origin/CORS-approved image; map cropping explicitly |
| HTMLVideoElement | Live DOM video | Ready frame, `dynamic:true` or source notifications; no automatic video lifecycle control |
| Canvas / OffscreenCanvas / ImageBitmap | Browser composition | Origin-clean input; static notifications or dynamic uploads |
| WebGL canvas | Browser composition | Producer must synchronize drawing before invalidation and preserve/export usable pixels; default discarded drawing buffers are not reliable snapshots |
| Arbitrary HTML / text / inputs | Live blur | Unsupported automatic capture; application can supply a deliberately rendered scene instead |
| Scrolling DOM | Native live blur | No universal DOM capture; explicit source rectangle tracks scrolling, canvas typography is demonstrated |
| Animated interface | Live blur | Only the supplied scene pixels are refracted; DOM changes above/between scene and glass are not included |

Images/videos from another origin need server-approved CORS and the appropriate element crossOrigin setting before loading. A tainted canvas is rejected on upload; no proxy or security bypass is provided. Actual cross-port tainting is tested. Origin-clean requirements are specified by [WebGL security](https://registry.khronos.org/webgl/specs/latest/1.0/#4.2) and the [HTML canvas security model](https://html.spec.whatwg.org/multipage/canvas.html#security-with-canvas-elements).

DOM screenshot libraries recreate a subset of DOM/CSS and can omit media, fonts, cross-origin assets, iframes or current compositing. Screen capture needs user permission and represents a captured display/tab, with latency and recursion hazards. Neither gives universal transparent, low-cost background access; neither is used here. No static screenshot is substituted for live content.

## Modules and composition

```text
GlassView / GlassContainer
  OpticalLayer (client-only lazy import, cancellation, decorative canvas)
    OpticalRenderer (source, measurements, scheduling, GL lifecycle, telemetry)
      optical-shader (SDF, shared height, raster normals, refraction, shading)
      optics (CPU reference, numeric controls)
  styles.css / geometry.ts (existing fallback material and SVG mask)
```

`renderingMode="auto"` and `"webgl2"` both require an explicit source and successful context/shader/upload. Manual `"css"` always falls back. The original availability helpers still report CSS backdrop support, not optical capability. `data-glass-renderer` and `data-glass-renderer-reason` identify the actual active path. Initialization diagnostics are available on `canvas.dataset.glassError`.

An independent GlassView owns one canvas. GlassContainer owns one context/texture/draw for up to 16 eligible GlassViews and suppresses their individual material decorations only after a successful render. Container source/options own shared lighting, debug and effects; child thickness/strength/roughness, material, tint and interaction contribute to the shared field. A child with its own source or `renderingMode="css"` opts out. Nested GlassViews do not contribute duplicate shared shapes; content remains HTML. Nested containers form their own boundaries. CSS opted-out children keep independent materials; they do not fuse optically with the shared surface.

The GPU shared field replaces the SVG material only while active. Context failure restores the existing SVG/individual CSS decorations. The legacy SVG observer stops while GPU composition is active. Its historical limitations remain on fallback: scalar axis-aligned geometry and no shared optical field. Optical regions do not distort text or controls inside the glass.

Measurements convert viewport boxes back to local CSS pixels. Host/ancestor translation and positive axis scaling are mapped. Internal group child translation is supported; internal scaling, rotation/skew, perspective, elliptical radii and unsupported corner curves select CSS. Borders are included in canvas positioning. Browser clipping still applies to the canvas. Source crop/object-fit, layer occlusion and source correctness are the application's responsibility. If an unrelated external layout change moves a stationary host without any observed mutation/resize/scroll/animation, call the source subscription invalidator; no permanent layout polling is hidden in the component.

## Lifecycle and SSR

SSR and the initial client render always emit the CSS path. DOM/media queries and GPU access start in effects. Source getter functions must be created inside a Next Client Component; they cannot be passed across an RSC serialization boundary. The real Next fixture covers this arrangement. Library output preserves use-client directives; Vite's demo-only bundle warnings do not change the library's client boundary.

Each effect setup creates a fresh canvas. StrictMode teardown releases its resources and cancels pending module initialization before another setup can use them. Cleanup disconnects Resize/Mutation/Intersection observers, source subscriptions and listeners, cancels RAF, deletes shaders/program/texture/VAO/queries and releases the GL context. Context loss switches to CSS; restoration rebuilds resources and reuploads the source. Missing/oversized/tainted sources, failed imports/compilation and unsupported shapes have explicit fallback reasons.

Reduced transparency and forced colors select CSS opaque material and suppress ongoing GPU draws. Reduced motion makes materialization immediate, fixes pointer-directed motion/press deformation and disables the laboratory's moving source. Application-owned moving media remains application-owned. Keyboard focus and child events remain ordinary HTML, with an additional visible focus-within outline. Higher contrast strengthens material backing without pretending to guarantee WCAG contrast for arbitrary foreground/background combinations.

## Scheduling, quality and cost

Static sources upload once and on invalidation/identity/size change. Subsequent geometry/light draws reuse texture storage with texSubImage2D for unchanged dimensions. RAF runs only for dirty work, active geometry/material animation or dynamic sources (capped at 60Hz). Offscreen and document-hidden renderers pause. An IntersectionObserver also stops the lab's scene producer when out of view.

One fullscreen triangle is restricted by a scissor rectangle to padded geometry bounds. Raster height derivatives reduce SDF work to one traversal per normal (instead of repeated finite differences); this is a raster approximation detailed in the mathematical model. Canvas resolution is capped at DPR 2, two million pixels and device texture limits. `low` caps DPR at 1; `high` is deterministic. `auto` lowers scale after nine consecutive pressured draws (CPU submission >8ms, available GPU draw >6ms, or request-to-RAF queue delay >28ms). At half scale, sustained pressure selects sticky CSS with reason `performance-budget`; changing quality or recreating the renderer permits retry. Queue delay includes application/browser load and is not proof that this shader caused it. This conservative policy trades fidelity for responsiveness, does not promise FPS and never automatically raises quality. The laboratory defaults to high for deterministic comparisons; normal library usage defaults to auto. Quality changes resolution, not the optical equations.

`onRenderStats` reports CPU measurement/upload/submission time, optional asynchronous non-disjoint GPU draw time, draw/upload counts, shapes, ratio and raw RGBA8 allocation estimates. GPU timer queries are optional and never synchronously waited on. No background readPixels is used. The allocation estimate excludes browser/driver copies, compositor surfaces and shared source storage. CPU time excludes deferred GPU execution; GPU draw timing excludes uploads, layout, paint and composition. Total display budgets are 16.67ms at 60Hz and 8.33ms at 120Hz, not available shader budgets.

Many independent GlassViews still mean multiple contexts and duplicated source textures. Use containers to batch related shapes. The 16-shape limit and texture limit cause CSS fallback rather than dropping visible children. Mobile hardware, high-refresh displays and heavy application scrolling require device profiling before deployment. See the [benchmark and fidelity record](liquid-glass-fidelity.md).
