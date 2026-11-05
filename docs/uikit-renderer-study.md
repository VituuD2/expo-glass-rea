# UIKit and Liquid Glass study

> Subsequent evidence: the user supplied a compressed, cropped WhatsApp reference video in `docs/references`. It was sampled and a frame sequence inspected; this does not provide an original screen recording, native runtime, or controlled color reference. See [fidelity improvements](liquid-glass-fidelity-improvements.md).

Date: 2026-11-04. Public documentation, the WWDC presentation and the local Expo source artifacts were inspected. No Apple hardware, native executable, private framework shader, Metal capture or paired Apple screenshot was available. This is behavioral reconstruction with independent mathematics.

## Evidence vocabulary

**CONFIRMED** means explicitly documented/demonstrated by Apple, not that this implementation matches it. **OBSERVED** means measured in our controlled browser tests. **INFERRED** means a reproducible independent engineering explanation. **HYPOTHETICAL** means an unverified mechanism. Code inspection is stated separately from runtime observation.

## Public API boundary

| API | Public contract — CONFIRMED | Consequence here |
|---|---|---|
| UIVisualEffect | Base effect description | Does not expose an optical algorithm |
| UIVisualEffectView | Applies effects in a view hierarchy; children belong to contentView | Separate optical decoration from accessible content |
| UIGlassEffect | Glass material, style initializer, tintColor, isInteractive | Preserve material/tint/interaction props |
| UIGlassContainerEffect | Combines nested glass effects behind contentView; spacing sets merge proximity | One shared surface per optical container |
| SwiftUI GlassEffectContainer | Collects effects for combined rendering and morphing | Shared geometry is a useful independent design |
| CALayer | Image-backed visual content, hierarchy, transforms, shadows and animation | Composition concepts, no evidence of a particular glass shader |

The first three UIKit contracts are documented in [UIVisualEffect](https://developer.apple.com/documentation/uikit/uivisualeffect), [UIVisualEffectView](https://developer.apple.com/documentation/uikit/uivisualeffectview) and [UIGlassEffect](https://developer.apple.com/documentation/uikit/uiglasseffect). Composition comes from [UIGlassContainerEffect](https://developer.apple.com/documentation/uikit/uiglasscontainereffect), [SwiftUI GlassEffectContainer](https://developer.apple.com/documentation/swiftui/glasseffectcontainer), and [CALayer](https://developer.apple.com/documentation/quartzcore/calayer). Apple Markdown endpoints were fetched when the web reader returned JavaScript-only pages.

UIVisualEffectView documentation also warns that alpha below one on the effect or ancestors can affect offscreen composition, and that an isolated effect snapshot may omit its effect. Those are native constraints; they do not justify copying Expo's installation workaround into a browser compositor. [Apple's view documentation](https://developer.apple.com/documentation/uikit/uivisualeffectview).

## Observable material contract

Apple demonstrates lensing, concentrated light, interactive illumination, flexible motion and materialization through changing optical properties. Appearance responds to background content; larger surfaces have stronger depth cues. These **CONFIRMED** behaviors motivate this engine; the underlying normal field, sampling offsets, Fresnel model and pass structure remain **HYPOTHETICAL** as descriptions of UIKit. [Meet Liquid Glass, Dynamics and Adaptivity](https://developer.apple.com/videos/play/wwdc2025/219/).

The two material variants serve different contexts; clear needs care over complex backgrounds. Accessibility choices can reduce transparency or motion and increase contrast. These are **CONFIRMED** design requirements, not calibration values for our shader. [Human Interface Guidelines: Materials](https://developer.apple.com/design/human-interface-guidelines/materials), [Adopting Liquid Glass](https://developer.apple.com/documentation/technologyoverviews/adopting-liquid-glass).

| Behavior | Evidence | Independent implementation / missing evidence |
|---|---|---|
| Curved lens distortion | CONFIRMED demonstration | SDF height + projected ray; grid test OBSERVED in Chromium |
| Specular/edge illumination | CONFIRMED demonstration | Normal-based light and Schlick approximation; no native parameter fit |
| Adaptive separation, tint, shadows | CONFIRMED demonstration | Continuous local luminance backing/shadow; narrower than native adaptivity |
| Regular / clear | CONFIRMED API/design | Different scattering/backing; appearance is approximated |
| Size and optical depth | CONFIRMED demonstration | Bounded size-dependent virtual height, INFERRED independent model |
| Press / focus response | CONFIRMED interactive contract | Pointer light, press depth and keyboard focus, no haptics |
| Morphing / merging | CONFIRMED container contract | Smooth SDF union, measured animated boxes; no general matched-shape choreography |
| Ambient influence | CONFIRMED demonstration | Local scene samples influence reflection; no full scene illumination |
| Accessibility | CONFIRMED guidelines | Opaque preference suppresses GPU; reduced motion suppresses optical deformation animation |
| Caustic transport / real two-interface ray tracing | Native algorithm unknown | Unsupported here; bright rim is not a caustic solver |
| Chromatic dispersion | Not established as universal native behavior | Optional independent experiment, off by default |

## Expo inspection

The official [Expo API documentation](https://docs.expo.dev/versions/latest/sdk/glass-effect/) was checked alongside the archived 58.0.5 source already present in this workspace. `artifacts/package/ios/GlassView.swift` creates UIVisualEffectView/UIGlassEffect, forwards tint/interactivity/theme/corners, and mounts React children into contentView. Its visibility display link and empty-effect reset govern installation/recycling. `GlassContainer.swift` installs UIGlassContainerEffect and sets spacing. Neither file contains optical shaders. Their source presence is verified; no native execution was performed. The archived [reverse-engineering report](reverse-engineering-report.md) retains detailed release provenance and native validation gaps.

## Metal and Core Animation

Public Metal examples illustrate explicit textures, render passes, lighting and resource management. They demonstrate how a GPU renderer can be built; they do not establish that UIGlassEffect uses those examples' architecture. This renderer uses WebGL2 because an explicit texture and one fragment pass suffice; no Apple pipeline is copied. [Apple: rendering a scene with deferred lighting](https://developer.apple.com/documentation/metal/rendering-a-scene-with-deferred-lighting-in-c%2B%2B).

Native visual validation still requires a controlled Apple app with the same scene, viewport, material, size, light state, color space and accessibility settings. Until then, there is no defensible numerical native-fidelity score.
