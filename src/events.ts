/** Minimal typed event emitter: no DOM EventTarget, no dependencies. */

export type EventHandler<T> = (payload: T) => void;

export class Emitter<M extends Record<keyof M, unknown>> {
  private handlers = new Map<keyof M, Set<EventHandler<never>>>();

  on<K extends keyof M>(event: K, handler: EventHandler<M[K]>): () => void {
    let set = this.handlers.get(event);
    if (!set) {
      set = new Set();
      this.handlers.set(event, set);
    }
    set.add(handler as EventHandler<never>);
    return () => this.off(event, handler);
  }

  off<K extends keyof M>(event: K, handler: EventHandler<M[K]>): void {
    this.handlers.get(event)?.delete(handler as EventHandler<never>);
  }

  emit<K extends keyof M>(event: K, payload: M[K]): void {
    const set = this.handlers.get(event);
    if (!set) return;
    // Copy first: handlers may unsubscribe (or subscribe) while emitting.
    for (const handler of [...set]) {
      (handler as EventHandler<M[K]>)(payload);
    }
  }

  removeAllListeners(): void {
    this.handlers.clear();
  }
}
