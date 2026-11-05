/** Independent screen-space optical model. All lengths are virtual CSS pixels. */
export type Vec3 = readonly [number, number, number];
export type OpticalShape = { x: number; y: number; width: number; height: number; radii: readonly number[] };
export const MAX_OPTICAL_SHAPES = 16;
export function bounded(value: unknown, fallback: number, min = 0, max = 1): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
}
export function normalize3(v: Vec3): Vec3 {
  const length = Math.hypot(...v);
  return length > 1e-12 && Number.isFinite(length) ? [v[0] / length, v[1] / length, v[2] / length] : [0, 0, 1];
}
/** N faces the incident medium, I points toward the interface. null = total internal reflection. */
export function refract3(i: Vec3, n: Vec3, eta: number): Vec3 | null {
  const dot = i[0] * n[0] + i[1] * n[1] + i[2] * n[2];
  const k = 1 - eta * eta * (1 - dot * dot);
  if (k < 0) return null;
  const a = eta * dot + Math.sqrt(k);
  return [eta * i[0] - a * n[0], eta * i[1] - a * n[1], eta * i[2] - a * n[2]];
}
export function schlick(cosine: number, n1 = 1, n2 = 1.48): number {
  const f0 = ((n1 - n2) / (n1 + n2)) ** 2;
  return f0 + (1 - f0) * (1 - bounded(cosine, 1)) ** 5;
}
export function smoothMin(a: number, b: number, k: number): number {
  if (k <= 0) return Math.min(a, b);
  const h = bounded(.5 + .5 * (b - a) / k, 0);
  return b * (1 - h) + a * h - k * h * (1 - h);
}
/** TL, TR, BR, BL; shader uses identical quadrant convention. */
export function roundedRectDistance(x: number, y: number, s: OpticalShape): number {
  const px = x - s.x - s.width / 2, py = y - s.y - s.height / 2;
  const corner = py < 0 ? (px < 0 ? 0 : 1) : (px < 0 ? 3 : 2);
  const r = bounded(s.radii[corner], 0, 0, Math.min(s.width, s.height) / 2);
  const qx = Math.abs(px) - s.width / 2 + r, qy = Math.abs(py) - s.height / 2 + r;
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
}
export function surfaceHeight(distance: number, size: number, thickness: number): number {
  const edge = bounded(-distance / bounded(size * .2, 8, 8, 32), 0);
  return 48 * bounded(thickness, .5) * bounded(Math.sqrt(Math.max(0, size) / 100), 1, .6, 1.8) * edge * edge * (3 - 2 * edge);
}
export function heightNormal(height: (x: number, y: number) => number, x: number, y: number): Vec3 {
  return normalize3([-(height(x + .5, y) - height(x - .5, y)), -(height(x, y + .5) - height(x, y - .5)), 1]);
}
export function projectedDisplacement(n: Vec3, height: number, index = 1.48, strength = .6): [number, number] {
  const ray = refract3([0, 0, -1], n, 1 / bounded(index, 1.48, 1, 2));
  if (!ray) return [0, 0];
  const t = Math.max(0, height) * bounded(strength, .6) / Math.max(.1, -ray[2]);
  const dx = ray[0] * t, dy = ray[1] * t, scale = Math.min(1, 64 / (Math.hypot(dx, dy) || 1));
  return [dx * scale || 0, dy * scale || 0];
}
export function srgbToLinear(v: number): number { return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }
export function linearToSrgb(v: number): number { return v <= .0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - .055; }

