# Independent screen-space optical model

> First optical renderer model, retained by `profile: 'legacy'`. The refined default uses analytic gradients, a C2 height profile, sRGB texture filtering and revised light transport; see [fidelity improvements](liquid-glass-fidelity-improvements.md) for the current equations, experiments and limits.

Implementation: `src/optics.ts` (CPU reference), `src/optical-shader.ts` (GLSL). This is a virtual lens model, not recovered UIKit source or a calibrated physical glass volume. All lengths are **CSS pixels in the host coordinate system**. Texture pixels and device pixels are mapped separately.

## Geometry and height

For a rounded rectangle centered at c, half-size b, and radius r selected by quadrant:

```text
q = abs(p-c) - b + r
d(p) = length(max(q,0)) + min(max(q.x,q.y),0) - r
```

Negative d is inside. Circular scalar corner radii are normalized for CSS overlap. Radius at most min(width,height)/2 is required by this quadrant formulation. Circles and capsules follow directly. Elliptical/superellipse contours and rotation/skew select CSS rather than silently changing the shape.

For two fields and merge parameter k:

```text
a = clamp(1/2 + (dB-dA)/(2k), 0, 1)
d = mix(dB,dA,a) - k*a*(1-a)
```

For k=0 use exact min. Material parameters use the same blend weight. The derivative inside the blend is `a*grad(dA)+(1-a)*grad(dB)`; the polynomial correction cancels the derivative of the weight. The field is C1 across blend boundaries where component fields are differentiable. Medial axes of an SDF can be nonsmooth; the plateau height removes their normal discontinuity in the interior. Sequential unions are deterministic but not associative; DOM order can influence triple junctions. The GPU uses `k=2*spacing`: for equal flat boundaries a bridge starts when the gap falls below spacing. This is our convention, not an Apple constant.

Let s be the smallest shape dimension, t the thickness control, and P optical presence:

```text
b = clamp(.2*s, 8, 32)
H = 48*t*clamp(sqrt(s/100), .6, 1.8)*P
h(p) = H*smoothstep(0,b,-d(p))
N = normalize(-dh/dx, -dh/dy, 1)
```

Height is bounded, with zero slope at the outer boundary and interior plateau. The CPU reference uses central differences with epsilon=.5 CSS px. The GPU uses raster derivatives of this same shared height, scaled from device pixels to local CSS pixels (and correcting the y sign). Derivatives run before divergent clipping branches, so neighboring fragments participate consistently. This replaces repeated SDF traversals; accuracy is limited by raster resolution and the 2x2 derivative quad. Press reduces H by up to 10% for interactive material. Geometry is remeasured during active DOM animations, resizing, mutation, scrolling and source notifications.

## Actual coordinate displacement

Axes: x right, y down, z toward viewer. Orthographic incident direction `I=(0,0,-1)`; N faces air. Air index n1=1; effective glass index n2 in [1,2], default 1.48. Snell's law `n1*sin(thetaI)=n2*sin(thetaT)` becomes the standard vector form:

```text
eta = n1/n2
c = dot(N,I)
K = 1 - eta^2*(1-c^2)
R = eta*I - (eta*c+sqrt(K))*N
```

