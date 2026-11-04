/** Browser capability, not availability of Apple's native UIGlassEffect. Safe during SSR. */
export function isGlassEffectAPIAvailable(): boolean {
  return typeof CSS !== 'undefined' && typeof CSS.supports === 'function'
    && (CSS.supports('backdrop-filter', 'blur(1px)') || CSS.supports('-webkit-backdrop-filter', 'blur(1px)'));
}

/** Preferences may make the surface opaque; they do not change API availability. */
export function isLiquidGlassAvailable(): boolean {
  return isGlassEffectAPIAvailable();
}
