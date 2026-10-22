import * as THREE from 'three';
import { Emitter } from './events';
import { PlaybackStateMachine } from './state';
import { SourceLoader } from './source';
import { Equirect360Projection } from './projections/equirect360';
import { StereoProjection } from './projections/stereo';
import { VR180Projection } from './projections/vr180';
import type { ProjectionStrategy } from './projections/base';
import { PointerLookControls } from './controls/pointer-look';
import { DeviceOrientationControls } from './controls/device-orientation';
import { XRSessionHelper } from './controls/xr-session';
import { clampFov } from './controls/look-math';
import { DomUI } from './ui/dom-ui';
import { XRPanel, type XRPanelAction } from './ui/xr-panel';
import { HotspotManager } from './hotspots';
import type {
  HotspotDef,
  PlaybackState,
  PlayerEventMap,
  ProjectionType,
  QualityLevel,
  SpheraError,
  SpheraOptions,
} from './types';

const ALL_PROJECTIONS: ProjectionType[] = [
  'equirect360',
  'equirect360-tb',
  'equirect360-sbs',
  'vr180',
];

/**
 * SpheraPlayer facade: wires the source loader, the active projection
 * strategy, look controls, the DOM UI, the in-VR panel and hotspots into
 * one embeddable player.
 *
 * Scene layout: the camera sits at the origin inside a rig group (the rig
 * carries yaw/pitch from the look controls, and hosts the XR panel and
 * controllers); the projection geometry and hotspots live at the scene
 * root, centered on the same origin.
 */
export class SpheraPlayer {
  private readonly events = new Emitter<PlayerEventMap>();
  private readonly container: HTMLElement;
  private readonly options: SpheraOptions;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly rig = new THREE.Group();
  private readonly camera: THREE.PerspectiveCamera;
  private readonly source: SourceLoader;
  private readonly stateMachine: PlaybackStateMachine;
  private readonly ui: DomUI;
  private readonly panel: XRPanel;
  private readonly hotspots: HotspotManager;
  private readonly controls: PointerLookControls;
  private readonly gyro: DeviceOrientationControls;
  private readonly clock = new THREE.Clock();
  private readonly videoListeners: Array<[string, EventListener]> = [];
  private readonly controllers: THREE.Object3D[] = [];
  private texture: THREE.VideoTexture;
  private strategy: ProjectionStrategy;
  private projectionGroup: THREE.Group | null = null;
  private xr: XRSessionHelper | null = null;
  private gyroActive = false;
  private resizeObserver: ResizeObserver | null = null;
  private disposed = false;