Negative K means total internal reflection; the CPU function returns null. The supported GPU direction is air into n>=1, so K is nonnegative. The GLSL implementation uses the [standard refract operation](https://registry.khronos.org/OpenGL-Refpages/gl4/html/refract.xhtml).

Start the ray at `(p.x,p.y,h)` and intersect the virtual source plane z=0: `lambda=h/(-R.z)`. Therefore:

```text
D = strength * h * R.xy / max(.1,-R.z)
q = p + D
C_refracted = B(q)
```

There is a real geometric derivation for the sampling offset. The .1 denominator and 64px displacement-length cap prevent unstable extremes; they are deliberate nonphysical bounds. This is a **single curved entry interface projecting onto a virtual source plane**. It omits the exit interface and subsequent propagation of a thick physical lens. No millimeter-to-pixel conversion or full optical correctness is claimed. At index=1, thickness=0 or strength=0, displacement is zero; at a flat normal it is zero. Thickness changes both slope and propagation distance, so displacement is nonlinear in thickness.

The source rectangle is in viewport CSS coordinates. With host positive scales sx/sy and padding 28px:

```text
viewport = hostOrigin + (p-padding)*(sx,sy)
uv = (viewport-sourceOrigin)/sourceSize
```

UV clamps to [0,1]; applications should supply source pixels beyond the lens footprint to avoid clamped edge smearing. The source is stretched over its rectangle: CSS object-fit/background-position/cropping must be represented by the application. Scroll offsets are naturally included in getBoundingClientRect. Ancestor rotations, perspective, unsupported corners and internally scaled group children fall back to CSS. The renderer never obtains pixels from the DOM compositor.

## Reflection, scattering and transmission

Schlick reflectance uses `F0=((n1-n2)/(n1+n2))^2`, `F=F0+(1-F0)*(1-dot(N,V))^5` with V=(0,0,1). At 1/1.5 normal incidence F0=.04. Schlick is an approximation, not exact polarized Fresnel. A movable virtual light and normal-based Blinn half-vector lobe produce specular response. Roughness lowers the lobe exponent from 160 to 14. This is an inexpensive artistic lobe, not GGX or energy-conserving microfacet transport. A narrow geometric rim reinforces separation; it is not a caustic.

Scattering is a normalized five-tap cross kernel in linear RGB: center .4, four neighbors .15 each. Radius = roughness*(regular ? 6 : 2) pixels. It is a small controlled filter, not Gaussian scattering at multiple physical scales. Multipass/mipmap blur was not added because it adds buffers and dynamic-source work without reference captures to justify it. Optional dispersion offsets R/B in opposite displacement directions by at most one CSS pixel; default zero. With dispersion on, channel taps bypass the scattering kernel, a documented quality tradeoff.

Resolved CSS tint is converted to linear RGB. Artistic absorption is `sigma=(1-tintRGB)*tintAlpha`, with transmission `T=exp(-sigma*h/48)`. A small in-scatter term colors the absorbed contribution. Tint alpha is density, not measured extinction. Material backing and highlight gain are perceptual additions; the final composite is not an energy-conserving light-transport solution.

sRGB transfer functions use the .04045/.0031308 breakpoints. Local luminance is `Y=.2126R+.7152G+.0722B` in linear RGB. Four broad scene samples estimate ambient brightness; local luminance deviation increases backing separation. Computed DOM foreground luminance selects the direction of the backing (bright for dark text and vice versa). **Foreground colors never flip automatically.** Applications still own accessible text contrast. Continuous values and broad samples avoid a binary adaptation threshold; there is no temporal luminance-history framebuffer or automatic full-scene exposure system.

An exterior offset SDF with a smooth 24px falloff supplies a luminance-dependent contact shadow. It does not model colored shadow transport or identify text behind the material. Scene ambient color lightly informs the reflection. Regular uses more backing/scattering than clear. Optical presence interpolates with cubic smoothstep over the existing animation duration (up to 10s on the GPU); reduced motion makes the change immediate.

## Work and acceptance criteria

Each covered fragment evaluates one shared field, O(N), N<=16, and its height derivatives. Exterior shadow needs an additional field evaluation. Texture work is one central sample, four optional scattering taps, two optional dispersion taps, and four ambient taps, plus the original backdrop sample. A scissor rectangle limits shading to the padded geometry bounds. One triangle, one texture, no runtime readPixels or framebuffer ping-pong. `getImageData` is used only on a cached 1x1 CPU canvas to resolve CSS colors; it does not read the rendered background.

| Effect | Inputs / observable output | Reproducible acceptance |
|---|---|---|
| Refraction | Source, geometry, t, index, strength → B(p+D) | Grid rim changes with only refraction enabled; flat center remains coherent |
| Normal field | Shared h → unit N | CPU normalization/stability tests; GPU normal debug |
| Reflection | N, light, roughness, index → reflected light | Pointer changes illumination; index controls F0; separate toggle |
| Merge | Shapes, spacing → shared d/h | Bridge pixels refract using one canvas; no duplicate per-child optical rims |
| Transmission | Tint, h → channel attenuation | Bounded linear-color composition; no forced DOM color changes |
| Motion | DOM geometry, optical presence → stable mapping | Arrow/drag, resize, animated shape transitions; content remains usable |
| Debug | N / D / composition → RGB fields and arrows | Inspect modes in /lab and captured images |

CPU reference tests validate known analytic cases, continuity, zero-distortion cases and finite results. Browser tests validate integration and actual pixel change; they do not prove native equivalence. [Validation and remaining gaps](liquid-glass-fidelity.md).
