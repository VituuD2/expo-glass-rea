# Liquid Glass fidelity and validation

> Historical validation of the first optical implementation. The refined default and new reference footage, tests and benchmarks are documented in [fidelity improvements](liquid-glass-fidelity-improvements.md). Original results below are preserved rather than relabeled as measurements of the new shader.

This revision adds a functioning reusable optical renderer, not proof of Apple's private implementation or universal DOM refraction. The [baseline matrix](optical-feature-matrix.md) records the original source inspection at `1488c96`. The supplied audit and simulator were preserved. [UIKit evidence and references](uikit-renderer-study.md), [mathematics](optical-rendering-model.md), and [architecture/source support](web-renderer-architecture.md) explain the boundary of each claim.

## Feature comparison

“Implemented and validated” below means automated numerical/integration/pixel validation **in Chromium 156 on Windows**, not validated similarity to Apple. “Approximated” means a deliberate perceptual model. “Implemented but not fully validated” means the mechanism exists but needs broader measurement or a native reference. Native observations are documented public behaviors; no Apple runtime was available.

| Feature | Apple's public behavior / evidence | Original repository | Improved implementation / status |
|---|---|---|---|
| Geometry-dependent lensing | CONFIRMED visual demonstration | Missing | **Implemented and validated**: actual spatial sampling; grid rim pixel difference with other contributions disabled |
| Moving background distortion | CONFIRMED behavior | Live blur, no displacement | **Implemented and validated**: notified canvas updates, live video uploads |
| Normal/curvature field | Internal mechanism unknown | Missing | **Implemented and validated**: independent shared height derivative; unit reference and GPU diagnostics |
| Thickness-dependent lensing | CONFIRMED depth cues | Missing | **Implemented and validated** numerical model; native thickness calibration absent |
| Fresnel reflection | Native model unknown; reflections demonstrated | Static edge/shadows | **Approximated**: Schlick plus normal-based lighting, no captured environment map |
| Specular / pointer illumination | CONFIRMED interactive material | Static hover state | **Approximated**: movable light, roughness-dependent lobe; no native visual fit |
| Concentrated light / caustics | CONFIRMED visual appearance | Bright decorative border | **Partially supported**: curved sampling and rim lighting; no caustic/flux transport solver |
| Optical depth / transmission | CONFIRMED material appearance | RGBA / blur | **Approximated**: virtual height and artistic Beer–Lambert tint |
| Chromatic dispersion | Universal requirement not established | Missing | **Implemented but not fully validated**: optional <=1px experiment, off by default |
| Surface scattering | CONFIRMED appearance | CSS Gaussian blur | **Approximated**: bounded 5-tap linear-space kernel, no multipass physical scattering |
| Regular / clear / none | CONFIRMED public contract | Implemented CSS variants | **Implemented and validated** modes and retained children; shader appearance approximated |
| Size-dependent material | CONFIRMED demonstration | Fixed blur constants | **Approximated**: bounded sqrt(size) optical height |
| Background-aware backing | CONFIRMED adaptive behavior | Theme-only | **Partially supported**: continuous local luminance and contrast; no full native exposure policy |
| Adaptive foreground | CONFIRMED native legibility goal | Application text color | **Partially supported**: backing adapts to stable DOM foreground; no automatic text recoloring or contrast guarantee |
| Adaptive/contact shadows | CONFIRMED demonstration | Fixed box-shadow | **Approximated**: scene-luminance-dependent SDF shadow; no text classification or colored shadow transport |
| Ambient color | CONFIRMED demonstration | Tint prop only | **Approximated**: neighboring explicit-source colors influence reflection |
| Hover, focus, press, touch | CONFIRMED interactive contract | CSS states, ordinary events | **Implemented and validated** retained click/keyboard/drag; optical press/illumination approximated, no fluid spring/haptics |
| Materialization | CONFIRMED demonstration | CSS decoration opacity | **Approximated**: smoothly modulated optical height and presence; no native transition identity model |
| Regular↔clear / parameter animation | Public style transitions | CSS interpolation | **Partially supported**: none/presence and CSS geometry animate; most GPU parameter/style changes apply immediately |
| Shape morphing | CONFIRMED container behavior | Measured static/JS boxes | **Partially supported**: active CSS geometry transitions remeasured; no arbitrary path or matched-shape choreography |
| Merge/separate shared surface | CONFIRMED container contract | SVG alpha-mask bridge | **Implemented and validated** shared SDF/height/material canvas and merge pixel change; native shape fit unvalidated |
| Asymmetric corners / geometry | Public shape configuration | Scalar axis-aligned paths | **Partially supported**: scalar circular corners; unsupported ellipses/superellipses/transforms fall back |
| DOM foreground integrity | ContentView composition | Separate HTML content | **Implemented and validated**: text/actions/refs/focus remain ordinary DOM |
| Arbitrary live DOM refraction | Native compositor handles its view hierarchy | CSS blur only | **Blocked by browser constraints** for this WebGL texture path; CSS fallback retained; SVG backdrop experiment Chromium-only |
| Static images / bitmap / canvas / video | Native composition | CSS backgrounds | **Implemented and validated** explicit image, bitmap, OffscreenCanvas, canvas and live video texture uploads |
| WebGL producer synchronization | Not studied natively | No explicit source | **Implemented but not fully validated** generic canvas input; producer synchronization/discard rules remain caller-owned |
| SSR / Next / React lifecycle | Different native platform | Existing fixtures | **Implemented and validated** real Next server render/hydration, async import cancellation, StrictMode, context loss/restoration |
| Accessibility preferences | CONFIRMED design requirements | Existing CSS media rules | **Implemented and validated** reduced motion/transparency, forced colors and HTML focus in Chromium; platform media support varies |
| Adaptive performance | Native performance not measured | No GPU instrumentation | **Implemented and validated** timing hooks, idle scheduling, bounds/limits, quality pressure policy; hardware GPU/mobile profiling missing |
| WebGPU | No evidence about native use | Absent | **Unsupported/deferred**: no demonstrated advantage or solution to DOM texture access |

