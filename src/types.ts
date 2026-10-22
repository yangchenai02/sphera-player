/** Public types for the Sphera player. */

/** Video layout the player knows how to project onto its viewing geometry. */
export type ProjectionType =
  | 'equirect360'
  | 'equirect360-tb'
  | 'equirect360-sbs'
  | 'vr180';

export type PlaybackState =
  | 'idle'
  | 'loading'
  | 'ready'
  | 'playing'
  | 'paused'
  | 'ended'
  | 'error';

/** A point of interest anchored in the 360 scene (angles in degrees). */
export interface HotspotDef {
  id: string;
  /** Horizontal angle, degrees. 0 faces the initial camera forward (-Z). */
  yaw: number;
  /** Vertical angle, degrees. Positive looks up. */
  pitch: number;
  label?: string;
  data?: unknown;
}

/** One adaptive-streaming quality level, as reported by the source loader. */
export interface QualityLevel {
  index: number;
  height: number;
  bitrate: number;
  label: string;
}

/** Structured error surfaced through the player's `error` event and UI. */
export interface SpheraError {
  /** Machine-readable code, e.g. 'SOURCE_LOAD_FAILED'. */
  code: string;
  message: string;
  fatal: boolean;
  cause?: unknown;
}

export interface SpheraOptions {
  /** Video URL (progressive file or HLS playlist). */
  src: string;
  /** Force how `src` is interpreted; default 'auto' sniffs the extension. */
  sourceType?: 'auto' | 'file' | 'hls';
  /** Initial projection; default 'equirect360'. */
  projection?: ProjectionType;
  /**
   * Autoplay policy: true tries with sound (usually blocked by the browser),
   * 'muted' starts muted which browsers allow. Default false.
   */
  autoplay?: boolean | 'muted';
  muted?: boolean;
  /** 0..1 */
  volume?: number;
  loop?: boolean;
  /** Poster image URL shown before the first frame. */
  poster?: string;
  /** Initial camera field of view in degrees (clamped to 35..100). */
  fov?: number;
  /** Start with device-orientation (gyro) look control when available. */
  gyro?: boolean;
  hotspots?: HotspotDef[];
  /** Value for the video element's crossorigin attribute. Default 'anonymous'. */
  crossorigin?: string;
}

/** Payload map for every event the player emits. */
export interface PlayerEventMap {
  ready: undefined;
  play: undefined;
  pause: undefined;
  ended: undefined;
  seek: { time: number };
  timeupdate: { currentTime: number; duration: number };
  statechange: { from: PlaybackState; to: PlaybackState };
  qualitychange: { index: number; label: string };
  projectionchange: { projection: ProjectionType };
  hotspotactivate: { id: string; data?: unknown };
  xrstart: undefined;
  xrend: undefined;
  error: SpheraError;
}

export type PlayerEventName = keyof PlayerEventMap;
