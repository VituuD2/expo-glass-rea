'use client';

import { forwardRef, useCallback, useEffect, useId, useImperativeHandle, useRef, useState } from 'react';
import { roundedPath, type GlassShape } from './geometry.js';
import type { GlassContainerProps } from './types.js';
import { OpticalLayer, SharedOpticalContext } from './OpticalLayer.js';

export const GlassContainer = forwardRef<HTMLDivElement, GlassContainerProps>(function GlassContainer({
  spacing = 20, className = '', children,
  renderingMode = 'auto', backgroundSource, refractionStrength, opticalThickness, surfaceRoughness,
  adaptiveLighting, opticalOptions, onRenderStats, ...props
}, ref) {
  const root = useRef<HTMLDivElement>(null);
  useImperativeHandle(ref, () => root.current!, []);
  const id = `glass-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const [shapes, setShapes] = useState<GlassShape[]>([]);
  const [optical, setOptical] = useState({ active: false, reason: 'no-source' });
  const onStatus = useCallback((active: boolean, reason: string) => setOptical(current => current.active === active && current.reason === reason ? current : { active, reason }), []);
  const influence = typeof spacing === 'number' && Number.isFinite(spacing) ? Math.max(0, spacing) : 20;

  useEffect(() => {
    const element = root.current;
    if (!element || influence === 0 || optical.active) { setShapes([]); return; }
    let frame = 0;
    const measure = () => {
      frame = 0;
      const bounds = element.getBoundingClientRect();
      const scaleX = bounds.width / (element.offsetWidth || 1) || 1;
      const scaleY = bounds.height / (element.offsetHeight || 1) || 1;
      const next: GlassShape[] = [];
      element.querySelectorAll<HTMLElement>('[data-glass-view]').forEach((view) => {
        if (view.closest('[data-glass-container]') !== element || view.dataset.glassStyle === 'none' || view.dataset.glassSupported === 'false') return;
        const box = view.getBoundingClientRect();
        const css = getComputedStyle(view);
        if (!box.width || !box.height || css.visibility === 'hidden' || css.display === 'none') return;
        const size = Math.min(box.width / scaleX, box.height / scaleY);
        next.push({
          x: (box.left - bounds.left) / scaleX, y: (box.top - bounds.top) / scaleY,
          width: box.width / scaleX, height: box.height / scaleY,
          radii: [css.borderTopLeftRadius, css.borderTopRightRadius, css.borderBottomRightRadius, css.borderBottomLeftRadius]
            .map((value) => value.includes('%') ? parseFloat(value) * size / 100 : parseFloat(value) || 0),
        });
      });
      setShapes((current) => JSON.stringify(current) === JSON.stringify(next) ? current : next);
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(measure); };
    const resize = new ResizeObserver(schedule);
    const observeSizes = () => {
      resize.disconnect();
      resize.observe(element);
      element.querySelectorAll('[data-glass-view]').forEach((view) => resize.observe(view));
      schedule();
    };
    const mutations = new MutationObserver(observeSizes);
    mutations.observe(element, { subtree: true, childList: true, attributes: true, attributeFilter: ['style', 'class', 'hidden', 'dir', 'data-glass-style', 'data-glass-supported'] });
    window.addEventListener('resize', schedule);
    observeSizes();
    return () => { resize.disconnect(); mutations.disconnect(); cancelAnimationFrame(frame); window.removeEventListener('resize', schedule); };
  }, [influence, optical.active]);

  return <div {...props} ref={root} className={`glass-container ${className}`.trim()}
    data-glass-container="" data-glass-spacing={influence}
    data-glass-renderer={optical.active ? 'webgl2' : 'css'} data-glass-renderer-reason={optical.reason}>
    {influence > 0 && !optical.active && <>
      <svg aria-hidden="true" className="glass-container__defs" width="100%" height="100%">
        <defs>
          {/* shortcut: SVG approximates native fusion for axis-aligned scalar radii; use a compositor for rotated/elliptical surfaces. */}
          <filter id={`${id}-goo`} x="-50%" y="-50%" width="200%" height="200%" colorInterpolationFilters="sRGB">
            <feGaussianBlur stdDeviation={influence / 2.4} />
            <feColorMatrix type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -6" />
          </filter>
          <mask id={id} maskUnits="userSpaceOnUse" x="0" y="0" width="100%" height="100%" style={{ maskType: 'alpha' }}>
            <g filter={`url(#${id}-goo)`}>{shapes.map((shape, index) => <path key={index} d={roundedPath(shape)} fill="white" />)}</g>
          </mask>
        </defs>
      </svg>
      <span aria-hidden="true" className="glass-container__material" style={{ mask: `url(#${id})`, WebkitMask: `url(#${id})` }} />
    </>}
    {backgroundSource && <OpticalLayer host={root} group options={{ renderingMode, backgroundSource, refractionStrength, opticalThickness, surfaceRoughness, adaptiveLighting, opticalOptions, onRenderStats }} onStatus={onStatus} />}
    <SharedOpticalContext.Provider value={optical.active}>{children}</SharedOpticalContext.Provider>
  </div>;
});
