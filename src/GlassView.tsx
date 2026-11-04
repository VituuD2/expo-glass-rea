'use client';

import { forwardRef, useEffect, useState, type CSSProperties } from 'react';
import { isGlassEffectAPIAvailable } from './capabilities.js';
import { glassStyle, normalizeEffect, tintColors } from './options.js';
import type { GlassViewProps } from './types.js';

export const GlassView = forwardRef<HTMLDivElement, GlassViewProps>(function GlassView({
  glassEffectStyle, tintColor, isInteractive = false, colorScheme = 'auto',
  style, className = '', children, ...props
}, ref) {
  const effect = normalizeEffect(glassEffectStyle);
  const [light, dark, contrastLight, contrastDark] = tintColors(tintColor);
  const scheme = ['auto', 'light', 'dark'].includes(colorScheme) ? colorScheme : 'auto';
  const [supported, setSupported] = useState<boolean | null>(null);
  useEffect(() => setSupported(isGlassEffectAPIAvailable()), []);

  return <div {...props} ref={ref}
    className={`glass-view ${className}`.trim()}
    data-glass-view=""
    data-glass-style={effect.style}
    data-glass-color-scheme={scheme}
    data-glass-interactive={isInteractive === true}
    data-glass-supported={supported ?? undefined}
    style={{
      ...glassStyle(style),
      ...(scheme !== 'auto' ? { colorScheme: scheme } : {}),
      '--glass-duration': `${effect.animate ? effect.duration : 0}s`,
      '--glass-tint-light': light, '--glass-tint-dark': dark,
      '--glass-tint-contrast-light': contrastLight, '--glass-tint-contrast-dark': contrastDark,
    } as CSSProperties}>
    <span aria-hidden="true" className="glass-view__effect" />
    {children}
  </div>;
});
