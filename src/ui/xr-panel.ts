import * as THREE from 'three';
import { formatTime } from './dom-ui';

export type XRPanelAction = 'toggle-play' | 'seek-back' | 'seek-forward';

export interface XRPanelState {
  playing: boolean;
  currentTime: number;
  duration: number;
}

const PANEL_WIDTH = 1024;
const PANEL_HEIGHT = 256;

interface PanelButton {
  action: XRPanelAction;
  x: number;
  y: number;
  w: number;
  h: number;
}

const BUTTONS: PanelButton[] = [
  { action: 'seek-back', x: 128, y: 118, w: 240, h: 88 },
  { action: 'toggle-play', x: 392, y: 118, w: 240, h: 88 },
  { action: 'seek-forward', x: 656, y: 118, w: 240, h: 88 },
];

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

/**
 * In-headset control panel: the DOM overlay is invisible inside a VR
 * session, so the same transport controls are drawn to a canvas texture on
 * a plane anchored to the view rig, slightly below eye level. Interaction
 * arrives as raycast UV coordinates from the player's controllers.
 *
 * Redraws are throttled to when the displayed second or the play state
 * changes — a canvas texture upload per frame would be wasted GPU work.
 */
export class XRPanel {
  readonly group = new THREE.Group();
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly texture: THREE.CanvasTexture;
  private readonly plane: THREE.Mesh;
  private state: XRPanelState = { playing: false, currentTime: 0, duration: 0 };
  private lastDrawnSecond = -1;
  private lastDrawnPlaying: boolean | null = null;

  constructor(private readonly handlers: { onAction(action: XRPanelAction): void }) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = PANEL_WIDTH;
    this.canvas.height = PANEL_HEIGHT;
    const ctx = this.canvas.getContext('2d');
    if (!ctx) throw new Error('XRPanel: 2D canvas context unavailable');
    this.ctx = ctx;
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    const material = new THREE.MeshBasicMaterial({
      map: this.texture,
      transparent: true,
      toneMapped: false,
    });
    this.plane = new THREE.Mesh(
      new THREE.PlaneGeometry(1.15, (1.15 * PANEL_HEIGHT) / PANEL_WIDTH),
      material,
    );
    this.group.add(this.plane);
    this.group.position.set(0, -0.42, -1.3);
    this.group.rotation.x = -0.12;
    this.group.visible = false;
    this.draw();
  }

  setVisible(visible: boolean): void {
    this.group.visible = visible;
  }

  setState(state: XRPanelState): void {
    this.state = state;
    const second = Math.floor(state.currentTime);
    if (second !== this.lastDrawnSecond || state.playing !== this.lastDrawnPlaying) {
      this.draw();
    }
  }

  raycastTargets(): THREE.Object3D[] {
    return [this.plane];
  }

  /** Feed a raycast intersection UV; returns true when a button was hit. */
  handleIntersect(uv: THREE.Vector2 | null | undefined): boolean {
    if (!uv) return false;
    const x = uv.x * PANEL_WIDTH;
    const y = (1 - uv.y) * PANEL_HEIGHT;
    for (const btn of BUTTONS) {
      if (x >= btn.x && x <= btn.x + btn.w && y >= btn.y && y <= btn.y + btn.h) {
        this.handlers.onAction(btn.action);
        return true;
      }
    }
    return false;
  }

  private draw(): void {
    const { ctx, state } = this;
    this.lastDrawnSecond = Math.floor(state.currentTime);
    this.lastDrawnPlaying = state.playing;
    ctx.clearRect(0, 0, PANEL_WIDTH, PANEL_HEIGHT);
    roundedRect(ctx, 4, 4, PANEL_WIDTH - 8, PANEL_HEIGHT - 8, 28);
    ctx.fillStyle = 'rgba(8, 8, 10, 0.82)';
    ctx.fill();

    // Progress bar
    const barX = 48;
    const barW = PANEL_WIDTH - barX * 2;
    roundedRect(ctx, barX, 58, barW, 12, 6);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.28)';
    ctx.fill();
    const ratio = state.duration > 0 ? Math.min(1, state.currentTime / state.duration) : 0;
    if (ratio > 0) {
      roundedRect(ctx, barX, 58, barW * ratio, 12, 6);
      ctx.fillStyle = '#ff5252';
      ctx.fill();
    }

    // Time readout
    ctx.font = '600 34px system-ui, sans-serif';
    ctx.fillStyle = '#fff';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(`${formatTime(state.currentTime)} / ${formatTime(state.duration)}`, barX, 44);

    // Buttons
    const labels: Record<XRPanelAction, string> = {
      'seek-back': '-10s',
      'toggle-play': state.playing ? 'Pause' : 'Play',
      'seek-forward': '+10s',
    };
    ctx.textAlign = 'center';
    for (const btn of BUTTONS) {
      roundedRect(ctx, btn.x, btn.y, btn.w, btn.h, 16);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.16)';
      ctx.fill();
      ctx.font = '600 40px system-ui, sans-serif';
      ctx.fillStyle = '#fff';
      ctx.fillText(labels[btn.action], btn.x + btn.w / 2, btn.y + 58);
    }
    ctx.textAlign = 'left';
    this.texture.needsUpdate = true;
  }

  dispose(): void {
    this.plane.geometry.dispose();
    const material = this.plane.material as THREE.MeshBasicMaterial;
    material.map?.dispose();
    material.dispose();
    this.texture.dispose();
    this.group.removeFromParent();
  }
}
