export class LruCache<K, V> {
  private capacity: number;
  // A Map keeps insertion order, so its first key is the least recently used one.
  private entries: Map<K, V> = new Map<K, V>();

  constructor(capacity: number) {
    this.capacity = capacity;
  }

  get size(): number {
    return this.entries.size;
  }

  has(key: K): boolean {
    return this.entries.has(key);
  }

  get(key: K): V | undefined {
    if (!this.entries.has(key)) {
      return undefined;
    }
    const value = this.entries.get(key) as V;
    this.entries.delete(key);
    this.entries.set(key, value);
    return value;
  }

  set(key: K, value: V): void {
    this.entries.delete(key);
    this.entries.set(key, value);
    if (this.entries.size > this.capacity) {
      const oldest = this.entries.keys().next();
      if (!oldest.done) {
        this.entries.delete(oldest.value);
      }
    }
  }

  keys(): K[] {
    return Array.from(this.entries.keys());
  }
}
