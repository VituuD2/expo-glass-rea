import type { CSSProperties } from 'react';
import type { GlassEffectStyleConfig, GlassStyle, GlassTintColor, GlassViewStyle } from './types.js';

const styles: GlassStyle[] = ['regular', 'clear', 'none'];
export function normalizeEffect(value?: GlassStyle | GlassEffectStyleConfig) {
  const config: Partial<GlassEffectStyleConfig> = typeof value === 'object' && value !== null ? value : { style: value };
  const duration = config.animationDuration;
  return {
    style: styles.includes(config.style as GlassStyle) ? config.style as GlassStyle : 'regular',
    animate: config.animate === true,
    duration: typeof duration === 'number' && Number.isFinite(duration) && duration >= 0 ? duration : 0.35,
  };
}

const semanticColors: Record<string, string> = {
  systemBlue: '#007aff', systemIndigo: '#5856d6', systemRed: '#ff3b30',
  systemGreen: '#34c759', label: 'CanvasText', systemBackground: 'Canvas',
};
export function tintColors(value?: GlassTintColor): [string, string, string, string] {
  if (typeof value === 'string') return [value, value, value, value];
  if (!value || typeof value !== 'object') return ['transparent', 'transparent', 'transparent', 'transparent'];
  if ('semantic' in value && Array.isArray(value.semantic)) {
    const name = value.semantic.find((name) => typeof name === 'string' && Object.hasOwn(semanticColors, name));
    const color = name ? semanticColors[name] : 'transparent';
    return [color, color, color, color];
  }
  const colors = value && 'dynamic' in value ? value.dynamic : value;
  if (colors && typeof colors === 'object' && 'light' in colors && typeof colors.light === 'string' && typeof colors.dark === 'string') {
    const contrast = colors as { highContrastLight?: string; highContrastDark?: string };
    return [colors.light, colors.dark, contrast.highContrastLight ?? colors.light, contrast.highContrastDark ?? colors.dark];
  }
  return ['transparent', 'transparent', 'transparent', 'transparent'];
}

export function glassStyle(input: GlassViewStyle = {}): CSSProperties {
  const {
    borderRadius, borderTopLeftRadius, borderTopRightRadius, borderBottomLeftRadius, borderBottomRightRadius,
    borderTopStartRadius, borderTopEndRadius, borderBottomStartRadius, borderBottomEndRadius,
    borderStartStartRadius, borderStartEndRadius, borderEndStartRadius, borderEndEndRadius, borderCurve,
    ...rest
  } = input;
  const radii = {
    uniform: borderRadius ?? 0, tl: borderTopLeftRadius, tr: borderTopRightRadius,
    bl: borderBottomLeftRadius, br: borderBottomRightRadius,
    ts: borderTopStartRadius ?? borderStartStartRadius, te: borderTopEndRadius ?? borderStartEndRadius,
    bs: borderBottomStartRadius ?? borderEndStartRadius, be: borderBottomEndRadius ?? borderEndEndRadius,
  };
  const variables = Object.fromEntries(Object.entries(radii).filter(([, value]) => value !== undefined).map(([key, value]) => [
    `--glass-radius-${key}`, typeof value === 'number' ? `${Number.isFinite(value) ? Math.max(0, value) : 0}px` : value,
  ]));
  return { ...rest, ...variables, ...(borderCurve ? { cornerShape: borderCurve === 'continuous' ? 'squircle' : 'round' } : {}) } as CSSProperties;
}
