import { describe, expect, it } from 'vitest';
import { clampFov, clampPitch, dampVelocity, wrapAngle } from '../src/controls/look-math';

describe('clampFov', () => {
  it('clamps to the default 35..100 range', () => {
    expect(clampFov(20)).toBe(35);
    expect(clampFov(140)).toBe(100);
    expect(clampFov(75)).toBe(75);
  });

  it('honors custom bounds', () => {
    expect(clampFov(10, 40, 90)).toBe(40);
    expect(clampFov(95, 40, 90)).toBe(90);
  });
});

describe('clampPitch', () => {
  it('never lets the viewer pass the poles', () => {
    const max = (85 * Math.PI) / 180;
    expect(clampPitch(Math.PI)).toBeCloseTo(max);
    expect(clampPitch(-Math.PI)).toBeCloseTo(-max);
    expect(clampPitch(0.3)).toBeCloseTo(0.3);
  });
});

describe('wrapAngle', () => {
  it('normalizes into (-PI, PI]', () => {
    expect(wrapAngle(0)).toBe(0);
    expect(wrapAngle(Math.PI * 3)).toBeCloseTo(Math.PI);
    expect(wrapAngle(-Math.PI * 3)).toBeCloseTo(Math.PI);
    expect(wrapAngle(Math.PI * 2 + 0.5)).toBeCloseTo(0.5);
    expect(wrapAngle(-0.25)).toBeCloseTo(-0.25);
  });
});

describe('dampVelocity', () => {
  it('decays exponentially and is frame-rate independent', () => {
    const oneFrame = dampVelocity(10, 6, 1 / 30);
    const twoFrames = dampVelocity(dampVelocity(10, 6, 1 / 60), 6, 1 / 60);
    expect(oneFrame).toBeCloseTo(twoFrames);
    expect(oneFrame).toBeLessThan(10);
    expect(dampVelocity(10, 6, 10)).toBeCloseTo(0);
  });
});
