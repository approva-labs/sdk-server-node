import type { ApprovaEvent } from "./types.js";

type EventType = ApprovaEvent["type"];

type Listener<T extends ApprovaEvent> = (event: T) => void | Promise<void>;

export class ApprovaEventEmitter {
  private listeners = new Map<EventType, Set<Listener<any>>>();

  on<T extends ApprovaEvent>(
    type: T["type"],
    listener: Listener<T>
  ): () => void {
    let listeners = this.listeners.get(type);

    if (!listeners) {
      listeners = new Set();
      this.listeners.set(type, listeners);
    }

    listeners.add(listener);

    return () => {
      listeners?.delete(listener);
    };
  }

  async emit(event: ApprovaEvent): Promise<void> {
    const listeners = this.listeners.get(event.type);

    if (!listeners) {
      return;
    }

    await Promise.all(Array.from(listeners).map((listener) => listener(event)));
  }

  removeAllListeners(): void {
    this.listeners.clear();
  }
}
