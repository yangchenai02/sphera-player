/** Sphera Player - an XR 360/VR video player built on three.js. */
export const VERSION = '0.1.0';

export { Emitter } from './events';
export type { EventHandler } from './events';
export { PlaybackStateMachine } from './state';
export type { StateChangeListener } from './state';
export { SourceLoader, detectSourceKind, mapMediaError } from './source';
export type { SourceKind, SourceTypeOverride } from './source';
export { Equirect360Projection } from './projections/equirect360';
export { createVideoSphere, disposeObjectTree, VIDEO_SPHERE_RADIUS } from './projections/base';
export type { ProjectionStrategy, SphereOptions } from './projections/base';
export { PointerLookControls } from './controls/pointer-look';
export type { PointerLookOptions } from './controls/pointer-look';
export { clampFov, clampPitch, dampVelocity, wrapAngle, MAX_FOV, MIN_FOV } from './controls/look-math';
export { DomUI, formatTime, PROJECTION_LABELS } from './ui/dom-ui';
export type { DomUIHandlers } from './ui/dom-ui';
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
