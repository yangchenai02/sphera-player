import type { PlaybackState } from './types';

/**
 * Playback state machine. Invalid transitions are rejected (return false)
 * instead of throwing, so stray media-element events can never corrupt the
 * player's state. `error` is reachable from every active state and can only
 * leave towards `loading` (retry) or `idle` (teardown).
 */
const TRANSITIONS: Record<PlaybackState, readonly PlaybackState[]> = {
  idle: ['loading', 'error'],
  loading: ['ready', 'error', 'idle'],
  ready: ['playing', 'loading', 'error', 'idle'],
  playing: ['paused', 'ended', 'loading', 'error', 'idle'],
  paused: ['playing', 'ended', 'loading', 'error', 'idle'],
  ended: ['playing', 'loading', 'error', 'idle'],
  error: ['loading', 'idle'],
};

export type StateChangeListener = (from: PlaybackState, to: PlaybackState) => void;

export class PlaybackStateMachine {
  private current: PlaybackState = 'idle';

  constructor(private readonly onChange?: StateChangeListener) {}

  get state(): PlaybackState {
    return this.current;
  }

  canTransition(to: PlaybackState): boolean {
    return TRANSITIONS[this.current].includes(to);
  }

  /** Returns true when the transition was accepted. */
  transition(to: PlaybackState): boolean {
    if (to === this.current) return false;
    if (!this.canTransition(to)) return false;
    const from = this.current;
    this.current = to;
    this.onChange?.(from, to);
    return true;
  }

  reset(): void {
    if (this.current === 'idle') return;
    const from = this.current;
    this.current = 'idle';
    this.onChange?.(from, 'idle');
  }
}
