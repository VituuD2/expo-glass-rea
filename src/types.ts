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
export interface GlassViewProps extends Omit<HTMLAttributes<HTMLDivElement>, 'style'> {
  ref?: Ref<HTMLDivElement>;
  glassEffectStyle?: GlassStyle | GlassEffectStyleConfig;
  tintColor?: GlassTintColor;
  isInteractive?: boolean;
  colorScheme?: GlassColorScheme;
  style?: GlassViewStyle;
}
export interface GlassContainerProps extends HTMLAttributes<HTMLDivElement> {
  ref?: Ref<HTMLDivElement>;
  /** Merge influence in CSS pixels; omitted = 20, zero = no bridge. Does not set layout gap. */
  spacing?: number;
}