## Automated evidence

Commands executed from the repository root:

| Command | Actual result |
|---|---|
| `npm ci --fetch-retries=0 --fetch-timeout=30000` | 44 packages installed from lockfile; audit reported zero vulnerabilities at execution time |
| `npm run typecheck` | Passed |
| `npm run build:lib` | Passed; original four runtime exports retained |
| `npm run test:unit` | **17 passed, 0 failed** (9 compatibility + 8 optics/SSR/selection cases) |
| `npm run build` | Library + Vite demo passed; optical engine is a separate lazy chunk, approximately 8KB gzip |
| `npm run build:next` | Next 16.4.5 webpack production build and static prerender passed |
| `npm run test:e2e` | **22 passed, 0 failed**, including all 11 original browser tests |
| `npm run benchmark:optics` | Four DPR/shape-count scenarios captured in the JSON below |
| `npm run benchmark:optics -- --auto` | Automatic-quality stress scenario captured separately |
| `npm pack --dry-run --json` | Passed; 27 files, including lazy renderer/shader, declarations and CSS; no package generated or published |
| `git diff --check` | Passed |

The initial sandboxed npm installation failed because of cache/network restrictions; installation succeeded outside it. Sandboxed Playwright executed tests but could not terminate its Windows server process tree; completed runs used process permissions outside that sandbox. These are environment limitations, not unreported passing test runs. Vite warns about use-client directives in the browser-only demo build; the TypeScript-emitted library retains those directives and was tested in Next.

[Machine-readable browser results](verification/optical-browser-results.json) contain the executed tests and attachments. They cover Snell/Fresnel separately through unit tests, SSR prop stripping, controlled pixel differences, shape changes, scrolling canvas typography, moving content, source readiness/security, opacity/hidden/remount regressions, controls, focus, accessibility, missing WebGL, unsupported geometry, the 16-shape limit, context loss/restoration, asynchronous cancellation and quality fallback/override. Image comparison is scoped to our controlled scene; it is not a native similarity metric.

In the final refraction-only grid comparison, **1269 rim pixels** changed by more than 20 summed RGB code values, while the sampled central band had **zero RGB difference**. Total rim difference was 313634 RGB code values. The captures hold material, geometry and other contributions fixed and change only refraction strength 0→1; this demonstrates spatially localized distortion rather than a blur-only change. These values depend on the fixed viewport/grid and are regression diagnostics, not perceptual scores. Grid, normal-field, displacement and mobile captures were also visually inspected.

