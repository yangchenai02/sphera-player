import * as THREE from 'three';
import type { ProjectionType } from '../types';
import {
  createVideoSphere,
  disposeObjectTree,
  type ProjectionStrategy,
  type SphereOptions,
} from './base';

export type StereoLayout = 'tb' | 'sbs';
export type Eye = 'left' | 'right';

export interface EyeTransform {
  repeat: [number, number];
  offset: [number, number];
}

/**
 * Which slice of the frame belongs to one eye.
 *
 * Top-bottom packs the left eye in the TOP half of the frame; texture UV
 * space has v=0 at the bottom, so the left eye is offset y=0.5.
 * Side-by-side packs the left eye in the left half.
 */
export function eyeTextureTransform(layout: StereoLayout, eye: Eye): EyeTransform {
  if (layout === 'tb') {
    return eye === 'left'
      ? { repeat: [1, 0.5], offset: [0, 0.5] }
      : { repeat: [1, 0.5], offset: [0, 0] };
  }
  return eye === 'left'
    ? { repeat: [0.5, 1], offset: [0, 0] }
    : { repeat: [0.5, 1], offset: [0.5, 0] };
}

/**
 * Build one eye's sphere: a clone of the base video texture cropped to the
 * eye's half of the frame, on the three.js WebXR layer for that eye
 * (left = 1, right = 2). The clone is flagged so disposal releases it
 * without touching the player-owned base texture.
 */
export function createEyeSphere(
  baseTexture: THREE.Texture,
  layout: StereoLayout,
  eye: Eye,
  sphereOpts: SphereOptions = {},
): THREE.Mesh {
  const texture = baseTexture.clone();
  const { repeat, offset } = eyeTextureTransform(layout, eye);
  texture.repeat.set(repeat[0], repeat[1]);
  texture.offset.set(offset[0], offset[1]);
  texture.colorSpace = baseTexture.colorSpace;
  texture.needsUpdate = true;
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    side: THREE.BackSide,
    toneMapped: false,
  });
  material.userData.disposeMap = true;
  const mesh = createVideoSphere(texture, { ...sphereOpts, material });
  mesh.layers.set(eye === 'left' ? 1 : 2);
  return mesh;
}

/**
 * Flat preview of stereo content shows the left eye; in XR the eye layers
 * take over and the camera mask returns to its default (layer 0 only).
 */
export function stereoPresentation(camera: THREE.Camera, mode: 'flat' | 'xr'): void {
  if (mode === 'flat') {
    camera.layers.enable(1);
    camera.layers.disable(2);
  } else {
    camera.layers.disable(1);
    camera.layers.disable(2);
  }
}

/** Stereoscopic 360 video: two eye spheres over one packed frame. */
export class StereoProjection implements ProjectionStrategy {
  constructor(
    readonly type: Extract<ProjectionType, 'equirect360-tb' | 'equirect360-sbs'>,
    private readonly layout: StereoLayout,
  ) {}

  build(texture: THREE.Texture): THREE.Group {
    const group = new THREE.Group();
    group.name = `sphera-projection-${this.type}`;
    group.add(createEyeSphere(texture, this.layout, 'left'));
    group.add(createEyeSphere(texture, this.layout, 'right'));
    return group;
  }

  setPresentation(camera: THREE.Camera, mode: 'flat' | 'xr'): void {
    stereoPresentation(camera, mode);
  }

  dispose(root: THREE.Object3D): void {
    disposeObjectTree(root);
  }
}
