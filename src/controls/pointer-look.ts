import * as THREE from 'three';
import { clampFov, clampPitch, dampVelocity, wrapAngle } from './look-math';

export interface PointerLookOptions {
  /** Radians of rotation per pixel dragged. Default 0.0025. */
  rotateSpeed?: number;
  /** Inertia decay per second once the pointer is released. Default 6. */
  damping?: number;
}

/**
 * Drag-to-look control shared by mouse and touch (pointer events unify
 * them). Single pointer drags rotate the rig; two pointers pinch to change
 * FOV; the wheel zooms FOV too. The rig is rotated with YXZ euler order so
 * yaw (Y) always applies before pitch (X) — no roll, ever.
 *
 * The rig's rotation is written here; the gyro control (PR for device
 * orientation) writes the same rig's quaternion, and the player enables
 * only one of the two at a time.
 */
export class PointerLookControls {
  enabled = true;
  /** Distance in px the last finished gesture travelled; < ~6 means a tap. */
  lastGestureDistance = 0;

  private readonly pointers = new Map<number, { x: number; y: number }>();
  private velocityYaw = 0;
  private velocityPitch = 0;
  private gestureDistance = 0;
  private pinchDistance = 0;
  private lastMoveTime = 0;
  private disposed = false;

  constructor(
    private readonly rig: THREE.Object3D,
    private readonly camera: THREE.PerspectiveCamera,
    private readonly dom: HTMLElement,
    private readonly opts: PointerLookOptions = {},
  ) {
    this.rig.rotation.order = 'YXZ';
    this.dom.style.touchAction = 'none';
    this.dom.addEventListener('pointerdown', this.onPointerDown);
    this.dom.addEventListener('pointermove', this.onPointerMove);
    this.dom.addEventListener('pointerup', this.onPointerUp);
    this.dom.addEventListener('pointercancel', this.onPointerUp);
    this.dom.addEventListener('wheel', this.onWheel, { passive: false });
  }

  private get rotateSpeed(): number {
    return this.opts.rotateSpeed ?? 0.0025;
  }

  private onPointerDown = (e: PointerEvent): void => {
    if (!this.enabled || this.disposed) return;
    this.dom.setPointerCapture(e.pointerId);
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    this.velocityYaw = 0;
    this.velocityPitch = 0;
    this.gestureDistance = 0;
    this.lastMoveTime = performance.now();
    if (this.pointers.size === 2) {
      const [a, b] = [...this.pointers.values()];
      this.pinchDistance = Math.hypot(a.x - b.x, a.y - b.y);
    }
  };

  private onPointerMove = (e: PointerEvent): void => {
    if (!this.enabled || this.disposed) return;
    const prev = this.pointers.get(e.pointerId);
    if (!prev) return;
    const dx = e.clientX - prev.x;
    const dy = e.clientY - prev.y;
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    this.gestureDistance += Math.abs(dx) + Math.abs(dy);

    if (this.pointers.size === 2) {
      const [a, b] = [...this.pointers.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      if (this.pinchDistance > 0) {
        this.setFov(this.camera.fov - (dist - this.pinchDistance) * 0.15);
      }
      this.pinchDistance = dist;
      return;
    }
    if (this.pointers.size !== 1) return;

    const now = performance.now();
    const dt = Math.max(1, now - this.lastMoveTime) / 1000;
    this.lastMoveTime = now;
    const dyaw = -dx * this.rotateSpeed;
    const dpitch = -dy * this.rotateSpeed;
    this.applyLook(dyaw, dpitch);
    this.velocityYaw = dyaw / dt;
    this.velocityPitch = dpitch / dt;
  };

  private onPointerUp = (e: PointerEvent): void => {
    if (!this.pointers.has(e.pointerId)) return;
    this.pointers.delete(e.pointerId);
    if (this.pointers.size === 0) {
      this.lastGestureDistance = this.gestureDistance;
      this.pinchDistance = 0;
    }
  };

  private onWheel = (e: WheelEvent): void => {
    if (!this.enabled || this.disposed) return;
    e.preventDefault();
    this.setFov(this.camera.fov + Math.sign(e.deltaY) * 4);
  };

  private applyLook(dyaw: number, dpitch: number): void {
    const rotation = this.rig.rotation;
    rotation.y = wrapAngle(rotation.y + dyaw);
    rotation.x = clampPitch(rotation.x + dpitch);
    rotation.z = 0;
  }

  private setFov(fov: number): void {
    const next = clampFov(fov);
    if (next === this.camera.fov) return;
    this.camera.fov = next;
    this.camera.updateProjectionMatrix();
  }

  /** Per-frame update: applies leftover inertia after a flick. */
  update(dtSeconds: number): void {
    if (this.disposed || this.pointers.size > 0) return;
    if (Math.abs(this.velocityYaw) < 0.001 && Math.abs(this.velocityPitch) < 0.001) return;
    this.applyLook(this.velocityYaw * dtSeconds, this.velocityPitch * dtSeconds);
    const damping = this.opts.damping ?? 6;
    this.velocityYaw = dampVelocity(this.velocityYaw, damping, dtSeconds);
    this.velocityPitch = dampVelocity(this.velocityPitch, damping, dtSeconds);
  }

  /** Reset the view to the initial forward direction. */
  resetView(): void {
    this.rig.rotation.set(0, 0, 0);
    this.velocityYaw = 0;
    this.velocityPitch = 0;
  }

  dispose(): void {
    this.disposed = true;
    this.dom.removeEventListener('pointerdown', this.onPointerDown);
    this.dom.removeEventListener('pointermove', this.onPointerMove);
    this.dom.removeEventListener('pointerup', this.onPointerUp);
    this.dom.removeEventListener('pointercancel', this.onPointerUp);
    this.dom.removeEventListener('wheel', this.onWheel);
    this.pointers.clear();
  }
}
