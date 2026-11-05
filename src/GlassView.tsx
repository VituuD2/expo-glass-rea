'use client';

import { forwardRef, useCallback, useContext, useEffect, useImperativeHandle, useRef, useState, type CSSProperties } from 'react';
import { isGlassEffectAPIAvailable } from './capabilities.js';
import { glassStyle, normalizeEffect, tintColors } from './options.js';
import type { GlassViewProps } from './types.js';
import { OpticalLayer, SharedOpticalContext } from './OpticalLayer.js';
import { bounded } from './optics.js';

export const GlassView = forwardRef<HTMLDivElement, GlassViewProps>(function GlassView({
  glassEffectStyle, tintColor, isInteractive = false, colorScheme = 'auto',
  renderingMode = 'auto', backgroundSource, refractionStrength, opticalThickness, surfaceRoughness,
  adaptiveLighting, opticalOptions, onRenderStats,
  style, className = '', children, ...props
}, ref) {
  const root = useRef<HTMLDivElement>(null);
  useImperativeHandle(ref, () => root.current!, []);
  const shared = useContext(SharedOpticalContext) && renderingMode !== 'css' && !backgroundSource;
  const [optical, setOptical] = useState({ active: false, reason: 'no-source' });
  const onStatus = useCallback((active: boolean, reason: string) => setOptical(current => current.active === active && current.reason === reason ? current : { active, reason }), []);
  const effect = normalizeEffect(glassEffectStyle);
  const [light, dark, contrastLight, contrastDark] = tintColors(tintColor);
  const scheme = ['auto', 'light', 'dark'].includes(colorScheme) ? colorScheme : 'auto';
  const [supported, setSupported] = useState<boolean | null>(null);
  useEffect(() => setSupported(isGlassEffectAPIAvailable()), []);

  return <div {...props} ref={root}
    className={`glass-view ${className}`.trim()}
    data-glass-view=""
    data-glass-style={effect.style}
    data-glass-color-scheme={scheme}
    data-glass-interactive={isInteractive === true}
    data-glass-supported={supported ?? undefined}
    data-glass-renderer={optical.active || shared ? 'webgl2' : 'css'}
    data-glass-renderer-reason={shared ? 'shared-container' : optical.reason}
    data-glass-rendering-mode={renderingMode}
    data-glass-own-source={backgroundSource ? '' : undefined}
    data-glass-optics={[opticalThickness === undefined ? '' : bounded(opticalThickness, .5), refractionStrength === undefined ? '' : bounded(refractionStrength, .6), surfaceRoughness === undefined ? '' : bounded(surfaceRoughness, .2)].join(',')}
    style={{
      ...glassStyle(style),
      ...(scheme !== 'auto' ? { colorScheme: scheme } : {}),
      '--glass-duration': `${effect.animate ? effect.duration : 0}s`,
      '--glass-tint-light': light, '--glass-tint-dark': dark,
      '--glass-tint-contrast-light': contrastLight, '--glass-tint-contrast-dark': contrastDark,
    } as CSSProperties}>
    <span aria-hidden="true" className="glass-view__effect" />
    {backgroundSource && <OpticalLayer host={root} options={{ renderingMode, backgroundSource, refractionStrength, opticalThickness, surfaceRoughness, adaptiveLighting, opticalOptions, onRenderStats }} onStatus={onStatus} />}
    <SharedOpticalContext.Provider value={false}>{children}</SharedOpticalContext.Provider>
  </div>;
});