  constructor(target: string | HTMLElement, options: SpheraOptions) {
    const container =
      typeof target === 'string' ? document.querySelector<HTMLElement>(target) : target;
    if (!container) {
      throw new Error(`SpheraPlayer: target not found: ${String(target)}`);
    }
    this.container = container;
    this.options = options;
    container.classList.add('sphera-container');

    this.stateMachine = new PlaybackStateMachine((from, to) => {
      this.events.emit('statechange', { from, to });
    });

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.xr.enabled = true;
    container.appendChild(this.renderer.domElement);
    this.renderer.domElement.addEventListener('click', this.handleCanvasClick);

    this.camera = new THREE.PerspectiveCamera(clampFov(options.fov ?? 75), 1, 0.1, 100);
    this.rig.add(this.camera);
    this.scene.add(this.rig);

    this.source = new SourceLoader(options.crossorigin ?? 'anonymous');
    const video = this.source.video;
    video.muted = options.muted ?? false;
    video.volume = options.volume ?? 1;
    video.loop = options.loop ?? false;
    if (options.poster) video.poster = options.poster;
    this.wireSourceEvents();
    this.wireVideoEvents();

    this.texture = new THREE.VideoTexture(video);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.minFilter = THREE.LinearFilter;
    this.texture.generateMipmaps = false;

    this.strategy = this.createStrategy(options.projection ?? 'equirect360');
    this.buildProjectionGroup();

    this.controls = new PointerLookControls(this.rig, this.camera, this.renderer.domElement);
    this.gyro = new DeviceOrientationControls(this.rig);

    this.panel = new XRPanel({ onAction: (action) => this.handlePanelAction(action) });
    this.rig.add(this.panel.group);

    this.hotspots = new HotspotManager(this.scene, (id, data) => {
      this.events.emit('hotspotactivate', { id, data });
    });
    this.hotspots.addAll(options.hotspots ?? []);

    this.setupControllers();

    this.ui = new DomUI(container, {
      onTogglePlay: () => this.togglePlay(),
      onSeek: (ratio) => {
        if (Number.isFinite(video.duration) && video.duration > 0) {
          this.seek(ratio * video.duration);
        }
      },
      onVolume: (v) => this.setVolume(v),
      onToggleFullscreen: () => this.toggleFullscreen(),
      onSelectProjection: (p) => this.setProjection(p),
      onSelectQuality: (i) => this.source.setQuality(i),
      onToggleGyro: () => void this.setGyroEnabled(!this.gyroActive),
    });
    this.ui.setProjections(ALL_PROJECTIONS, this.strategy.type);
    this.ui.setVolume(video.muted ? 0 : video.volume);
    this.ui.setPlaying(false);
    this.ui.setGyroAvailable(DeviceOrientationControls.isSupported());

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    document.addEventListener('fullscreenchange', this.handleFullscreenChange);
    this.resize();

    this.stateMachine.transition('loading');
    this.source.attach(options.src, options.sourceType ?? 'auto');
    this.renderer.setAnimationLoop(this.tick);

    if (options.gyro) {
      void this.setGyroEnabled(true);
    }
    void XRSessionHelper.isVRSupported().then((supported) => {
      if (!supported || this.disposed) return;
      this.xr = new XRSessionHelper(this.renderer, {
        onStart: () => this.onXRStart(),
        onEnd: () => this.onXREnd(),
      });
      this.ui.appendXRButton(this.xr.button);
    });
  }

  // ------------------------------------------------------------- events

  on<K extends keyof PlayerEventMap>(
    event: K,
    handler: (payload: PlayerEventMap[K]) => void,
  ): () => void {
    return this.events.on(event, handler);
  }

  off<K extends keyof PlayerEventMap>(
    event: K,
    handler: (payload: PlayerEventMap[K]) => void,
  ): void {
    this.events.off(event, handler);
  }

  // ---------------------------------------------------------- transport

  async play(): Promise<void> {
    try {
      await this.source.video.play();
    } catch (cause) {
      this.handleError({
        code: 'PLAY_BLOCKED',
        message: 'Playback was blocked by the browser (autoplay policy). Interact with the player to start playback.',
        fatal: false,
        cause,
      });
    }
  }

  pause(): void {
    this.source.video.pause();
  }

  togglePlay(): void {
    if (this.stateMachine.state === 'playing') this.pause();
    else void this.play();
  }

  seek(timeSeconds: number): void {
    const video = this.source.video;
    const duration = Number.isFinite(video.duration) ? video.duration : 0;
    const clamped = Math.min(Math.max(0, timeSeconds), duration || timeSeconds);
    video.currentTime = clamped;
    this.events.emit('seek', { time: clamped });
  }

  setVolume(volume: number): void {
    const v = Math.min(1, Math.max(0, volume));
    this.source.video.volume = v;
    if (v > 0) this.source.video.muted = false;
    this.ui.setVolume(v);
  }

  setMuted(muted: boolean): void {
    this.source.video.muted = muted;
    this.ui.setVolume(muted ? 0 : this.source.video.volume);
  }

  // -------------------------------------------------------------- gyro

  get gyroEnabled(): boolean {
    return this.gyroActive;
  }

  /**
   * Switch between pointer look and device-orientation look. Returns false
   * when gyro is unavailable or the (iOS) permission request was denied.
   */
  async setGyroEnabled(enabled: boolean): Promise<boolean> {
    if (enabled === this.gyroActive) return this.gyroActive;
    if (!enabled) {
      this.gyro.disable();
      this.controls.enabled = true;
      this.gyroActive = false;
      this.ui.setGyroActive(false);
      return true;
    }
    if (!DeviceOrientationControls.isSupported()) return false;
    if (DeviceOrientationControls.needsPermission()) {
      const granted = await DeviceOrientationControls.requestPermission();
      if (!granted) return false;
    }
    this.gyro.enable();
    this.controls.enabled = false;
    this.gyroActive = true;
    this.ui.setGyroActive(true);
    return true;
  }

