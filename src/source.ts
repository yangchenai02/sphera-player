import Hls from 'hls.js';
import { Emitter } from './events';
import type { QualityLevel, SpheraError } from './types';

export type SourceKind = 'hls' | 'file';
export type SourceTypeOverride = 'auto' | 'file' | 'hls';

/**
 * Decide how a source URL should be loaded. Query strings and fragments are
 * ignored so signed URLs (…/master.m3u8?token=…) still detect as HLS.
 */
export function detectSourceKind(
  src: string,
  override: SourceTypeOverride = 'auto',
): SourceKind {
  if (override === 'hls' || override === 'file') return override;
  const clean = src.split(/[?#]/)[0].toLowerCase();
  return clean.endsWith('.m3u8') ? 'hls' : 'file';
}

/** HTMLMediaElement error codes, inlined so this module also runs in tests. */
const MEDIA_ERR_ABORTED = 1;
const MEDIA_ERR_NETWORK = 2;
const MEDIA_ERR_DECODE = 3;
const MEDIA_ERR_SRC_NOT_SUPPORTED = 4;

/** Map an HTMLMediaElement error to a structured SpheraError. */
export function mapMediaError(mediaError: MediaError | null): SpheraError {
  switch (mediaError?.code) {
    case MEDIA_ERR_ABORTED:
      return { code: 'MEDIA_ABORTED', message: 'Media loading was aborted.', fatal: false };
    case MEDIA_ERR_NETWORK:
      return {
        code: 'SOURCE_LOAD_FAILED',
        message:
          'The video failed to load. If the file exists, check that the server sends CORS headers (Access-Control-Allow-Origin) — WebGL textures require them.',
        fatal: true,
      };
    case MEDIA_ERR_DECODE:
      return {
        code: 'MEDIA_DECODE_ERROR',
        message: 'The video could not be decoded by this browser.',
        fatal: true,
      };
    case MEDIA_ERR_SRC_NOT_SUPPORTED:
      return {
        code: 'SOURCE_NOT_SUPPORTED',
        message:
          'The video source is not supported. For 360 playback the file must be reachable over HTTP(S) with CORS enabled.',
        fatal: true,
      };
    default:
      return { code: 'MEDIA_ERROR', message: 'Unknown media error.', fatal: true };
  }
}

export interface SourceEventMap {
  /** Metadata loaded; the video element has dimensions and duration. */
  loaded: undefined;
  /** Adaptive levels became known (HLS via hls.js only). */
  levels: { levels: QualityLevel[] };
  /** The active quality level changed; index -1 means automatic. */
  levelchange: { index: number };
  error: SpheraError;
  [key: string]: unknown;
}

/**
 * Owns the hidden <video> element and how a source gets attached to it:
 * progressive files directly, HLS through hls.js where MSE exists, and
 * native HLS on Safari. Emits structured errors instead of throwing.
 */
export class SourceLoader {
  readonly video: HTMLVideoElement;
  private readonly events = new Emitter<SourceEventMap>();
  private hls: Hls | null = null;
  private levels: QualityLevel[] = [];
  private selectedLevel = -1;
  private disposed = false;

  constructor(crossorigin: string | null = 'anonymous') {
    this.video = document.createElement('video');
    if (crossorigin) this.video.crossOrigin = crossorigin;
    this.video.playsInline = true;
    this.video.preload = 'auto';
    this.video.addEventListener('loadedmetadata', this.handleLoaded);
    this.video.addEventListener('error', this.handleVideoError);
  }

  on<K extends keyof SourceEventMap>(
    event: K,
    handler: (payload: SourceEventMap[K]) => void,
  ): () => void {
    return this.events.on(event, handler);
  }

  attach(src: string, override: SourceTypeOverride = 'auto'): void {
    this.detachPipeline();
    const kind = detectSourceKind(src, override);
    if (kind === 'hls' && Hls.isSupported()) {
      const hls = new Hls({ enableWorker: true });
      this.hls = hls;
      hls.on(Hls.Events.MANIFEST_PARSED, (_evt, data) => {
        this.levels = data.levels.map((level, index) => ({
          index,
          height: level.height,
          bitrate: level.bitrate,
          label: level.height ? `${level.height}p` : `${Math.round(level.bitrate / 1000)} kbps`,
        }));
        this.events.emit('levels', { levels: this.levels });
      });
      hls.on(Hls.Events.LEVEL_SWITCHED, (_evt, data) => {
        this.selectedLevel = data.level;
        this.events.emit('levelchange', { index: data.level });
      });
      hls.on(Hls.Events.ERROR, (_evt, data) => {
        if (!data.fatal) return;
        this.events.emit('error', {
          code: 'HLS_ERROR',
          message: `HLS playback failed (${data.type}: ${data.details}).`,
          fatal: true,
          cause: data,
        });
      });
      hls.loadSource(src);
      hls.attachMedia(this.video);
      return;
    }
    // Progressive file, or HLS on a browser with native support (Safari).
    this.video.src = src;
  }

  getLevels(): QualityLevel[] {
    return this.levels;
  }

  /** -1 selects automatic level switching (hls.js only). */
  setQuality(index: number): void {
    this.selectedLevel = index;
    if (this.hls) {
      this.hls.nextLevel = index;
    }
    this.events.emit('levelchange', { index });
  }

  get quality(): number {
    return this.selectedLevel;
  }

  private handleLoaded = (): void => {
    this.events.emit('loaded', undefined);
  };

  private handleVideoError = (): void => {
    if (this.disposed) return;
    // hls.js manages its own error surface; the element error that follows a
    // fatal HLS error would double-report, so only surface element errors
    // when no HLS pipeline is attached.
    if (this.hls) return;
    this.events.emit('error', mapMediaError(this.video.error));
  };

  private detachPipeline(): void {
    if (this.hls) {
      this.hls.destroy();
      this.hls = null;
    }
    this.levels = [];
    this.selectedLevel = -1;
  }

  dispose(): void {
    this.disposed = true;
    this.detachPipeline();
    this.video.removeEventListener('loadedmetadata', this.handleLoaded);
    this.video.removeEventListener('error', this.handleVideoError);
    this.video.pause();
    this.video.removeAttribute('src');
    this.video.load();
    this.events.removeAllListeners();
  }
}
