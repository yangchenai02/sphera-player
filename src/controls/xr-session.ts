import * as THREE from 'three';
import { VRButton } from 'three/addons/webxr/VRButton.js';

export interface XRSessionCallbacks {
  onStart?: () => void;
  onEnd?: () => void;
}

interface NavigatorWithXR {
  xr?: { isSessionSupported(mode: string): Promise<boolean> };
}

/**
 * Thin wrapper over three.js WebXR plumbing: enables XR on the renderer,
 * creates the VR entry button (hosted by the player's UI), and forwards
 * session start/end. Per-eye stereo works through the projection layer
 * convention (left eye layer 1, right eye layer 2), which the strategies
 * already follow.
 */
export class XRSessionHelper {
  readonly button: HTMLElement;
  private readonly handleStart: () => void;
  private readonly handleEnd: () => void;

  constructor(
    private readonly renderer: THREE.WebGLRenderer,
    callbacks: XRSessionCallbacks = {},
  ) {
    renderer.xr.enabled = true;
    this.button = VRButton.createButton(renderer);
    this.handleStart = () => callbacks.onStart?.();
    this.handleEnd = () => callbacks.onEnd?.();
    renderer.xr.addEventListener('sessionstart', this.handleStart);
    renderer.xr.addEventListener('sessionend', this.handleEnd);
  }

  static async isVRSupported(): Promise<boolean> {
    const nav = navigator as unknown as NavigatorWithXR;
    if (!nav.xr) return false;
    try {
      return await nav.xr.isSessionSupported('immersive-vr');
    } catch {
      return false;
    }
  }

  get presenting(): boolean {
    return this.renderer.xr.isPresenting;
  }

  dispose(): void {
    this.renderer.xr.removeEventListener('sessionstart', this.handleStart);
    this.renderer.xr.removeEventListener('sessionend', this.handleEnd);
    this.button.remove();
  }
}
