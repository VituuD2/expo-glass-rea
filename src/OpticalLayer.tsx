'use client';

import { createContext, useEffect, useRef, type RefObject } from 'react';
import type { OpticalRenderer } from './optical-renderer.js';
import { selectRenderer } from './renderer-selection.js';
import type { GlassOpticalProps } from './types.js';

export const SharedOpticalContext = createContext(false);

export function OpticalLayer({ host, group = false, options, onStatus }: {
  host: RefObject<HTMLDivElement | null>;
  group?: boolean;
  options: GlassOpticalProps;
  onStatus: (active: boolean, reason: string) => void;
}) {
  const slot = useRef<HTMLSpanElement>(null);
  const renderer = useRef<OpticalRenderer | null>(null);
  const latest = useRef(options);
  latest.current = options;
  const source = options.backgroundSource, mode = options.renderingMode, profile = options.opticalOptions?.profile;
  useEffect(() => {
    if (!host.current || !slot.current || !source || selectRenderer(mode ?? 'auto', !!source, true, false) === 'css') { onStatus(false, mode === 'css' ? 'manual-css' : 'no-source'); return; }
    onStatus(false, 'initializing');
    // StrictMode setup/cleanup/setup must not reuse a canvas whose context was released.
    const canvas = document.createElement('canvas');
    canvas.className = 'glass-optical-canvas'; canvas.setAttribute('aria-hidden', 'true');
    slot.current.replaceChildren(canvas);
    const element = host.current;
    let engine: OpticalRenderer | null = null, cancelled = false;
    // CSS-only consumers do not load the renderer/shader chunk. Cancellation also covers unmount during import.
    void import('./optical-renderer.js').then(({ OpticalRenderer: Renderer }) => {
      if (cancelled) return;
      engine = new Renderer(element, canvas, source, group, onStatus); renderer.current = engine;
      try { engine.configure(latest.current); engine.start(); }
      catch (error) {
        canvas.dataset.glassError = error instanceof Error ? error.message : 'Initialization failed';
        onStatus(false, 'webgl2-initialization'); engine.dispose();
      }
    }).catch(() => { if (!cancelled) onStatus(false, 'renderer-load-failed'); });
    return () => { cancelled = true; engine?.dispose(); canvas.remove(); if (renderer.current === engine) renderer.current = null; };
  }, [source, mode, profile, group, host, onStatus]);
  useEffect(() => { renderer.current?.configure(options); });
  return <span ref={slot} aria-hidden="true" className="glass-optical-slot" />;
}