export type RefinedShape = OpticalShape & { thickness?: number; regular?: number; presence?: number };
/** CPU reference for the analytic gradient used in the refined GPU shader. */
export function refinedSurface(x: number, y: number, shapes: readonly RefinedShape[], merge = 0) {
  let distance = 1e6, gx = 0, gy = 0, amplitude = 0, ax = 0, ay = 0, bevel = 16, bx = 0, by = 0;
  for (const shape of shapes) {
    const presence = bounded(shape.presence, 1);
    if (presence < .001) continue;
    const px = x - shape.x - shape.width / 2, py = y - shape.y - shape.height / 2;
    const corner = py < 0 ? (px < 0 ? 0 : 1) : (px < 0 ? 3 : 2);
    const size = Math.min(shape.width, shape.height), radius = bounded(shape.radii[corner], 0, 0, size / 2);
    const qx = Math.abs(px) - shape.width / 2 + radius, qy = Math.abs(py) - shape.height / 2 + radius;
    const length = Math.hypot(Math.max(qx, 0), Math.max(qy, 0));
    const dx = Math.sign(px) * (length > .00001 ? Math.max(qx, 0) / length : qx > qy ? 1 : 0);
    const dy = Math.sign(py) * (length > .00001 ? Math.max(qy, 0) / length : qx > qy ? 0 : 1);
    const d = length + Math.min(Math.max(qx, qy), 0) - radius;
    const regular = bounded(shape.regular, 0);
    const h = 32 * bounded(shape.thickness, .5) * bounded(Math.sqrt(size / 110), 1, .65, 1.45) * presence * (1 - .06 * regular);
    const b = bounded(size * (.24 - .02 * regular), 16, 10, 30);
    const weight = merge > .001 ? bounded(.5 + .5 * (d - distance) / merge, 0) : distance < d ? 1 : 0;
    const wx = weight > 0 && weight < 1 ? (dx - gx) / (2 * merge) : 0;
    const wy = weight > 0 && weight < 1 ? (dy - gy) / (2 * merge) : 0;
    ax = weight * ax + (amplitude - h) * wx; ay = weight * ay + (amplitude - h) * wy;
    bx = weight * bx + (bevel - b) * wx; by = weight * by + (bevel - b) * wy;
    amplitude = h * (1 - weight) + amplitude * weight; bevel = b * (1 - weight) + bevel * weight;
    distance = d * (1 - weight) + distance * weight - merge * weight * (1 - weight);
    gx = dx * (1 - weight) + gx * weight; gy = dy * (1 - weight) + gy * weight;
  }
  const q = bounded(-distance / bevel, 0), ramp = q ** 3 * (q * (q * 6 - 15) + 10), slope = 30 * q * q * (q - 1) ** 2;
  const qx = q > 0 && q < 1 ? -gx / bevel + distance * bx / (bevel * bevel) : 0;
  const qy = q > 0 && q < 1 ? -gy / bevel + distance * by / (bevel * bevel) : 0;
  const hx = ax * ramp + amplitude * slope * qx, hy = ay * ramp + amplitude * slope * qy;
  return { distance, height: amplitude * ramp, amplitude, normal: normalize3([-hx, -hy, 1]), gradient: [gx, gy] as const };
}

export function refinedDisplacement(surface: ReturnType<typeof refinedSurface>, index = 1.48, strength = .6, model: 'single' | 'two-interface' = 'single'): [number, number] {
  index = bounded(index, 1.48, 1, 2);
  const ray = refract3([0, 0, -1], surface.normal, 1 / index);
  if (!ray) return [0, 0];
  let dx = surface.height * ray[0] / Math.max(.12, -ray[2]), dy = surface.height * ray[1] / Math.max(.12, -ray[2]);
  if (model === 'two-interface') {
    const exit = refract3(ray, [0, 0, 1], index);
    if (exit) { dx += surface.amplitude * .18 * exit[0] / Math.max(.12, -exit[2]); dy += surface.amplitude * .18 * exit[1] / Math.max(.12, -exit[2]); }
  }
  dx *= bounded(strength, .6); dy *= bounded(strength, .6);
  const scale = Math.min(1, 32 / (Math.hypot(dx, dy) || 1));
  return [dx * scale || 0, dy * scale || 0];
}