  // ----------------------------------------------------------- hotspots

  addHotspot(def: HotspotDef): void {
    this.hotspots.add(def);
  }

  removeHotspot(id: string): void {
    this.hotspots.remove(id);
  }

  clearHotspots(): void {
    this.hotspots.clear();
  }

  // ------------------------------------------------------------ queries

  getState(): PlaybackState {
    return this.stateMachine.state;
  }

  getVideoElement(): HTMLVideoElement {
    return this.source.video;
  }

  get currentTime(): number {
    return this.source.video.currentTime;
  }

  get duration(): number {
    return this.source.video.duration;
  }

  getQualityLevels(): QualityLevel[] {
    return this.source.getLevels();
  }

  getProjection(): ProjectionType {
    return this.strategy.type;
  }

  get presenting(): boolean {
    return this.xr?.presenting ?? false;
  }

  // -------------------------------------------------------- projection

  setProjection(type: ProjectionType): void {
    if (type === this.strategy.type) return;
    let next: ProjectionStrategy;
    try {
      next = this.createStrategy(type);
    } catch {
      this.handleError({
        code: 'PROJECTION_NOT_SUPPORTED',
        message: `Projection "${type}" is not supported by this build.`,
        fatal: false,
      });
      return;
    }
    this.teardownProjectionGroup();
    this.strategy = next;
    this.buildProjectionGroup();
    this.ui.setProjections(ALL_PROJECTIONS, type);
    this.events.emit('projectionchange', { projection: type });
  }

  private createStrategy(type: ProjectionType): ProjectionStrategy {
    switch (type) {
      case 'equirect360':
        return new Equirect360Projection();
      case 'equirect360-tb':
        return new StereoProjection('equirect360-tb', 'tb');
      case 'equirect360-sbs':
        return new StereoProjection('equirect360-sbs', 'sbs');
      case 'vr180':
        return new VR180Projection();
      default:
        throw new Error(`Unsupported projection: ${type}`);
    }
  }

  private buildProjectionGroup(): void {
    this.projectionGroup = this.strategy.build(this.texture);
    this.strategy.setPresentation?.(this.camera, this.presenting ? 'xr' : 'flat');
    this.scene.add(this.projectionGroup);
  }

  private teardownProjectionGroup(): void {
    if (!this.projectionGroup) return;
    this.scene.remove(this.projectionGroup);
    this.strategy.dispose(this.projectionGroup);
    this.projectionGroup = null;
  }

  // ---------------------------------------------------------------- XR

  private setupControllers(): void {
    for (let i = 0; i < 2; i++) {
      const controller = this.renderer.xr.getController(i);
      controller.addEventListener('selectstart', () => this.handleXRSelect(controller));
      this.rig.add(controller);
      this.controllers.push(controller);
    }
  }

  private handleXRSelect(controller: THREE.Object3D): void {
    if (this.panel.group.visible) {
      const rotation = new THREE.Matrix4().extractRotation(controller.matrixWorld);
      const raycaster = new THREE.Raycaster();
      raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
      raycaster.ray.direction.set(0, 0, -1).applyMatrix4(rotation);
      const hits = raycaster.intersectObjects(this.panel.raycastTargets(), false);
      if (hits.length > 0 && this.panel.handleIntersect(hits[0].uv)) return;
    }
    this.hotspots.pickFromObject(controller);
  }

  private handlePanelAction(action: XRPanelAction): void {
    switch (action) {
      case 'toggle-play':
        this.togglePlay();
        break;
      case 'seek-back':
        this.seek(this.currentTime - 10);
        break;
      case 'seek-forward':
        this.seek(this.currentTime + 10);
        break;
    }
  }

  private syncPanel(): void {
    const video = this.source.video;
    this.panel.setState({
      playing: this.stateMachine.state === 'playing',
      currentTime: video.currentTime || 0,
      duration: video.duration || 0,
    });
  }

  private onXRStart(): void {
    this.strategy.setPresentation?.(this.camera, 'xr');
    this.panel.setVisible(true);
    this.syncPanel();
    this.events.emit('xrstart', undefined);
  }

