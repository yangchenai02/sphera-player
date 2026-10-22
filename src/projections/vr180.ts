import * as THREE from 'three';
import type { ProjectionType } from '../types';
import { disposeObjectTree, type ProjectionStrategy } from './base';
import { createEyeSphere, stereoPresentation } from './stereo';

/**
 * VR180: side-by-side stereo frames covering the front hemisphere only.
 * SphereGeometry measures phi from +Z around Y, so phiStart = PI with
 * phiLength = PI selects the hemisphere facing -Z (viewer forward).
 */
export class VR180Projection implements ProjectionStrategy {
  readonly type: ProjectionType = 'vr180';

  build(texture: THREE.Texture): THREE.Group {
    const group = new THREE.Group();
    group.name = 'sphera-projection-vr180';
    const hemisphere = { phiStart: Math.PI, phiLength: Math.PI, widthSegments: 48 };
    group.add(createEyeSphere(texture, 'sbs', 'left', hemisphere));
    group.add(createEyeSphere(texture, 'sbs', 'right', hemisphere));
    return group;
  }

  setPresentation(camera: THREE.Camera, mode: 'flat' | 'xr'): void {
    stereoPresentation(camera, mode);
  }

  dispose(root: THREE.Object3D): void {
    disposeObjectTree(root);
  }
}
