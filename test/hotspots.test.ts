import { describe, expect, it } from 'vitest';
import { HOTSPOT_RADIUS, yawPitchToPosition } from '../src/hotspots';

describe('yawPitchToPosition', () => {
  it('places yaw 0 / pitch 0 straight ahead (-Z)', () => {
    const p = yawPitchToPosition(0, 0);
    expect(p.x).toBeCloseTo(0);
    expect(p.y).toBeCloseTo(0);
    expect(p.z).toBeCloseTo(-HOTSPOT_RADIUS);
  });

  it('rotates left for positive yaw and up for positive pitch', () => {
    const left = yawPitchToPosition(90, 0);
    expect(left.x).toBeCloseTo(-HOTSPOT_RADIUS);
    expect(left.z).toBeCloseTo(0);
    const up = yawPitchToPosition(0, 90);
    expect(up.y).toBeCloseTo(HOTSPOT_RADIUS);
  });

  it('stays on the sphere for arbitrary angles', () => {
    expect(yawPitchToPosition(137, -42).length()).toBeCloseTo(HOTSPOT_RADIUS);
    expect(yawPitchToPosition(-75, 33, 5).length()).toBeCloseTo(5);
  });
});
