import { bounded, MAX_OPTICAL_SHAPES, srgbToLinear } from './optics.js';
import { fragmentShader, vertexShader } from './optical-shader.js';
import { refinedFragmentShader } from './optical-shader-refined.js';
import { springStep, type Spring } from './dynamics.js';
import type { GlassBackgroundSource, GlassOpticalProps, GlassRenderStats } from './types.js';

const PAD = 28;
type Status = (active: boolean, reason: string) => void;
type Presence = { value: number; from: number; target: number; start: number; duration: number };
type TimerExtension = { TIME_ELAPSED_EXT: number; GPU_DISJOINT_EXT: number };
type ShapeDynamics = { x: number; y: number; time: number; vx: Spring; vy: Spring; press: Spring; hover: Spring; regular: Spring };

/** One context/texture/draw per optical host, shared by up to 16 container children. */
export class OpticalRenderer {
  private gl: WebGL2RenderingContext | null = null;
  private program: WebGLProgram | null = null;
  private texture: WebGLTexture | null = null;
  private vao: WebGLVertexArrayObject | null = null;
  private uniforms = new Map<string, WebGLUniformLocation | null>();
  private cleanup: (() => void)[] = [];
  private frame = 0;
  private disposed = false;
  private failed = false;
  private visible = true;
  private textureDirty = true;
  private geometryDirty = true;
  private previousSource: TexImageSource | null = null;
  private textureWidth = 0;
  private textureHeight = 0;
  private shapes: HTMLElement[] = [];
  private presence = new Map<HTMLElement, Presence>();
  private shapeData = new Float32Array(MAX_OPTICAL_SHAPES * 4);
  private radiiData = new Float32Array(MAX_OPTICAL_SHAPES * 4);
  private opticsData = new Float32Array(MAX_OPTICAL_SHAPES * 4);
  private tintData = new Float32Array(MAX_OPTICAL_SHAPES * 4);
  private stateData = new Float32Array(MAX_OPTICAL_SHAPES * 4);
  private motionData = new Float32Array(MAX_OPTICAL_SHAPES * 4);
  private dynamics = new Map<HTMLElement, ShapeDynamics>();
  private lightX: Spring | null = null;
  private lightY: Spring | null = null;
  private pressedElement: Element | null = null;
  private colors = new Map<string, number[]>();
  private colorContext = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
  private pointer: [number, number] | null = null;
  private hovered = 0;
  private pressed = 0;
  private lastFrame = -Infinity;
  private frames = 0;
  private uploads = 0;
  private ratio = 1;
  private qualityScale = 1;
  private slowFrames = 0;
  private queuedAt = 0;
  private performanceFallback = false;
  private maxTextureSize = 0;
  private sourceType = 'none';
  private sourceValid = false;
  private shaderStatus: 'pending' | 'compiled' | 'failed' | 'lost' = 'pending';
  private lastCpuMs = 0;
  private uploadCpuMs = 0;
  private motionEnergy = 0;
  private lastRenderTime = 0;
  private lastUploadTime = -Infinity;
  private consecutiveUploads = 0;
  private mipmaps = false;
  private recoveryFrames = 0;
  private extension: TimerExtension | null = null;
  private queries: WebGLQuery[] = [];
  private gpuMs: number | undefined;
  private statusKey = '';
  private options: GlassOpticalProps = {};
  private reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  private reducedTransparency = matchMedia('(prefers-reduced-transparency: reduce)');
  private forcedColors = matchMedia('(forced-colors: active)');
  private contrast = matchMedia('(prefers-contrast: more)');

  constructor(private host: HTMLElement, private canvas: HTMLCanvasElement,
    private source: GlassBackgroundSource, private group: boolean, private status: Status) {}

  configure(options: GlassOpticalProps) {
    if ((options.opticalOptions?.textureFiltering ?? 'auto') !== (this.options.opticalOptions?.textureFiltering ?? 'auto')) {
      this.textureDirty = true; this.consecutiveUploads = 0;
    }
    if (options.opticalOptions?.quality !== this.options.opticalOptions?.quality) {
      this.performanceFallback = false; this.slowFrames = 0;
    }
    this.options = options;
    if (options.opticalOptions?.quality && options.opticalOptions.quality !== 'auto') this.qualityScale = 1;
    this.geometryDirty = true; this.schedule();
  }