  private onXREnd(): void {
    this.strategy.setPresentation?.(this.camera, 'flat');
    this.panel.setVisible(false);
    this.events.emit('xrend', undefined);
  }

  // ------------------------------------------------------------- wiring

  private handleCanvasClick = (e: MouseEvent): void => {
    // A drag also ends in a click; only treat near-zero-movement clicks as
    // hotspot taps.
    if (this.controls.lastGestureDistance > 6) return;
    const rect = this.renderer.domElement.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const ndc = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1,
    );
    this.hotspots.pickFromCamera(this.camera, ndc);
  };

  private wireSourceEvents(): void {
    this.source.on('loaded', () => {
      this.stateMachine.transition('ready');
      this.events.emit('ready', undefined);
      const autoplay = this.options.autoplay;
      if (autoplay === 'muted') {
        this.source.video.muted = true;
        this.ui.setVolume(0);
        void this.play();
      } else if (autoplay === true) {
        void this.play();
      }
    });
    this.source.on('levels', ({ levels }) => {
      this.ui.setQualities(levels, this.source.quality);
    });
    this.source.on('levelchange', ({ index }) => {
      const level = this.source.getLevels()[index];
      this.ui.setQualities(this.source.getLevels(), index);
      this.events.emit('qualitychange', { index, label: level?.label ?? 'Auto' });
    });
    this.source.on('error', (err) => this.handleError(err));
  }

  private wireVideoEvents(): void {
    const video = this.source.video;
    const on = (type: string, handler: EventListener) => {
      video.addEventListener(type, handler);
      this.videoListeners.push([type, handler]);
    };
    on('play', () => {
      this.stateMachine.transition('playing');
      this.ui.setPlaying(true);
      this.syncPanel();
      this.events.emit('play', undefined);
    });
    on('pause', () => {
      if (video.ended) return;
      this.stateMachine.transition('paused');
      this.ui.setPlaying(false);
      this.syncPanel();
      this.events.emit('pause', undefined);
    });
    on('ended', () => {
      this.stateMachine.transition('ended');
      this.ui.setPlaying(false);
      this.syncPanel();
      this.events.emit('ended', undefined);
    });
    on('timeupdate', () => {
      this.ui.setTime(video.currentTime, video.duration || 0);
      this.syncPanel();
      this.events.emit('timeupdate', {
        currentTime: video.currentTime,
        duration: video.duration || 0,
      });
    });
    on('waiting', () => this.ui.setBuffering(true));
    on('playing', () => this.ui.setBuffering(false));
    on('canplay', () => this.ui.setBuffering(false));
  }

  private handleError(err: SpheraError): void {
    if (err.fatal) {
      this.stateMachine.transition('error');
      this.ui.showError(err.message);
      this.ui.setBuffering(false);
    }
    this.events.emit('error', err);
  }

  private toggleFullscreen(): void {
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else {
      void this.container.requestFullscreen?.();
    }
  }

  private handleFullscreenChange = (): void => {
    this.resize();
  };

  private resize(): void {
    const width = this.container.clientWidth || 640;
    const height = this.container.clientHeight || 360;
    this.renderer.setSize(width, height);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  private tick = (): void => {
    if (this.disposed) return;
    const dt = Math.min(this.clock.getDelta(), 0.1);
    this.controls.update(dt);
    this.renderer.render(this.scene, this.camera);
  };

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.renderer.setAnimationLoop(null);
    this.resizeObserver?.disconnect();
    document.removeEventListener('fullscreenchange', this.handleFullscreenChange);
    this.renderer.domElement.removeEventListener('click', this.handleCanvasClick);
    for (const [type, handler] of this.videoListeners) {
      this.source.video.removeEventListener(type, handler);
    }
    this.videoListeners.length = 0;
    for (const controller of this.controllers) {
      this.rig.remove(controller);
    }
    this.controllers.length = 0;
    this.controls.dispose();
    this.gyro.dispose();
    this.xr?.dispose();
    this.hotspots.dispose();
    this.panel.dispose();
    this.ui.dispose();
    this.teardownProjectionGroup();
    this.texture.dispose();
    this.source.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
    this.container.classList.remove('sphera-container');
    this.stateMachine.reset();
    this.events.removeAllListeners();
  }
}
