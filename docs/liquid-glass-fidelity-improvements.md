# Liquid Glass: rendering quality and fidelity improvements

This is an independent web material model. It improves the previous optical engine, preserved as `opticalOptions.profile: 'legacy'`; it does not reproduce a recovered UIKit shader. The four runtime exports and ordinary CSS/SVG usage remain intact. No runtime dependency was added.

## Evidence and reference footage

The supplied file is [WhatsApp Video 2026-11-04 at 7.58.14 PM.mp4](<references/WhatsApp Video 2026-11-04 at 7.58.14 PM.mp4>): **848 × 192**, **22.543333 seconds**. It is cropped, compressed and not an original full-resolution screen recording. Its SHA-256, sampling times and initial renderer diagnostics are in [reference-inspection.json](verification/fidelity/reference-inspection.json).

Eight samples across the clip and [20 frame-callback deliveries around 2.8–3.15 seconds](verification/fidelity/reference-sequence.png) were inspected. The [sequence metadata](verification/fidelity/reference-sequence.json) records media times and presented-frame counters, including a skipped delivery; this is not a claim to have decoded every original video frame. The frames show localized colored transitions, a bright moving edge lobe, a quieter center and continuous selector movement. These are **OBSERVED in the supplied recording**. Device DPR, original color values, source frame rate, OS build and shader mechanism are not established from this artifact. No SSIM, native-fidelity percentage or pixel-level Apple color fit is reported.

Apple's public presentation confirms the design goals of lensing, interaction and adaptivity; the mathematics here is an independent approximation. [Meet Liquid Glass](https://developer.apple.com/videos/play/wwdc2025/219/), [Materials guidelines](https://developer.apple.com/design/human-interface-guidelines/materials). The requested `relatorio_comparativo_liquid_glass_iphone_web_2026-11-04.md` was **not present**, and no contents were inferred for it. The other requested documents and actual source/tests were inspected. No root/ancestor AGENTS.md was found; the Next fixture instructions and installed Next documentation were respected. Existing modifications and the supplied recording/audit/simulator were preserved.

## Verify the actual renderer first

The initial real-browser check found **WebGL2 active**, `explicit-source`, a 346 × 296 backing canvas at DPR 1 and a 996 × 510 source canvas. That baseline is retained in the reference inspection JSON and [before capture](verification/fidelity/before-lab.png). The previous appearance was therefore not misdiagnosed CSS fallback.

`onRenderStats` now also reports:

- Actual renderer/fallback reason, shader status and source type/validity.
- Display DPR, effective scale, canvas/source pixel dimensions and selected quality.
- Estimated allocation, CPU submission and upload submission time, optional asynchronous GPU draw time.
- Active texture filtering and motion energy.

The `/lab` diagnostics panel exposes these fields. Manual CSS shows zero active canvas allocation rather than stale GPU dimensions. Profile changes mark the layer `initializing` until the replacement actually renders. Failed shaders, missing sources, security restrictions, context loss and performance fallback remain distinguishable. GPU timers are unavailable in the measured Chromium configuration; absence is not reported as zero milliseconds.

## Resolved artifacts and model changes

