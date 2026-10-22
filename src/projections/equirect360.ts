import * as THREE from 'three';
import type { ProjectionType } from '../types';
import { createVideoSphere, disposeObjectTree, type ProjectionStrategy } from './base';

/** Monoscopic 360 video: one equirectangular texture on a full sphere. */
export class Equirect360Projection implements ProjectionStrategy {
  readonly type: ProjectionType = 'equirect360';

  build(texture: THREE.Texture): THREE.Group {
    const group = new THREE.Group();
    group.name = 'sphera-projection-equirect360';
    group.add(createVideoSphere(texture));
    return group;
  }

  dispose(root: THREE.Object3D): void {
    disposeObjectTree(root);
  }
}
