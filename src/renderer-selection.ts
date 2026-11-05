import type { GlassRenderingMode } from './types.js';

/** No speculative SVG URL or WebGPU capability claim. WebGL creation is the definitive check. */
export function selectRenderer(mode: GlassRenderingMode, source: boolean, webgl: boolean, opaque: boolean): 'css' | 'webgl2' {
  return mode !== 'css' && source && webgl && !opaque ? 'webgl2' : 'css';
}
