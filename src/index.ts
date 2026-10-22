/** Sphera Player - an XR 360/VR video player built on three.js. */
export const VERSION = '0.1.0';

export { Emitter } from './events';
export type { EventHandler } from './events';
export { PlaybackStateMachine } from './state';
export type { StateChangeListener } from './state';
export type {
  HotspotDef,
  PlaybackState,
  PlayerEventMap,
  PlayerEventName,
  ProjectionType,
  QualityLevel,
  SpheraError,
  SpheraOptions,
} from './types';
