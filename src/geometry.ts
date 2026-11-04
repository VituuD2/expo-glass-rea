export type GlassShape = { x: number; y: number; width: number; height: number; radii: number[] };

/** An axis-aligned rounded rectangle; CSS normalizes oversized corner radii similarly. */
export function roundedPath({ x, y, width: w, height: h, radii }: GlassShape): string {
  const [tl, tr, br, bl] = radii.map((r) => Math.max(0, Number.isFinite(r) ? r : 0));
  const scale = Math.min(1, w / (tl + tr || 1), w / (bl + br || 1), h / (tl + bl || 1), h / (tr + br || 1));
  const [a, b, c, d] = [tl, tr, br, bl].map((r) => r * scale);
  return `M${x + a},${y}H${x + w - b}A${b},${b} 0 0 1 ${x + w},${y + b}V${y + h - c}A${c},${c} 0 0 1 ${x + w - c},${y + h}H${x + d}A${d},${d} 0 0 1 ${x},${y + h - d}V${y + a}A${a},${a} 0 0 1 ${x + a},${y}Z`;
}
