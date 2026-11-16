export class Stack<T> {
  readonly #capacity: number;
  #items: T[] = [];

  constructor(capacity: number) {
    this.#capacity = capacity;
  }

  push(item: T): boolean {
    if (this.isFull()) {
      return false;
    }
    this.#items.push(item);
    return true;
  }

  pop(): T | undefined {
    return this.#items.pop();
  }

  peek(): T | undefined {
    return this.#items[this.#items.length - 1];
  }

  size(): number {
    return this.#items.length;
  }

  isEmpty(): boolean {
    return this.#items.length === 0;
  }

  isFull(): boolean {
    return this.#items.length >= this.#capacity;
  }

  clear(): void {
    this.#items.length = 0;
  }

  toArray(): T[] {
    return [...this.#items];
  }
}
