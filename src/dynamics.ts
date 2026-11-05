/** Exact critically damped spring for a fixed target over dt; stable at variable frame cadence. */
export interface Spring { value: number; velocity: number }
export function springStep(state: Spring, target: number, seconds: number, frequency = 18): Spring {
  const dt = Math.min(.064, Math.max(0, Number.isFinite(seconds) ? seconds : 0));
  const x = state.value - target, decay = Math.exp(-frequency * dt);
  const c = state.velocity + frequency * x;
  const value = target + (x + c * dt) * decay;
  const velocity = (state.velocity - frequency * c * dt) * decay;
  return Math.abs(value - target) < .0001 && Math.abs(velocity) < .001 ? { value: target, velocity: 0 } : { value, velocity };
}