| Area | Previous optical renderer | Refined default | Relation to native reference / remaining gap |
|---|---|---|---|
| Normal field | Raster derivatives of height, dependent on 2×2 fragment quads | Analytic SDF, union and height gradients | Reduces block-shaped highlights; not evidence of Apple's normal calculation |
| Boundary coverage | Resolution-dependent fixed smoothstep width | SDF `fwidth` coverage, computed before divergent branches | Smooth circle/rounded edges at DPR 1/1.5/2/3; no universal display-quality guarantee |
| Resolution | Automatic scale could go below one device pixel per CSS pixel | Automatic floor of effective DPR 1 (or native DPR if below 1), with hard resource caps retained | Explicit scale overrides can deliberately lower quality; no blind DPR 3 default |
| Refraction | Stronger cubic bevel and single interface | C2 quintic bevel, thinner virtual profile and controlled 32px vector bound | More stable center and gentler periphery; native optical constants uncalibrated |
| Two interfaces | Absent | Optional curved entry + planar exit projection | More edge displacement; retained as experiment, not default |
| Dispersion | R/B offsets along an existing displacement, bypassing channel scattering | Wavelength-dependent indices and independently filtered R/B samples | Localized by geometry, off by default, no center color ghosting |
| Spectral edge light | Absent | Separate directional spectral-looking lobe | Stylized environment radiance, **not** asserted thin-film interference or Apple's algorithm |
| Reflection | Blinn-style lobe and bright permanent rim | GGX-inspired lobe, Schlick reflectance, bounded light blend and restrained directional edge illumination | No full environment map, caustic solver or calibrated native BRDF |
| Color | sRGB decoded after texture interpolation | SRGB8_ALPHA8 decodes before filtering; material operations in linear RGB; one output encoding | Tested SDR sRGB only; no HDR/Display P3 accuracy claim |
| Source sampling | Edge-coordinate clamp and isolated blur taps | Half-texel clamp, displacement fade near source limits, cached mip scale space or fresh live kernel | Outside-source content and arbitrary DOM cannot be reconstructed |
| Scattering | Five sparse taps, channel mismatch under dispersion | Small clear-material radius bypass, cached mip filtering for static sources, normalized fresh five-tap live kernel | Approximate scattering; static/live filters are not pixel-identical |
| Alpha/shadows | Separate exterior branch could leave a thin uncovered transition | Continuous glass-over-shadow alpha composition | Preserves HTML foreground; not volumetric shadow transport |
| Motion | Immediate press and direct pointer light | Exact critically damped springs, subtle velocity stretch, press depth and lagged light | No exaggerated jelly, haptics or full fluid simulation |
| Navigation | No controlled selector scene | Light/dark navigation with a moving optical capsule; fixed crisp HTML icons/labels | Deliberately keeps foreground undistorted, unlike some magnification visible in the supplied clip |
| Merging | Shared SDF, but raster normal and instantaneous material changes | Shared analytic derivative including changing height/bevel parameters; material spring | Two-shape continuity tested; sequential unions remain order-dependent at complex junctions |
| Material adaptation | Four point samples and relatively bright backing | Regional cached-mip luminance for static sources; broad fresh samples for live sources; restrained backing | No temporal luminance-history buffer, automatic arbitrary-content recoloring or contrast guarantee |
| Regular/Clear | Mostly blur/backing differences | Different height, bevel, refraction, scattering, backing, specular gain and tint response | Independently chosen web profiles, not recovered UIKit parameter sets |

## Mathematical derivation

Lengths remain local CSS pixels. The rounded-rectangle SDF returns both distance `d` and analytic gradient `g`. For smooth union weight `a = clamp(.5 + (dB-dA)/(2k),0,1)`:

```text
d = mix(dB,dA,a) - k*a*(1-a)
grad(d) = mix(grad(dB),grad(dA),a)
grad(a) = (grad(dB)-grad(dA))/(2k) inside the blend; zero outside
```

Height amplitude and bevel width carry their own derivatives through this interpolation. Thus differing component sizes/thicknesses do not simply drop the derivative of the material blend. Medial-axis SDF singularities are controlled by the flat interior profile; corners outside the supported circular-radius model retain CSS fallback.

For size `s`, thickness `t`, presence `P`, Regular amount `r`, press `p` and normalized spring velocity `v`:

```text
H = 32*t*clamp(sqrt(s/110),.65,1.45)*P*(1-.06*r)*(1-.07*p+.025*length(v))
b = clamp(s*(.24-.02*r),10,30)
q = clamp(-d/b,0,1)
f(q) = 6q^5-15q^4+10q^3
h = H*f(q)
grad(h) = grad(H)*f(q) + H*30q²(q-1)²*grad(q)
N = normalize(-grad(h),1)
```

The quintic profile has zero first and second derivative at the bevel endpoints. Fractional SDF coverage uses a half-width based on `fwidth(d)` in output pixels. Normals do not use screen-space derivatives, so resolution changes do not change the virtual surface. GPU quantization and raster sampling remain finite approximations.

Model A projects the refracted entry ray to the virtual background plane as before: `D = strength*h*R.xy/max(.12,-R.z)`. Model B additionally refracts that ray through a planar glass-to-air interface and propagates it through a gap `.18*H`. Total-internal-reflection cases retain the entry projection rather than generating NaN/black samples. This is a cheap column model, **not** a solved thick lens or exit-surface intersection tracer.

For a 290 × 240 card with thickness .5, index 1.48 and strength .6, a 0.1px scan across its middle gives:

| Projection | Maximum displacement | Largest adjacent change per 0.1 CSS px |
|---|---:|---:|
| Previous shader model | 6.9855px | .15112px |
| Refined single interface | 3.6521px | .05526px |
| Refined two interfaces | 5.0763px | .07172px |

These are independent CPU model measurements, not an Apple comparison. Both new models have a flat stable center. The single-interface profile was selected as default because it preserves the measured continuity with less peripheral stretching; the additional interface did not establish a compelling native-fidelity benefit. [Calibration data and aligned captures](verification/fidelity/calibration.json).

