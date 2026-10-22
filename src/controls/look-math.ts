/** Pure math helpers for look controls (kept separate so they unit-test). */

export const MIN_FOV = 35;
export const MAX_FOV = 100;

export function clampFov(fov: number, min: number = MIN_FOV, max: number = MAX_FOV): number {
  return Math.min(max, Math.max(min, fov));
}

/** Pitch is clamped so the viewer can never flip over the poles. */
export const MAX_PITCH = (85 * Math.PI) / 180;

export function clampPitch(pitchRad: number, max: number = MAX_PITCH): number {
  return Math.min(max, Math.max(-max, pitchRad));
}

/** Normalize an angle to (-PI, PI]. */
export function wrapAngle(rad: number): number {
  const twoPi = Math.PI * 2;
  let wrapped = rad % twoPi;
  if (wrapped > Math.PI) wrapped -= twoPi;
  if (wrapped <= -Math.PI) wrapped += twoPi;
  return wrapped;
}

/**
 * Frame-rate independent exponential velocity decay.
 * `damping` is per-second: higher values stop the glide sooner.
 */
export function dampVelocity(velocity: number, damping: number, dtSeconds: number): number {
  return velocity * Math.exp(-damping * dtSeconds);
}
