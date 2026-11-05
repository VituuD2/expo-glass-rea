import type { CSSProperties, HTMLAttributes, Ref } from 'react';

export type GlassStyle = 'clear' | 'regular' | 'none';
export type GlassColorScheme = 'auto' | 'light' | 'dark';
export type GlassEffectStyleConfig = {
  style: GlassStyle;
  animate?: boolean;
  /** Seconds, as in the reference API. */
  animationDuration?: number;
};
export type GlassTintColor = string
  | { light: string; dark: string }
  | { dynamic: { light: string; dark: string; highContrastLight?: string; highContrastDark?: string } }
  | { semantic: string[] };

export type GlassViewStyle = CSSProperties & {
  borderTopStartRadius?: number | string;
  borderTopEndRadius?: number | string;
  borderBottomStartRadius?: number | string;
  borderBottomEndRadius?: number | string;
  borderCurve?: 'continuous' | 'circular';
};
export type GlassRenderingMode = 'auto' | 'css' | 'webgl2';
export type GlassDebugView = 'none' | 'normals' | 'displacement' | 'layers';
export type GlassBackgroundRect = { left: number; top: number; width: number; height: number };
/** Opaque, origin-clean pixels stretched over getRect() in viewport CSS pixels.
 * This is an explicit scene source, never a capture of arbitrary HTML. */
export interface GlassBackgroundSource {
  getSource(): HTMLImageElement | HTMLVideoElement | HTMLCanvasElement | OffscreenCanvas | ImageBitmap | null;
  getRect(): GlassBackgroundRect;
  /** Notify after pixels, source identity, or external scene layout changes. */
  subscribe?(invalidate: () => void): () => void;
  /** Continuously upload while visible, capped at display/60 Hz. Prefer subscribe for static scenes. */
  dynamic?: boolean;
}
export interface GlassRenderStats {
  frames: number;
  uploads: number;
  /** CPU submission only; excludes deferred GPU work. */
  cpuMs: number;
  /** Asynchronous timer query, if supported and not disjoint. */
  gpuMs?: number;
  pixelRatio: number;
  /** RGBA8 texture + drawing buffer estimate; excludes driver/compositor overhead. */
  estimatedBytes: number;
  shapes: number;
  activeRenderer?: 'css' | 'webgl2';
  fallbackReason?: string;
  devicePixelRatio?: number;
  effectiveRenderScale?: number;
  canvasPixelWidth?: number;
  canvasPixelHeight?: number;
  backgroundSourceType?: string;
  backgroundSourceValid?: boolean;
  shaderCompilationStatus?: 'pending' | 'compiled' | 'failed' | 'lost';
  qualityLevel?: string;
  sourcePixelWidth?: number;
  sourcePixelHeight?: number;
  /** Submission time of the last texture upload/mipmap update; not GPU execution time. */
  uploadCpuMs?: number;
  motionEnergy?: number;
  textureFiltering?: 'mipmap' | 'linear';
}
export interface GlassOpticalOptions {
  /** Previous shader retained for controlled comparison; defaults to refined. */
  profile?: 'refined' | 'legacy';
  /** Single curved entry or curved entry + planar exit projection. */
  refractionModel?: 'single' | 'two-interface';
  /** Effective index, bounded to [1, 2]. Default 1.48; not an Apple constant. */
  refractiveIndex?: number;
  /** Wavelength-refraction amount [0,1]. Off by default; per-channel offsets stay below .7 CSS px per axis. */
  dispersion?: number;
  /** Localized, stylized spectral edge radiance, independent of background dispersion. Default .16. */
  edgeSpectrum?: number;
  edgeIllumination?: boolean;
  antialiasing?: boolean;
  /** Explicit quality controls. Default max DPR 2, scale 1; automatic quality never drops below DPR 1. */
  maxPixelRatio?: number;
  resolutionScale?: number;
  /** Auto caches mipmaps for static sources and uses fresh linear samples for rapidly changing sources. */
  textureFiltering?: 'auto' | 'mipmap' | 'linear';
  /** Disable spring response without changing DOM interaction. Default true. */
  motion?: boolean;
  reflection?: boolean;
  scattering?: boolean;
  shadows?: boolean;
  debug?: GlassDebugView;
  quality?: 'auto' | 'high' | 'low';
}
export interface GlassOpticalProps {
  renderingMode?: GlassRenderingMode;
  backgroundSource?: GlassBackgroundSource;
  /** Dimensionless controls in [0, 1]. Defaults: .6, .5, .2. */
  refractionStrength?: number;
  opticalThickness?: number;
  surfaceRoughness?: number;
  adaptiveLighting?: boolean;
  opticalOptions?: GlassOpticalOptions;
  /** Called after draws; keep handlers cheap. No GPU readback. */
  onRenderStats?: (stats: GlassRenderStats) => void;
}
export interface GlassViewProps extends Omit<HTMLAttributes<HTMLDivElement>, 'style'>, GlassOpticalProps {
  ref?: Ref<HTMLDivElement>;
  glassEffectStyle?: GlassStyle | GlassEffectStyleConfig;
  tintColor?: GlassTintColor;
  isInteractive?: boolean;
  colorScheme?: GlassColorScheme;
  style?: GlassViewStyle;
}
export interface GlassContainerProps extends HTMLAttributes<HTMLDivElement>, GlassOpticalProps {
  ref?: Ref<HTMLDivElement>;
  /** Merge influence in CSS pixels; omitted = 20, zero = no bridge. Does not set layout gap. */
  spacing?: number;
}
