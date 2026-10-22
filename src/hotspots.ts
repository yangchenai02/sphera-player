import * as THREE from 'three';
import type { HotspotDef } from './types';

/** Hotspots float just inside the viewing sphere. */
export const HOTSPOT_RADIUS = 9.2;

/** Convert yaw/pitch in degrees to a position in the sphere. Yaw 0 = -Z. */
export function yawPitchToPosition(
  yawDeg: number,
  pitchDeg: number,
  radius: number = HOTSPOT_RADIUS,
): THREE.Vector3 {
  const yaw = THREE.MathUtils.degToRad(yawDeg);
  const pitch = THREE.MathUtils.degToRad(pitchDeg);
  return new THREE.Vector3(
    -Math.sin(yaw) * Math.cos(pitch),
    Math.sin(pitch),
    -Math.cos(yaw) * Math.cos(pitch),
  ).multiplyScalar(radius);
}

function createHotspotSprite(def: HotspotDef): THREE.Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('HotspotManager: 2D canvas context unavailable');
  ctx.beginPath();
  ctx.arc(52, 64, 30, 0, Math.PI * 2);
  ctx.fillStyle = '#ff5252';
  ctx.fill();
  ctx.lineWidth = 7;
  ctx.strokeStyle = '#ffffff';
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(52, 64, 10, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  if (def.label) {
    ctx.font = '600 46px system-ui, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.85)';
    ctx.shadowBlur = 10;
    ctx.fillText(def.label, 104, 80);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: false,
  });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(1.7, 0.425, 1);
  sprite.position.copy(yawPitchToPosition(def.yaw, def.pitch));
  sprite.renderOrder = 10;
  sprite.userData.hotspotId = def.id;
  sprite.userData.data = def.data;
  return sprite;
}

/**
 * Manages hotspot sprites in the scene and resolves picks from either a
 * flat-mode camera ray (mouse/tap) or an XR controller ray.
 */
export class HotspotManager {
  private readonly sprites = new Map<string, THREE.Sprite>();
  private readonly raycaster = new THREE.Raycaster();

  constructor(
    private readonly parent: THREE.Object3D,
    private readonly onActivate: (id: string, data?: unknown) => void,
  ) {}

  add(def: HotspotDef): void {
    this.remove(def.id);
    const sprite = createHotspotSprite(def);
    this.sprites.set(def.id, sprite);
    this.parent.add(sprite);
  }

  addAll(defs: Iterable<HotspotDef>): void {
    for (const def of defs) this.add(def);
  }

  remove(id: string): void {
    const sprite = this.sprites.get(id);
    if (!sprite) return;
    this.parent.remove(sprite);
    sprite.material.map?.dispose();
    sprite.material.dispose();
    this.sprites.delete(id);
  }

  clear(): void {
    for (const id of [...this.sprites.keys()]) this.remove(id);
  }

  get size(): number {
    return this.sprites.size;
  }

  raycastTargets(): THREE.Object3D[] {
    return [...this.sprites.values()];
  }

  /** Pick from a camera through normalized device coordinates (-1..1). */
  pickFromCamera(camera: THREE.Camera, ndc: THREE.Vector2): string | null {
    this.raycaster.setFromCamera(ndc, camera);
    return this.pickWithRaycaster();
  }

  /** Pick along an XR controller's forward (-Z) ray. */
  pickFromObject(controller: THREE.Object3D): string | null {
    const rotation = new THREE.Matrix4().extractRotation(controller.matrixWorld);
    this.raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
    this.raycaster.ray.direction.set(0, 0, -1).applyMatrix4(rotation);
    return this.pickWithRaycaster();
  }

  private pickWithRaycaster(): string | null {
    const hits = this.raycaster.intersectObjects(this.raycastTargets(), false);
    const hit = hits[0]?.object;
    if (!hit) return null;
    const id = hit.userData.hotspotId as string;
    this.onActivate(id, hit.userData.data);
    return id;
  }

  dispose(): void {
    this.clear();
  }
}
