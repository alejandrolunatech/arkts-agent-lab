export type Listener<T> = (payload: T) => void;

export class EventBus<T> {
  private listeners: { [event: string]: Listener<T>[] } = {};

  on(event: string, listener: Listener<T>): void {
    const list = this.listeners[event] ?? (this.listeners[event] = []);
    if (!list.includes(listener)) {
      list.push(listener);
    }
  }

  off(event: string, listener: Listener<T>): void {
    const list = this.listeners[event];
    if (!list) {
      return;
    }
    const remaining = list.filter((registered) => registered !== listener);
    if (remaining.length > 0) {
      this.listeners[event] = remaining;
    } else {
      delete this.listeners[event];
    }
  }

  emit(event: string, payload: T): number {
    const current = [...(this.listeners[event] ?? [])];
    for (const listener of current) {
      listener.call(this, payload);
    }
    return current.length;
  }

  listenerCount(event: string): number {
    return this.listeners[event]?.length ?? 0;
  }
}
