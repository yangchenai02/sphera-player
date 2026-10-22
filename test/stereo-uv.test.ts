import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import {
  createEyeSphere,
  eyeTextureTransform,
  stereoPresentation,
  StereoProjection,
} from '../src/projections/stereo';
import { VR180Projection } from '../src/projections/vr180';

describe('eyeTextureTransform', () => {
  it('top-bottom: left eye is the top half of the frame', () => {
    // UV v=0 is the bottom of the texture, so the top half starts at 0.5.
    expect(eyeTextureTransform('tb', 'left')).toEqual({ repeat: [1, 0.5], offset: [0, 0.5] });
    expect(eyeTextureTransform('tb', 'right')).toEqual({ repeat: [1, 0.5], offset: [0, 0] });
  });

  it('side-by-side: left eye is the left half of the frame', () => {
    expect(eyeTextureTransform('sbs', 'left')).toEqual({ repeat: [0.5, 1], offset: [0, 0] });
    expect(eyeTextureTransform('sbs', 'right')).toEqual({ repeat: [0.5, 1], offset: [0.5, 0] });
  });
});

describe('stereo projections', () => {
  it('builds two eye spheres on layers 1 (left) and 2 (right)', () => {
    const texture = new THREE.Texture();
    const group = new StereoProjection('equirect360-sbs', 'sbs').build(texture);
    expect(group.children).toHaveLength(2);
    const [left, right] = group.children as THREE.Mesh[];
    expect(left.layers.mask).toBe(1 << 1);
    expect(right.layers.mask).toBe(1 << 2);
  });

  it('eye spheres use clones of the base texture, never the original', () => {
    const texture = new THREE.Texture();
    const mesh = createEyeSphere(texture, 'tb', 'left');
    const material = mesh.material as THREE.MeshBasicMaterial;
    expect(material.map).not.toBe(texture);
    expect(material.map?.repeat.toArray()).toEqual([1, 0.5]);
    expect(material.map?.offset.toArray()).toEqual([0, 0.5]);
    expect(material.userData.disposeMap).toBe(true);
  });

  it('VR180 builds two hemisphere eye spheres', () => {
    const texture = new THREE.Texture();
    const group = new VR180Projection().build(texture);
    expect(group.children).toHaveLength(2);
    for (const child of group.children as THREE.Mesh[]) {
      const params = (child.geometry as THREE.SphereGeometry).parameters;
      expect(params.phiLength).toBeCloseTo(Math.PI);
    }
  });
});

describe('stereoPresentation', () => {
  it('flat mode enables only the left eye layer on the camera', () => {
    const camera = new THREE.PerspectiveCamera();
    stereoPresentation(camera, 'flat');
    expect(camera.layers.isEnabled(0)).toBe(true);
    expect(camera.layers.isEnabled(1)).toBe(true);
    expect(camera.layers.isEnabled(2)).toBe(false);
  });

  it('xr mode returns the camera mask to layer 0 only', () => {
    const camera = new THREE.PerspectiveCamera();
    stereoPresentation(camera, 'flat');
    stereoPresentation(camera, 'xr');
    expect(camera.layers.mask).toBe(1);
  });
});