  start() {
    try { this.initialize(); }
    catch (error) { this.shaderStatus = 'failed'; this.setStatus(false, 'webgl2-initialization'); throw error; }
    const listen = (target: EventTarget, name: string, fn: EventListener, capture = false) => {
      target.addEventListener(name, fn, capture);
      this.cleanup.push(() => target.removeEventListener(name, fn, capture));
    };
    const invalidate = () => { this.geometryDirty = true; this.schedule(); };
    const pixels = () => { this.textureDirty = true; this.failed = false; invalidate(); };
    const resize = new ResizeObserver(invalidate);
    resize.observe(this.host);
    const observeChildren = () => {
      resize.disconnect(); resize.observe(this.host);
      this.host.querySelectorAll('[data-glass-view]').forEach(v => resize.observe(v));
      this.geometryDirty = true;
    };
    const mutations = new MutationObserver(records => {
      if (records.every(r => r.target === this.canvas || (r.target instanceof Element && r.target.closest('.glass-view__effect')))) return;
      if (records.some(r => r.type === 'childList')) observeChildren();
      invalidate();
    });
    mutations.observe(this.host, { childList: true, subtree: true, attributes: true,
      attributeFilter: ['style', 'class', 'hidden', 'dir', 'data-glass-style', 'data-glass-rendering-mode', 'data-glass-optics', 'data-glass-color-scheme', 'data-glass-spacing'] });
    for (let parent = this.host.parentElement; parent; parent = parent.parentElement) {
      mutations.observe(parent, { attributes: true, childList: true, attributeFilter: ['style', 'class', 'hidden', 'dir'] });
    }
    observeChildren();
    this.cleanup.push(() => { resize.disconnect(); mutations.disconnect(); });
    if (this.source.subscribe) this.cleanup.push(this.source.subscribe(pixels));
    const media = this.source.getSource();
    if (media instanceof HTMLElement) {
      for (const event of ['load', 'loadeddata', 'seeked', 'resize', 'emptied']) listen(media, event, pixels);
    }
    if (typeof IntersectionObserver !== 'undefined') {
      const intersection = new IntersectionObserver(entries => {
        this.visible = entries[0].isIntersecting;
        if (this.visible) pixels(); else this.cancel();
      }, { rootMargin: '40px' });
      intersection.observe(this.host); this.cleanup.push(() => intersection.disconnect());
    }
    for (const mediaQuery of [this.reducedMotion, this.reducedTransparency, this.forcedColors, this.contrast,
      matchMedia('(prefers-color-scheme: dark)')]) listen(mediaQuery, 'change', invalidate);
    listen(document, 'visibilitychange', () => { if (document.hidden) this.cancel(); else pixels(); });
    listen(window, 'scroll', invalidate, true);
    listen(window, 'resize', invalidate);
    for (const event of ['transitionrun', 'transitionend', 'animationstart', 'animationend', 'animationcancel']) {
      listen(document, event, e => {
        if (e.target instanceof Node && (this.host.contains(e.target) || (e.target instanceof Element && e.target.contains(this.host)))) invalidate();
      }, true);
    }
    listen(this.host, 'pointermove', e => { const p = e as PointerEvent; this.pointer = [p.clientX, p.clientY]; this.hovered = 1; this.schedule(); });
    listen(this.host, 'pointerleave', () => { this.hovered = 0; this.pointer = null; this.schedule(); });
    listen(this.host, 'pointerdown', e => { this.pressed = 1; this.pressedElement = e.target instanceof Element ? e.target : null; this.schedule(); });
    for (const event of ['pointerup', 'pointercancel', 'blur']) listen(window, event, () => { this.pressed = 0; this.pressedElement = null; this.schedule(); });
    listen(this.host, 'focusin', () => { this.hovered = 1; this.schedule(); });
    listen(this.host, 'focusout', () => { this.hovered = 0; this.pressed = 0; this.schedule(); });
    listen(this.host, 'keydown', e => { if (['Enter', ' '].includes((e as KeyboardEvent).key)) { this.pressed = 1; this.pressedElement = e.target instanceof Element ? e.target : null; this.schedule(); } });
    listen(this.host, 'keyup', () => { this.pressed = 0; this.schedule(); });
    listen(this.canvas, 'webglcontextlost', e => {
      e.preventDefault(); this.failed = true; this.shaderStatus = 'lost'; this.cancel(); this.setStatus(false, 'context-lost');
    });
    listen(this.canvas, 'webglcontextrestored', () => {
      try { this.initialize(); this.failed = false; this.textureDirty = true; this.geometryDirty = true; this.schedule(); }
      catch { this.failed = true; this.setStatus(false, 'context-restore-failed'); }
    });
    this.schedule();
  }