Dispersion uses effective indices `nR=max(1,n-.012*d)` and `nB=min(2,n+.0156*d)`, reprojects each ray and bounds offsets relative to green by .7 CSS px per axis. The same scattering path applies to each channel. The separate spectral lobe uses boundary orientation, normal tilt, a localized bevel arc and light direction. Its colored basis is a perceptual approximation; no physical thin film is invented to explain the recording.

The reflection lobe uses a bounded GGX distribution and approximate masking term, with Schlick reflectance. It is blended as bounded SDR radiance instead of additive values that hard-clip to a white perimeter. This adopts general public microfacet concepts, not a native implementation. [Walter et al., Microfacet Models for Refraction](https://www.cs.cornell.edu/~srm/publications/EGSR07-btdf.pdf). Antialiasing uses the [GLSL derivative contract](https://registry.khronos.org/OpenGL-Refpages/gl4/html/fwidth.xhtml).

## Motion and interaction

The exact critically damped step for fixed target over `dt` uses `x=position-target`, `c=velocity+omega*x`, `e=exp(-omega*dt)`:

```text
position' = target + (x+c*dt)*e
velocity' = (velocity-omega*c*dt)*e
```

The time step is bounded after pauses; small settled values snap to rest. Shader geometry stretches by at most 1.8% per velocity axis and press reduces dimensions by at most 1.2%/2.2%. The same state changes height, normals, refraction and light energy. Pointer light has restrained spring lag. Presence uses the existing animation-duration contract; Regular/Clear optical interpolation uses settling dynamics rather than claiming exact native timing.

The lab selector uses a spring position while its HTML labels counter-translate, so icons and hit targets stay fixed and sharp. Keyboard arrows change tabs, focus remains usable and press/release reaches the material. Reduced motion snaps selector motion and disables optical deformation. RAF stops after settling, offscreen and while the document is hidden.

## Performance experiment and quality policy

An initial refined version regenerated sRGB mipmaps for the entire source on every upload and regressed badly on SwiftShader. That experiment is retained in [benchmark-initial-refined.json](verification/fidelity/benchmark-initial-refined.json). An intermediate shader edit also introduced a GLSL name collision; diagnostics detected CSS fallback, the edit was corrected and apparent 16.7ms “optical” timings from that failed run were **discarded**. Scripts now require an active GPU path before accepting optical measurements.

The final source policy uses cached mipmaps for static updates, and fresh base-level linear samples for explicit dynamic sources or repeated source uploads (four updates within a one-second cadence window). It never samples stale mip levels: the shader and minification filter switch together. A new sporadic update can rebuild the static scale space. `textureFiltering` can force either path for experiments. Static scattering uses a single cached scale-space sample; the live path uses fresh normalized taps. This trades minification/scattering quality for live-source cost, while keeping sRGB interpolation, the displacement equation, coverage and normals intact.

Automatic surface quality ignores the first three startup draws, waits for 18 consecutive pressured draws, uses GPU draw timing when available and queuing only when GPU timing is absent. It can recover after 90 good draws, reduces resolution in modest steps, never intentionally crosses effective DPR 1, and retains sticky CSS fallback at the floor. Explicit manual scale and the two-million-pixel/device limits can still lower resolution. The default DPR cap is 2; up to 3 is an explicit small-surface option. No 60/120Hz target is inferred from CPU submission time alone.

[Final benchmark JSON](verification/fidelity/benchmark.json) reports paired legacy/refined moving-source scenes at DPR 1 and 2 with 2/16 group shapes, plus actual static-source navigation motion. It records the software renderer, upload submission, total RAF cadence, optional GPU timer, allocation estimate and idle callback count. A numerical summary is provided after the final runs below. Mip allocation estimates exclude driver/browser copies and should not be treated as measured GPU residency.

## Laboratory and validation

Open `/lab`. Existing scenes are retained; new ones include pixel-quality lines, sRGB patches, light/dark navigation and dynamic interaction. Controls expose profile A/B, both ray models, source filtering, DPR cap, scale, AA, separate spectral/dispersion effects, lighting, tint, material, motion and debug fields. The compressed reference is playable on demand. The recording is bundled only with the demo; it is not a library runtime dependency.

The test-only pixel harness reads the GL buffer immediately after drawing. Production code does not call `readPixels`. At DPR 1/1.5/2/3 the circle had 852/1294/1740/2590 partially covered edge pixels; disabling AA produced zero. Decoded normals agreed with the analytic model within the test tolerance. These counts characterize coverage, not subjective optical fidelity.

In the isolated color experiment, spectral edge radiance changed 2453 pixels, with zero center or alpha changes. Dispersion changed 1351 R/B pixels with zero green-channel change. Four calibrated sRGB patch samples matched the expected linear-light clear backing exactly in the recorded run (black→36, gray128→132, white→255). [Machine-readable measurements](verification/fidelity/validation-metrics.json). These scene-specific numbers can vary when the test fixture changes.

Remaining gaps: original uncompressed iPhone captures and paired assets; real iOS Safari/mobile/hardware-GPU/120Hz profiling; general rotated/elliptical/arbitrary geometry; full caustics/ambient transport; luminance history; native managed foreground magnification; and universal arbitrary-DOM texture access. The explicit source contract, cross-origin restrictions, CSS/SVG fallback, SSR and accessible HTML content remain in effect.

## Reproduce

```sh
npm run build:lib
npm run typecheck
npm run test:unit
npm run test:e2e
npm run test:e2e -- --config playwright.compat.config.ts
npm run build
npm run build:next
# Keep a Vite server on 127.0.0.1:4173; run benchmarks on a quiet machine:
node scripts/inspect-reference.mjs
node scripts/reference-sequence.mjs
node scripts/calibrate-fidelity.mjs
node scripts/benchmark-fidelity.mjs
node scripts/summarize-fidelity.mjs
```

Detailed command results and final timings are recorded below. Windows process/cache permissions were required for installing additional test browsers and terminating the Playwright server tree. WebKit on Windows is useful engine coverage, not a substitute for an iPhone/Safari test.

## Measured results

The final paired benchmark used Chromium 156.0.8078.4, Windows x64, Intel i5-9400 and **ANGLE SwiftShader software rendering**, 1440 × 1100 viewport, 24 RAF warmup callbacks and 80 measured callbacks per case. No readPixels instrumentation or concurrent test/build was used. Values are total RAF intervals, not exclusively shader time.

| Scenario | Previous p50 / p95 | Refined p50 / p95 |
|---|---:|---:|
| Moving source, DPR 1, 2 group shapes | 33.3 / 33.4ms | 33.3 / 50.0ms |
| Moving source, DPR 1, 16 group shapes | 66.7 / 83.4ms | 100.1 / 133.2ms |
| Moving source, DPR 2, 2 group shapes | 100.0 / 116.7ms | 133.3 / 150.1ms |
| Moving source, DPR 2, 16 group shapes | 266.8 / 316.7ms | 400.0 / 466.6ms |
| Actual selector movement, DPR 2, one static-source lens | 33.3 / 50.0ms | 33.4 / 50.1ms |

The optimized refined version is substantially faster than the first refined experiment (e.g. the DPR2/16-shape median changed from 616.6 to 400ms), but **still costs more than the previous shader in the moving-source stress tests**. The navigation use case retained similar cadence on this software renderer. This is a measured fidelity/performance tradeoff, not an Apple-level speed claim. Native hardware GPU behavior is unmeasured.

For navigation, refined CPU submission p95 was .5ms, source upload submission p95 was zero during movement (texture reused), and estimated texture/buffer allocation was 10.9MiB versus 8.3MiB for the previous path. GPU timer results were unavailable. Every scenario recorded zero renderer callbacks during the 250ms idle window after settling. Large live sources, many shapes, high DPR and separate contexts remain expensive; use automatic fallback and profile real target devices. Cached mip levels explain part of the extra estimated memory even after live sampling switches to base level.

| Executed command | Final result |
|---|---|
| `npm run typecheck` | Passed |
| `npm run test:unit` | 21 passed |
| `npm run test:e2e` | 27 passed, zero skipped/flaky/unexpected |
| `npm run test:e2e -- --config playwright.compat.config.ts` | 6 passed across Chromium, Firefox and WebKit; WebGL2 active in all three |
| `npm run build` | Library and production Vite demo passed |
| `npm run build:next` | Production webpack build, TypeScript and static prerendering passed |
| `npm pack --dry-run --json` | 31 package entries; both shader profiles and declarations included; no publication |
| `node scripts/calibrate-fidelity.mjs` | 18 aligned stage captures and numerical model scan saved |
| `node scripts/benchmark-fidelity.mjs` | 10 paired scenarios recorded |

The complete Chromium suite includes the original 22 tests plus DPR/color/motion/sampler calibration. Final [browser results](verification/fidelity/browser-results.json), [compatibility results](verification/fidelity/compatibility-results.json), [calibration](verification/fidelity/calibration.json) and [measurements](verification/fidelity/validation-metrics.json) are retained. Local documentation links were checked (39 targets, none missing) and `git diff --check` passed. Existing Vite warnings about client directives in demo bundling do not affect the emitted library client boundaries. A signed-zero assertion in an initial numerical test was corrected to compare numerical values; no optical discrepancy was concealed by that correction. Final captures were also visually inspected for the grid, navigation and high-frequency line scenes. These checks establish browser behavior and reproducibility, not native visual equivalence or mobile production performance.
