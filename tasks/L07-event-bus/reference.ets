export type Listener<T> = (payload: T) => void;

export class EventBus<T> {
  private listeners: Map<string, Listener<T>[]> = new Map<string, Listener<T>[]>();

  on(event: string, listener: Listener<T>): void {
    let list = this.listeners.get(event);
    if (list === undefined) {
      list = [];
      this.listeners.set(event, list);
    }
    if (!list.includes(listener)) {
      list.push(listener);
    }
  }

  off(event: string, listener: Listener<T>): void {
    const list = this.listeners.get(event);
    if (list === undefined) {
      return;
    }
    const index = list.indexOf(listener);
    if (index >= 0) {
      list.splice(index, 1);
    }
    if (list.length === 0) {
      this.listeners.delete(event);
    }
  }

  emit(event: string, payload: T): number {
    const list = this.listeners.get(event);
    if (list === undefined) {
      return 0;
    }
    const current = list.slice();
    for (const listener of current) {
      listener(payload);
    }
    return current.length;
  }

  listenerCount(event: string): number {
    const list = this.listeners.get(event);
    return list === undefined ? 0 : list.length;
  }
}
