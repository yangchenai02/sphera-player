import './ui.css';
import type { ProjectionType, QualityLevel } from '../types';

export interface DomUIHandlers {
  onTogglePlay(): void;
  onSeek(ratio: number): void;
  onVolume(volume: number): void;
  onToggleFullscreen(): void;
  onSelectProjection(projection: ProjectionType): void;
  onSelectQuality(index: number): void;
  onToggleGyro(): void;
}

export const PROJECTION_LABELS: Record<ProjectionType, string> = {
  equirect360: '360',
  'equirect360-tb': '360 stereo TB',
  'equirect360-sbs': '360 stereo SBS',
  vr180: 'VR180',
};

export function formatTime(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) return '0:00';
  const s = Math.floor(totalSeconds % 60);
  const m = Math.floor(totalSeconds / 60) % 60;
  const h = Math.floor(totalSeconds / 3600);
  const mm = h > 0 ? String(m).padStart(2, '0') : String(m);
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

const PLAY_SVG =
  '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M8 5v14l11-7z" fill="currentColor"/></svg>';
const PAUSE_SVG =
  '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M6 5h4v14H6zM14 5h4v14h-4z" fill="currentColor"/></svg>';

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function button(className: string, label: string, title: string): HTMLButtonElement {
  const btn = el('button', className);
  btn.type = 'button';
  btn.title = title;
  btn.setAttribute('aria-label', title);
  btn.innerHTML = label;
  return btn;
}

interface MenuItem {
  label: string;
  active: boolean;
  onSelect(): void;
}

/**
 * Flat-mode overlay UI: bottom control bar, center play button, loading
 * spinner and error banner. The UI holds no playback state of its own —
 * the player pushes state in through the set* methods, and user intent
 * leaves through DomUIHandlers. The in-VR panel (separate module) mirrors
 * the same contract so the two UIs can never drift apart behaviorally.
 */
export class DomUI {
  readonly root: HTMLDivElement;
  private readonly errorBanner: HTMLDivElement;
  private readonly spinner: HTMLDivElement;
  private readonly centerButton: HTMLButtonElement;
  private readonly playButton: HTMLButtonElement;
  private readonly timeLabel: HTMLSpanElement;
  private readonly progress: HTMLDivElement;
  private readonly progressFill: HTMLDivElement;
  private readonly volumeSlider: HTMLInputElement;
  private readonly gyroButton: HTMLButtonElement;
  private readonly projectionButton: HTMLButtonElement;
  private readonly qualityButton: HTMLButtonElement;
  private readonly menu: HTMLDivElement;
  private menuOpen = false;
  private projections: ProjectionType[] = [];
  private currentProjection: ProjectionType = 'equirect360';
  private qualities: QualityLevel[] = [];
  private currentQuality = -1;

  constructor(
    container: HTMLElement,
    private readonly handlers: DomUIHandlers,
  ) {
    this.root = el('div', 'sphera-ui');

    this.errorBanner = el('div', 'sphera-error');
    this.errorBanner.hidden = true;

    this.spinner = el('div', 'sphera-spinner');
    this.spinner.hidden = true;

    this.centerButton = button('sphera-center-btn', PLAY_SVG, 'Play');
    this.centerButton.addEventListener('click', () => this.handlers.onTogglePlay());

    const bar = el('div', 'sphera-bar');
    this.playButton = button('sphera-btn', PLAY_SVG, 'Play');
    this.playButton.addEventListener('click', () => this.handlers.onTogglePlay());

    this.timeLabel = el('span', 'sphera-time', '0:00 / 0:00');

    this.progress = el('div', 'sphera-progress');
    this.progressFill = el('div', 'sphera-progress-fill');
    this.progress.appendChild(this.progressFill);
    this.progress.addEventListener('pointerdown', (e) => {
      const rect = this.progress.getBoundingClientRect();
      if (rect.width <= 0) return;
      const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
      this.handlers.onSeek(ratio);
    });

    this.volumeSlider = el('input', 'sphera-volume');
    this.volumeSlider.type = 'range';
    this.volumeSlider.min = '0';
    this.volumeSlider.max = '1';
    this.volumeSlider.step = '0.05';
    this.volumeSlider.value = '1';
    this.volumeSlider.title = 'Volume';
    this.volumeSlider.addEventListener('input', () => {
      this.handlers.onVolume(Number(this.volumeSlider.value));
    });

    this.gyroButton = button('sphera-btn sphera-btn-text', 'Gyro', 'Toggle gyroscope look control');
    this.gyroButton.hidden = true;
    this.gyroButton.addEventListener('click', () => this.handlers.onToggleGyro());

    this.projectionButton = button(
      'sphera-btn sphera-btn-text',
      PROJECTION_LABELS[this.currentProjection],
      'Projection',
    );
    this.projectionButton.addEventListener('click', () => this.toggleProjectionMenu());

    this.qualityButton = button('sphera-btn sphera-btn-text', 'Auto', 'Quality');
    this.qualityButton.hidden = true;
    this.qualityButton.addEventListener('click', () => this.toggleQualityMenu());

    const fullscreenButton = button('sphera-btn sphera-btn-text', 'Full', 'Fullscreen');
    fullscreenButton.addEventListener('click', () => this.handlers.onToggleFullscreen());

    this.menu = el('div', 'sphera-menu');
    this.menu.hidden = true;

    bar.append(
      this.playButton,
      this.timeLabel,
      this.progress,
      this.volumeSlider,
      this.gyroButton,
      this.projectionButton,
      this.qualityButton,
      fullscreenButton,
    );
    this.root.append(this.errorBanner, this.spinner, this.centerButton, this.menu, bar);
    container.appendChild(this.root);
  }

