import * as THREE from 'three';

interface DeviceOrientationEventCtor {
  requestPermission?: () => Promise<string>;
}

/**
 * Device-orientation (gyro) look control. Writes the rig's quaternion
 * directly (the pointer control writes the same rig's euler rotation; the
 * player enables only one at a time).
 *
 * The conversion is the classic formulation: YXZ euler from
 * (beta, alpha, -gamma), a fixed -90 degree rotation about X to move from
 * the device frame to the camera frame, then counter-rotation for the
 * screen orientation.
 */
export class DeviceOrientationControls {
  private handler: ((e: DeviceOrientationEvent) => void) | null = null;
  private readonly zee = new THREE.Vector3(0, 0, 1);
  private readonly euler = new THREE.Euler();
  private readonly quat = new THREE.Quaternion();
  private readonly quatDevice = new THREE.Quaternion(-Math.sqrt(0.5), 0, 0, Math.sqrt(0.5));
  private readonly quatScreen = new THREE.Quaternion();

  constructor(private readonly rig: THREE.Object3D) {}

  static isSupported(): boolean {
    return typeof window !== 'undefined' && 'DeviceOrientationEvent' in window;
  }

  /** iOS 13+ requires a user-gesture permission request before events flow. */
  static needsPermission(): boolean {
    if (typeof window === 'undefined') return false;
    const ctor = window.DeviceOrientationEvent as unknown as DeviceOrientationEventCtor;
    return typeof ctor?.requestPermission === 'function';
  }

  static async requestPermission(): Promise<boolean> {
    const ctor = window.DeviceOrientationEvent as unknown as DeviceOrientationEventCtor;
    if (typeof ctor.requestPermission !== 'function') {
      return DeviceOrientationControls.isSupported();
    }
    try {
      return (await ctor.requestPermission()) === 'granted';
    } catch {
      return false;
    }
  }

  get enabled(): boolean {
    return this.handler !== null;
  }

  enable(): void {
    if (this.handler) return;
    this.handler = (e: DeviceOrientationEvent) => this.onOrientation(e);
    window.addEventListener('deviceorientation', this.handler);
  }

  disable(): void {
    if (!this.handler) return;
    window.removeEventListener('deviceorientation', this.handler);
    this.handler = null;
  }

  private onOrientation(e: DeviceOrientationEvent): void {
    if (e.alpha === null || e.beta === null || e.gamma === null) return;
    const alpha = THREE.MathUtils.degToRad(e.alpha);
    const beta = THREE.MathUtils.degToRad(e.beta);
    const gamma = THREE.MathUtils.degToRad(e.gamma);
    const screenAngle = THREE.MathUtils.degToRad(this.screenOrientationDegrees());
    this.euler.set(beta, alpha, -gamma, 'YXZ');
    this.quat.setFromEuler(this.euler);
    this.quat.multiply(this.quatDevice);
    this.quatScreen.setFromAxisAngle(this.zee, -screenAngle);
    this.quat.multiply(this.quatScreen);
    this.rig.quaternion.copy(this.quat);
  }

  private screenOrientationDegrees(): number {
    const orientation = window.screen?.orientation;
    if (orientation && typeof orientation.angle === 'number') return orientation.angle;
    const legacy = (window as unknown as { orientation?: number }).orientation;
    return typeof legacy === 'number' ? legacy : 0;
  }

  dispose(): void {
    this.disable();
  }
}