  private initialize() {
    const gl = this.canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: false, antialias: false, depth: false, stencil: false });
    if (!gl) throw new Error('webgl2-unavailable');
    this.gl = gl;
    this.maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE) as number;
    if ('drawingBufferColorSpace' in gl) gl.drawingBufferColorSpace = 'srgb';
    if ('unpackColorSpace' in gl) gl.unpackColorSpace = 'srgb';
    const shaders: WebGLShader[] = [];
    try {
      this.program = gl.createProgram();
      if (!this.program) throw new Error('program-allocation');
      const fragment = this.options.opticalOptions?.profile === 'legacy' ? fragmentShader : refinedFragmentShader;
      for (const [kind, text] of [[gl.VERTEX_SHADER, vertexShader], [gl.FRAGMENT_SHADER, fragment]] as const) {
        const shader = gl.createShader(kind);
        if (!shader) throw new Error('shader-allocation');
        shaders.push(shader); gl.shaderSource(shader, text); gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader) || 'shader-compile');
        gl.attachShader(this.program, shader);
      }
      gl.linkProgram(this.program);
      if (!gl.getProgramParameter(this.program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(this.program) || 'shader-link');
      this.texture = gl.createTexture(); this.vao = gl.createVertexArray();
      if (!this.texture || !this.vao) throw new Error('resource-allocation');
      gl.bindVertexArray(this.vao); gl.useProgram(this.program); gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, this.options.opticalOptions?.profile === 'legacy' ? gl.LINEAR : gl.LINEAR_MIPMAP_LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      this.uniforms.clear(); this.queries = [];
      this.textureWidth = this.textureHeight = 0; this.previousSource = null;
      this.extension = gl.getExtension('EXT_disjoint_timer_query_webgl2');
      this.shaderStatus = 'compiled';
    } finally { for (const shader of shaders) { if (this.program) gl.detachShader(this.program, shader); gl.deleteShader(shader); } }
  }

  private setStatus(active: boolean, reason: string) {
    const key = `${active}:${reason}`;
    if (key !== this.statusKey && !this.disposed) {
      this.statusKey = key; this.status(active, reason);
      this.options.onRenderStats?.(this.stats());
    }
  }
  private stats(): GlassRenderStats {
    const legacy = this.options.opticalOptions?.profile === 'legacy';
    return { frames: this.frames, uploads: this.uploads, cpuMs: this.lastCpuMs, gpuMs: this.gpuMs, pixelRatio: this.ratio,
      estimatedBytes: 4 * (this.textureWidth * this.textureHeight * (legacy ? 1 : 4 / 3) + this.canvas.width * this.canvas.height),
      shapes: Number(this.canvas.dataset.glassShapes ?? 0), textureFiltering: this.mipmaps ? 'mipmap' : 'linear', activeRenderer: this.statusKey.startsWith('true:') ? 'webgl2' : 'css',
      fallbackReason: this.statusKey.split(':')[1] ?? 'initializing', devicePixelRatio,
      effectiveRenderScale: this.ratio / (devicePixelRatio || 1), canvasPixelWidth: this.canvas.width, canvasPixelHeight: this.canvas.height,
      backgroundSourceType: this.sourceType, backgroundSourceValid: this.sourceValid, shaderCompilationStatus: this.shaderStatus,
      qualityLevel: this.options.opticalOptions?.quality ?? 'auto', sourcePixelWidth: this.textureWidth, sourcePixelHeight: this.textureHeight,
      uploadCpuMs: this.uploadCpuMs, motionEnergy: this.motionEnergy };
  }
  private cancel() { cancelAnimationFrame(this.frame); this.frame = 0; }
  private schedule = () => {
    if (!this.frame && !this.disposed && this.visible && !document.hidden && !this.failed && !this.performanceFallback) {
      this.queuedAt = performance.now(); this.frame = requestAnimationFrame(this.render);
    }
  };
  private uniform(name: string) {
    if (!this.uniforms.has(name)) this.uniforms.set(name, this.gl!.getUniformLocation(this.program!, name));
    return this.uniforms.get(name)!;
  }
  private color(value: string): number[] {
    if (this.colors.has(value)) return this.colors.get(value)!;
    const c = this.colorContext;
    if (!c) return [0, 0, 0, 0];
    c.canvas.width = c.canvas.height = 1;
    c.clearRect(0, 0, 1, 1); c.fillStyle = value; c.fillRect(0, 0, 1, 1);
    const rgba = c.getImageData(0, 0, 1, 1).data;
    const result = [srgbToLinear(rgba[0] / 255), srgbToLinear(rgba[1] / 255), srgbToLinear(rgba[2] / 255), rgba[3] / 255];
    if (this.colors.size > 128) this.colors.clear();
    this.colors.set(value, result); return result;
  }
  private hasAnimations() {
    if (this.host.getAnimations({ subtree: true }).some(a => a.playState === 'running')) return true;
    for (let p = this.host.parentElement; p; p = p.parentElement) if (p.getAnimations().some(a => a.playState === 'running')) return true;
    return false;
  }
  private validTransforms() {
    for (let p: HTMLElement | null = this.host; p; p = p.parentElement) {
      const css = getComputedStyle(p);
      const m = new DOMMatrixReadOnly(css.transform === 'none' ? undefined : css.transform);
      if (!m.is2D || Math.abs(m.b) > .0001 || Math.abs(m.c) > .0001 || m.a <= 0 || m.d <= 0
        || (css.rotate && css.rotate !== 'none' && css.rotate !== '0deg') || css.perspective !== 'none'
        || (css.scale && css.scale !== 'none' && css.scale.split(/\s+/).some(v => Number(v) <= 0))) return false;
    }
    return true;
  }

  private render = (now: number) => {
    this.frame = 0;
    if (this.disposed || this.failed || !this.visible || document.hidden) return;
    // Dynamic uploads are capped at 60 Hz; static invalidations remain responsive on 120 Hz screens.
    if (this.source.dynamic && now - this.lastFrame < 1000 / 60 - .5) { this.schedule(); return; }
    this.lastFrame = now;
    if (this.reducedTransparency.matches || this.forcedColors.matches) { this.setStatus(false, 'accessibility'); return; }
    const gl = this.gl!;
    try {
      const start = performance.now();
      const pixels = this.source.getSource(), sourceRect = this.source.getRect();
      this.sourceType = pixels?.constructor.name ?? 'none';
      const width = pixels instanceof HTMLVideoElement ? pixels.videoWidth : pixels instanceof HTMLImageElement ? pixels.naturalWidth : pixels?.width ?? 0;
      const height = pixels instanceof HTMLVideoElement ? pixels.videoHeight : pixels instanceof HTMLImageElement ? pixels.naturalHeight : pixels?.height ?? 0;
      if (!pixels || !width || !height || sourceRect.width <= 0 || sourceRect.height <= 0 || !Object.values(sourceRect).every(Number.isFinite)) {
        this.sourceValid = false; this.setStatus(false, 'source-not-ready'); if (this.source.dynamic) this.schedule(); return;
      }
      this.sourceValid = true;
      if (!this.validTransforms()) { this.setStatus(false, 'unsupported-transform'); return; }
      const bounds = this.host.getBoundingClientRect();
      if (!bounds.width || !bounds.height) { this.setStatus(false, 'empty-geometry'); return; }
      const sx = bounds.width / this.host.offsetWidth, sy = bounds.height / this.host.offsetHeight;
      const w = this.host.offsetWidth + PAD * 2, h = this.host.offsetHeight + PAD * 2;
      const maxSize = this.maxTextureSize;
      if (width > maxSize || height > maxSize) { this.setStatus(false, 'source-too-large'); return; }
      const settings = this.options.opticalOptions, legacy = settings?.profile === 'legacy';
      const baseRatio = Math.min(devicePixelRatio || 1, settings?.quality === 'low' ? 1 : bounded(settings?.maxPixelRatio, 2, 1, 3)) * bounded(settings?.resolutionScale, 1, .5, 1);
      this.ratio = baseRatio * this.qualityScale;
      this.ratio = Math.min(this.ratio, Math.sqrt(2_000_000 / (w * h)), maxSize / w, maxSize / h);
      const cw = Math.max(1, Math.round(w * this.ratio)), ch = Math.max(1, Math.round(h * this.ratio));
      if (this.canvas.width !== cw || this.canvas.height !== ch) {
        this.canvas.width = cw; this.canvas.height = ch;
        Object.assign(this.canvas.style, { width: `${w}px`, height: `${h}px`, left: `${-PAD - this.host.clientLeft}px`, top: `${-PAD - this.host.clientTop}px` });
      }
      const animating = this.hasAnimations();
      if (this.geometryDirty || animating || this.source.dynamic) {
        this.shapes = this.group ? [...this.host.querySelectorAll<HTMLElement>('[data-glass-view]')].filter(v =>
          v.closest('[data-glass-container]') === this.host && !this.host.contains(v.parentElement?.closest('[data-glass-view]') ?? null) && v.dataset.glassRenderingMode !== 'css' && !v.hasAttribute('data-glass-own-source')) : [this.host];
        this.geometryDirty = false;
      }
      if (this.shapes.length > MAX_OPTICAL_SHAPES) { this.setStatus(false, 'shape-limit'); return; }
      let count = 0, transitioning = false, settling = false;
      const dt = this.lastRenderTime ? Math.min(.064, Math.max(.001, (now - this.lastRenderTime) / 1000)) : 1 / 60;
      this.lastRenderTime = now; this.motionEnergy = 0;
      const motionEnabled = settings?.motion !== false && !this.reducedMotion.matches && !legacy;
      const evolve = (state: Spring, target: number, frequency = 26, epsilon = .002): Spring => {
        if (!motionEnabled) return { value: target, velocity: 0 };
        const next = springStep(state, target, dt, frequency);
        if (Math.abs(next.value - target) < epsilon && Math.abs(next.velocity) < epsilon * frequency) return { value: target, velocity: 0 };
        settling = true; return next;
      };
      for (const view of this.shapes) {
        const css = getComputedStyle(view), box = view.getBoundingClientRect();
        if (!box.width || !box.height || css.visibility === 'hidden' || css.display === 'none') continue;
        let groupOpacity = 1;
        if (this.group) {
          for (let p: HTMLElement | null = view; p && p !== this.host; p = p.parentElement) {
            const childCss = getComputedStyle(p), m = new DOMMatrixReadOnly(childCss.transform === 'none' ? undefined : childCss.transform);
            groupOpacity *= bounded(parseFloat(childCss.opacity), 1);
            // Parent scaling is mapped at the host; internal shape scaling/rotation needs local ray transforms.
            if (!m.is2D || Math.abs(m.b) > .0001 || Math.abs(m.c) > .0001 || Math.abs(m.a - 1) > .0001 || Math.abs(m.d - 1) > .0001
              || (childCss.rotate && childCss.rotate !== 'none' && childCss.rotate !== '0deg') || (childCss.scale && childCss.scale !== 'none' && childCss.scale !== '1')) {
              this.setStatus(false, 'unsupported-transform'); return;
            }
          }
        }
        const vw = box.width / sx, vh = box.height / sy;
        const radii: number[] = [];
        for (const value of [css.borderTopLeftRadius, css.borderTopRightRadius, css.borderBottomRightRadius, css.borderBottomLeftRadius]) {
          const parts = value.split(/\s+/);
          const rx = parseFloat(parts[0]) * (parts[0].includes('%') ? vw / 100 : 1);
          const ry = parseFloat(parts[1] ?? parts[0]) * ((parts[1] ?? parts[0]).includes('%') ? vh / 100 : 1);
          if (!Number.isFinite(rx) || !Number.isFinite(ry)) { this.setStatus(false, 'unsupported-corners'); return; }
          if (Math.abs(rx - ry) > .1) { this.setStatus(false, 'elliptical-corners'); return; }
          radii.push(rx);
        }
        const factor = Math.min(1, vw / (radii[0] + radii[1] || 1), vw / (radii[2] + radii[3] || 1), vh / (radii[0] + radii[3] || 1), vh / (radii[1] + radii[2] || 1));
        if (radii.some(r => r * factor > Math.min(vw, vh) / 2 + .01)
          || !/^(?:(?:round|superellipse\(1\))\s*)*$/.test(css.getPropertyValue('corner-shape').trim())) { this.setStatus(false, 'unsupported-corners'); return; }
        const target = view.dataset.glassStyle === 'none' ? 0 : 1;
        const duration = this.reducedMotion.matches ? 0 : bounded(parseFloat(css.getPropertyValue('--glass-duration')), 0, 0, 10) * 1000;
        let state = this.presence.get(view);
        if (!state) { state = { value: duration ? 0 : target, from: 0, target, start: now, duration }; this.presence.set(view, state); }
        if (target !== state.target) { state.from = state.value; state.target = target; state.start = now; state.duration = duration; }
        const t = duration ? bounded((now - state.start) / state.duration, 1) : 1;
        state.value = state.from + (state.target - state.from) * t * t * (3 - 2 * t);
        if (t < 1) transitioning = true;
        if (state.value <= .001) continue;
        const own = (view.dataset.glassOptics ?? '').split(',').map(v => v === '' ? undefined : Number(v));
        const interactive = view.dataset.glassInteractive === 'true';
        const targetRegular = view.dataset.glassStyle === 'clear' ? 0 : 1;
        const x = box.left + box.width / 2, y = box.top + box.height / 2;
        let dynamics = this.dynamics.get(view);
        if (!dynamics) {
          const zero = () => ({ value: 0, velocity: 0 });
          dynamics = { x, y, time: now, vx: zero(), vy: zero(), press: zero(), hover: zero(), regular: { value: targetRegular, velocity: 0 } };
          this.dynamics.set(view, dynamics);
        }
        const elapsed = Math.max((now - dynamics.time) / 1000, .008);
        const inside = !!this.pointer && this.pointer[0] >= box.left && this.pointer[0] <= box.right && this.pointer[1] >= box.top && this.pointer[1] <= box.bottom;
        const focused = !!document.activeElement && view.contains(document.activeElement);
        dynamics.vx = evolve(dynamics.vx, interactive && motionEnabled ? bounded((x - dynamics.x) / elapsed / sx / 700, 0, -1, 1) : 0);
        dynamics.vy = evolve(dynamics.vy, interactive && motionEnabled ? bounded((y - dynamics.y) / elapsed / sy / 700, 0, -1, 1) : 0);
        dynamics.press = evolve(dynamics.press, interactive && this.pressed && !!this.pressedElement && view.contains(this.pressedElement) ? 1 : 0);
        dynamics.hover = evolve(dynamics.hover, interactive && (inside || focused) ? 1 : 0);
        dynamics.regular = duration && !legacy ? evolve(dynamics.regular, targetRegular) : { value: targetRegular, velocity: 0 };
        dynamics.x = x; dynamics.y = y; dynamics.time = now;
        this.motionData.set([dynamics.vx.value, dynamics.vy.value, motionEnabled ? dynamics.press.value : 0, dynamics.hover.value], count * 4);
        this.motionEnergy = Math.max(this.motionEnergy, Math.abs(dynamics.vx.value) + Math.abs(dynamics.vy.value) + (motionEnabled ? dynamics.press.value : 0));
        this.shapeData.set([(box.left - bounds.left) / sx + PAD, (box.top - bounds.top) / sy + PAD, vw, vh], count * 4);
        this.radiiData.set(radii.map(r => r * factor), count * 4);
        this.opticsData.set([bounded(own[0], bounded(this.options.opticalThickness, .5)), bounded(own[1], bounded(this.options.refractionStrength, .6)), bounded(own[2], bounded(this.options.surfaceRoughness, .2)), dynamics.regular.value], count * 4);
        const decoration = view.querySelector<HTMLElement>(':scope > .glass-view__effect');
        this.tintData.set(this.color(decoration ? getComputedStyle(decoration, '::after').backgroundColor : 'transparent'), count * 4);
        const foreground = this.color(css.color);
        this.stateData.set([state.value * groupOpacity, view.dataset.glassInteractive === 'true' ? 1 : 0, foreground[0] * .2126 + foreground[1] * .7152 + foreground[2] * .0722 < .45 ? 1 : 0, 0], count * 4);
        count++;
      }
      for (const view of this.presence.keys()) if (!this.shapes.includes(view)) this.presence.delete(view);
      for (const view of this.dynamics.keys()) if (!this.shapes.includes(view)) this.dynamics.delete(view);
      gl.useProgram(this.program); gl.bindVertexArray(this.vao); gl.bindTexture(gl.TEXTURE_2D, this.texture);
      this.uploadCpuMs = 0;
      if (this.textureDirty || this.source.dynamic || pixels !== this.previousSource || width !== this.textureWidth || height !== this.textureHeight) {
        const uploadStart = performance.now();
        this.consecutiveUploads = now - this.lastUploadTime < 1000 ? this.consecutiveUploads + 1 : 0;
        this.lastUploadTime = now;
        this.mipmaps = !legacy && settings?.textureFiltering !== 'linear' && (settings?.textureFiltering === 'mipmap' || (!this.source.dynamic && this.consecutiveUploads < 3));
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, this.mipmaps ? gl.LINEAR_MIPMAP_LINEAR : gl.LINEAR);
        if (width !== this.textureWidth || height !== this.textureHeight) gl.texImage2D(gl.TEXTURE_2D, 0, legacy ? gl.RGBA : gl.SRGB8_ALPHA8, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
        else gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
        if (this.mipmaps) gl.generateMipmap(gl.TEXTURE_2D);
        if (gl.getError() !== gl.NO_ERROR) throw new Error('texture-upload');
        this.textureWidth = width; this.textureHeight = height; this.previousSource = pixels; this.textureDirty = false; this.uploads++;
        this.uploadCpuMs = performance.now() - uploadStart;
      }
      gl.viewport(0, 0, cw, ch);
      // Clear old geometry, then shade only the union's padded bounding rectangle.
      gl.disable(gl.SCISSOR_TEST); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
      if (count) {
        let left = w, top = h, right = 0, bottom = 0;
        for (let i = 0; i < count; i++) {
          const at = i * 4, x = this.shapeData[at], y = this.shapeData[at + 1];
          left = Math.min(left, x - PAD); top = Math.min(top, y - PAD);
          right = Math.max(right, x + this.shapeData[at + 2] + PAD); bottom = Math.max(bottom, y + this.shapeData[at + 3] + PAD);
        }
        const x0 = Math.max(0, Math.floor(left * cw / w)), y0 = Math.max(0, Math.floor((h - bottom) * ch / h));
        const x1 = Math.min(cw, Math.ceil(right * cw / w)), y1 = Math.min(ch, Math.ceil((h - top) * ch / h));
        gl.enable(gl.SCISSOR_TEST); gl.scissor(x0, y0, Math.max(0, x1 - x0), Math.max(0, y1 - y0));
      }
      gl.uniform2f(this.uniform('uResolution'), cw, ch); gl.uniform2f(this.uniform('uSize'), w, h);
      gl.uniform4f(this.uniform('uMapping'), (bounds.left - PAD * sx - sourceRect.left) / sourceRect.width, (bounds.top - PAD * sy - sourceRect.top) / sourceRect.height, sx / sourceRect.width, sy / sourceRect.height);
      gl.uniform1i(this.uniform('uCount'), count);
      for (const [name, array] of [['uShapes', this.shapeData], ['uRadii', this.radiiData], ['uOptics', this.opticsData], ['uTints', this.tintData], ['uStates', this.stateData], ['uMotions', this.motionData]] as const) gl.uniform4fv(this.uniform(`${name}[0]`), array);
      gl.uniform1i(this.uniform('uDebug'), ['none', 'normals', 'displacement', 'layers'].indexOf(settings?.debug ?? 'none'));
      gl.uniform1f(this.uniform('uMerge'), this.group ? bounded(Number(this.host.dataset.glassSpacing), 20, 0, 160) * 2 : 0);
      gl.uniform4f(this.uniform('uEffects'), bounded(settings?.refractiveIndex, 1.48, 1, 2), bounded(settings?.dispersion, 0), settings?.reflection === false ? 0 : 1, settings?.scattering === false ? 0 : 1);
      gl.uniform3f(this.uniform('uFeatures'), settings?.shadows === false ? 0 : 1, this.options.adaptiveLighting === false ? 0 : 1, this.contrast.matches ? 1 : 0);
      gl.uniform4f(this.uniform('uRefinement'), bounded(settings?.edgeSpectrum, .16), settings?.edgeIllumination === false ? 0 : 1, settings?.antialiasing === false ? 0 : 1, settings?.refractionModel === 'two-interface' ? 1 : 0);
      gl.uniform1f(this.uniform('uMipmaps'), this.mipmaps ? 1 : 0);
      const pointer = this.reducedMotion.matches ? null : this.pointer;
      const targetX = pointer ? (pointer[0] - bounds.left) / sx + PAD : w * .25;
      const targetY = pointer ? (pointer[1] - bounds.top) / sy + PAD : -h * .1;
      this.lightX = evolve(this.lightX ?? { value: targetX, velocity: 0 }, targetX, 24, .025);
      this.lightY = evolve(this.lightY ?? { value: targetY, velocity: 0 }, targetY, 24, .025);
      gl.uniform4f(this.uniform('uLight'), this.lightX.value, this.lightY.value, this.hovered, this.reducedMotion.matches ? 0 : this.pressed);
      this.pollQueries();
      let query: WebGLQuery | null = null;
      if (this.extension && (this.options.onRenderStats || !settings?.quality || settings.quality === 'auto') && this.queries.length < 4) { query = gl.createQuery(); if (query) gl.beginQuery(this.extension.TIME_ELAPSED_EXT, query); }
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      if (query && this.extension) { gl.endQuery(this.extension.TIME_ELAPSED_EXT); this.queries.push(query); }
      this.frames++;
      this.canvas.dataset.glassShapes = String(count);
      const cpuMs = performance.now() - start;
      this.lastCpuMs = cpuMs;
      if (settings?.quality === 'auto' || !settings?.quality) {
        // Queue delay observes total scheduling pressure, not exclusively time attributable to this shader.
        // Do not blame unrelated main-thread queuing on a known-fast GPU; ignore initial compile/upload frames.
        const pressured = this.frames > 3 && (cpuMs > 8 || (this.gpuMs !== undefined ? this.gpuMs > 6 : now - this.queuedAt > 40));
        this.slowFrames = pressured ? this.slowFrames + 1 : 0;
        const minimumScale = Math.min(1, 1 / baseRatio);
        if (this.slowFrames >= 18) {
          if (this.qualityScale <= minimumScale + .001) this.performanceFallback = true;
          else this.qualityScale = Math.max(minimumScale, this.qualityScale * .9);
          this.slowFrames = 0;
        }
        this.recoveryFrames = pressured ? 0 : this.recoveryFrames + 1;
        if (this.recoveryFrames > 90 && this.qualityScale < 1) { this.qualityScale = Math.min(1, this.qualityScale / .9); this.recoveryFrames = 0; }
      } else this.qualityScale = 1;
      this.setStatus(!this.performanceFallback, this.performanceFallback ? 'performance-budget' : 'explicit-source');
      this.options.onRenderStats?.(this.stats());
      if (this.source.dynamic || animating || transitioning || settling) { this.geometryDirty = true; this.schedule(); }
    } catch (error) {
      this.failed = true;
      this.sourceValid = false;
      this.setStatus(false, error instanceof DOMException && error.name === 'SecurityError' ? 'source-security' : 'render-failed');
    }
  };
  private pollQueries() {
    const gl = this.gl!, ext = this.extension;
    if (!ext) return;
    const disjoint = gl.getParameter(ext.GPU_DISJOINT_EXT);
    this.queries = this.queries.filter(q => {
      if (!gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE)) return true;
      if (!disjoint) this.gpuMs = (gl.getQueryParameter(q, gl.QUERY_RESULT) as number) / 1e6;
      gl.deleteQuery(q); return false;
    });
    if (disjoint) this.gpuMs = undefined;
  }
  dispose() {
    this.disposed = true; this.cancel();
    for (const cleanup of this.cleanup.reverse()) cleanup(); this.cleanup = [];
    const gl = this.gl;
    if (gl && !gl.isContextLost()) {
      for (const q of this.queries) gl.deleteQuery(q);
      gl.deleteTexture(this.texture); gl.deleteProgram(this.program); gl.deleteVertexArray(this.vao);
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    }
    this.presence.clear(); this.dynamics.clear(); this.colors.clear(); this.gl = null;
  }
}