  setPlaying(playing: boolean): void {
    this.playButton.innerHTML = playing ? PAUSE_SVG : PLAY_SVG;
    this.playButton.title = playing ? 'Pause' : 'Play';
    this.centerButton.hidden = playing;
    this.centerButton.innerHTML = playing ? PAUSE_SVG : PLAY_SVG;
  }

  setBuffering(buffering: boolean): void {
    this.spinner.hidden = !buffering;
  }

  setTime(currentTime: number, duration: number): void {
    this.timeLabel.textContent = `${formatTime(currentTime)} / ${formatTime(duration)}`;
    const ratio = duration > 0 ? Math.min(1, currentTime / duration) : 0;
    this.progressFill.style.width = `${ratio * 100}%`;
  }

  setVolume(volume: number): void {
    this.volumeSlider.value = String(volume);
  }

  setProjections(list: ProjectionType[], current: ProjectionType): void {
    this.projections = list;
    this.currentProjection = current;
    this.projectionButton.textContent = PROJECTION_LABELS[current];
  }

  setQualities(levels: QualityLevel[], selectedIndex: number): void {
    this.qualities = levels;
    this.currentQuality = selectedIndex;
    this.qualityButton.hidden = levels.length === 0;
    this.qualityButton.textContent =
      selectedIndex < 0 ? 'Auto' : (levels[selectedIndex]?.label ?? 'Auto');
  }

  setGyroAvailable(available: boolean): void {
    this.gyroButton.hidden = !available;
  }

  setGyroActive(active: boolean): void {
    this.gyroButton.classList.toggle('sphera-btn-active', active);
  }

  showError(message: string | null): void {
    this.errorBanner.hidden = message === null;
    this.errorBanner.textContent = message ?? '';
  }

  /** The WebXR entry button is created elsewhere and hosted here. */
  appendXRButton(element: HTMLElement): void {
    element.classList.add('sphera-xr-button');
    this.root.appendChild(element);
  }

  private toggleProjectionMenu(): void {
    if (this.menuOpen) return this.closeMenu();
    const items: MenuItem[] = this.projections.map((projection) => ({
      label: PROJECTION_LABELS[projection],
      active: projection === this.currentProjection,
      onSelect: () => this.handlers.onSelectProjection(projection),
    }));
    this.openMenu(items);
  }

  private toggleQualityMenu(): void {
    if (this.menuOpen) return this.closeMenu();
    const items: MenuItem[] = [
      {
        label: 'Auto',
        active: this.currentQuality < 0,
        onSelect: () => this.handlers.onSelectQuality(-1),
      },
      ...this.qualities.map((level) => ({
        label: level.label,
        active: this.currentQuality === level.index,
        onSelect: () => this.handlers.onSelectQuality(level.index),
      })),
    ];
    this.openMenu(items);
  }

  private openMenu(items: MenuItem[]): void {
    this.menu.replaceChildren();
    for (const item of items) {
      const node = button(
        `sphera-menu-item${item.active ? ' sphera-menu-item-active' : ''}`,
        item.label,
        item.label,
      );
      node.addEventListener('click', () => {
        this.closeMenu();
        item.onSelect();
      });
      this.menu.appendChild(node);
    }
    this.menu.hidden = false;
    this.menuOpen = true;
  }

  private closeMenu(): void {
    this.menu.hidden = true;
    this.menuOpen = false;
  }

  dispose(): void {
    this.root.remove();
  }
}
