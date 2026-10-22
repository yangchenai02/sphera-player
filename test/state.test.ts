import { describe, expect, it, vi } from 'vitest';
import { PlaybackStateMachine } from '../src/state';

describe('PlaybackStateMachine', () => {
  it('starts in idle', () => {
    expect(new PlaybackStateMachine().state).toBe('idle');
  });

  it('follows the happy path idle -> loading -> ready -> playing -> paused -> ended', () => {
    const sm = new PlaybackStateMachine();
    expect(sm.transition('loading')).toBe(true);
    expect(sm.transition('ready')).toBe(true);
    expect(sm.transition('playing')).toBe(true);
    expect(sm.transition('paused')).toBe(true);
    expect(sm.transition('playing')).toBe(true);
    expect(sm.transition('ended')).toBe(true);
    expect(sm.state).toBe('ended');
  });

  it('rejects transitions that skip states', () => {
    const sm = new PlaybackStateMachine();
    expect(sm.transition('playing')).toBe(false);
    expect(sm.state).toBe('idle');
    sm.transition('loading');
    expect(sm.transition('paused')).toBe(false);
    expect(sm.state).toBe('loading');
  });

  it('treats a transition to the current state as a no-op', () => {
    const sm = new PlaybackStateMachine();
    expect(sm.transition('idle')).toBe(false);
  });

  it('can enter error from any active state and only leave to loading/idle', () => {
    const sm = new PlaybackStateMachine();
    sm.transition('loading');
    expect(sm.transition('error')).toBe(true);
    expect(sm.transition('playing')).toBe(false);
    expect(sm.transition('ready')).toBe(false);
    expect(sm.transition('loading')).toBe(true);
  });

  it('notifies the listener with from/to on accepted transitions only', () => {
    const listener = vi.fn();
    const sm = new PlaybackStateMachine(listener);
    sm.transition('playing'); // rejected, must not notify
    expect(listener).not.toHaveBeenCalled();
    sm.transition('loading');
    expect(listener).toHaveBeenCalledWith('idle', 'loading');
  });

  it('reset returns to idle from anywhere and notifies once', () => {
    const listener = vi.fn();
    const sm = new PlaybackStateMachine(listener);
    sm.transition('loading');
    sm.transition('ready');
    sm.reset();
    expect(sm.state).toBe('idle');
    expect(listener).toHaveBeenLastCalledWith('ready', 'idle');
    const calls = listener.mock.calls.length;
    sm.reset(); // already idle: no extra notification
    expect(listener.mock.calls.length).toBe(calls);
  });
});
