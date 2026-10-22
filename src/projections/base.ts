import * as THREE from 'three';
import type { ProjectionType } from '../types';

/**
 * A projection strategy builds the scene geometry for one video layout:
 * which mesh(es) to create, how the video texture maps onto them, and which
 * three.js layers the meshes live on (used for per-eye stereo in WebXR).
 *
 * Texture ownership rule: the base video texture belongs to the player.
 * Strategies that clone it (stereo layouts) must set
 * `material.userData.disposeMap = true` on materials using a clone so
 * disposal here can release the clone without touching the original.
 */
export interface ProjectionStrategy {
  readonly type: ProjectionType;
  build(texture: THREE.Texture): THREE.Group;
  /**
   * Switch between the flat on-screen preview and headset presentation.
   * Stereo strategies use this to make the left eye visible on the flat
   * screen (the camera only enables layer 0 by default).
   */
  setPresentation?(camera: THREE.Camera, mode: 'flat' | 'xr'): void;
  dispose(root: THREE.Object3D): void;
}

/** Dispose geometries and materials under `root`; maps only when flagged. */
export function disposeObjectTree(root: THREE.Object3D): void {
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (mesh.geometry) mesh.geometry.dispose();
    const material = (mesh as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
    if (Array.isArray(material)) {
      for (const m of material) disposeMaterial(m);
    } else if (material) {
      disposeMaterial(material);
    }
  });
}

function disposeMaterial(material: THREE.Material): void {
  const basic = material as THREE.MeshBasicMaterial;
  if (basic.map && material.userData.disposeMap === true) {
    basic.map.dispose();
  }
  material.dispose();
}

/** Radius of the viewing sphere; the camera sits at its center. */
export const VIDEO_SPHERE_RADIUS = 10;

export interface SphereOptions {
  radius?: number;
  widthSegments?: number;
  heightSegments?: number;
  phiStart?: number;
  phiLength?: number;
  material?: THREE.Material;
}

/**
 * Create a sphere mesh textured for inside-out viewing. With no explicit
 * material, a video material is created: BackSide, and tone mapping off so
 * video colors are reproduced faithfully.
 */
export function createVideoSphere(texture: THREE.Texture, opts: SphereOptions = {}): THREE.Mesh {
  const geometry = new THREE.SphereGeometry(
    opts.radius ?? VIDEO_SPHERE_RADIUS,
    opts.widthSegments ?? 64,
    opts.heightSegments ?? 40,
    opts.phiStart ?? 0,
    opts.phiLength ?? Math.PI * 2,
  );
  const material =
    opts.material ??
    new THREE.MeshBasicMaterial({ map: texture, side: THREE.BackSide, toneMapped: false });
  return new THREE.Mesh(geometry, material);
}