The SVG experiment reports **0 changed pixels** for filtering an empty transparent element and **1040 changed pixels** for the SVG URL backdrop filter. This is an OBSERVED Chromium result only. It is not silently promoted to a portable DOM refraction capability.

Selected reproducible captures:

- [Grid with scattering/reflection/adaptation/shadows disabled](verification/optical-grid.png)
- [Normals](verification/optical-normals.png), [displacement vectors](verification/optical-displacement.png)
- [Mobile laboratory](verification/optical-mobile.png)

## Performance results and limits

[Full benchmark data and environment](verification/optical-benchmark.json): Windows 10.0.26200 x64, Intel i5-9400, Chromium 156.0.8078.4, **ANGLE SwiftShader software renderer**, viewport 1440×1100. Each scenario includes a card plus one shared group, 40 RAF warmup callbacks then 120 measured callbacks (119 intervals). The entire canvas scene is redrawn/notified and uploaded; the laboratory's high quality disables automatic adaptation. These are total RAF cadence samples, not exclusively optical GPU timing.

| High-quality scene | RAF interval p50 / p95 | Card CPU submission p95 | Group CPU submission p95 | Estimated combined texture/buffer memory |
|---|---:|---:|---:|---:|
| DPR 1, 2 group shapes | 33.3 / 33.4ms | 3.1ms | 4.2ms | 5.0MiB |
| DPR 1, 16 group shapes | 83.3 / 100.0ms | 4.8ms | 4.4ms | 5.0MiB |
| DPR 2, 2 group shapes | 99.9 / 116.7ms | 9.4ms | 9.5ms | 19.9MiB |
| DPR 2, 16 group shapes | 283.4 / 349.9ms | 20.9ms | 14.5ms | 19.9MiB |

All static scenarios recorded **zero renderer draws during the 250ms idle window**. The timer extension did not yield GPU samples in this environment, so GPU frame time is **unmeasured**, not zero. Texture estimates exclude scene storage, browser copies, driver allocations and CSS compositor surfaces. Driver readback warnings during canvas upload/screenshot capture are not evidence of production code calling readPixels.

Forced high quality on this software renderer does **not** meet a 60Hz budget, and the 16-shape/DPR2 stress case is unsuitable without fallback. The automatic-quality stress run reduces resolution and eventually selects CSS with reason `performance-budget`, preserving responsiveness at lower optical fidelity. Its exact timing, active paths and remaining samples are recorded under `adaptiveCase` in the JSON. The quality-policy test also uses deterministic artificial scheduling pressure to verify the policy independently of machine speed; that synthetic test is not a performance benchmark.

The final automatic stress run recorded RAF interval p50 **16.7ms**, p95 **33.4ms**; both the card and group ended on CSS. This is improved responsiveness **after sacrificing optical refraction**, not evidence that the GPU path achieved 60Hz. The interval window includes the last few optical draws and the transition to fallback.

Raster height derivatives and scissoring reduce repeated SDF evaluations and irrelevant fragments. Nevertheless, dynamic full-scene texture uploads, multiple independent contexts, high DPR and many shapes are material risks. The implementation is reusable and tested on this configuration; **hardware-accelerated desktop/mobile production performance and 120Hz behavior remain unvalidated**. No shipping-readiness claim is made for unprofiled target devices.

## Reproduce and extend

```sh
npm ci
npm run typecheck
npm run build
npm run test:unit
npm run build:next
npx playwright install chromium   # only if the matching browser is absent
npm run test:e2e
# Separate terminal:
npm run dev -- --port 4173 --strictPort
# Then:
npm run benchmark:optics
npm run benchmark:optics -- --auto
```

Benchmark a quiet machine with no concurrent browser tests/builds. Record browser/driver, hardware/software rasterizer, viewport, DPR, scene and quality. Compare edge coordinates, local contrast and temporal stability in controlled captures. Native comparison requires equivalent captures from supported Apple hardware; none were supplied. SSIM is therefore not reported, and would not establish physical or perceptual parity by itself.

Remaining work includes Safari/Firefox and real iOS/Android testing, hardware GPU timers/profiling, paired Apple reference captures, better native-calibrated profiles, arbitrary-path geometry, full ambient/shadow transport, temporal background-history adaptation, continuous GPU style interpolation and a broadly interoperable DOM-backdrop displacement strategy. These are explicit fidelity gaps, not hidden capabilities.
