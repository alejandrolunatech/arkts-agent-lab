Write the file `solution.ets`.

Export a generic class `Stack<T>`: a last-in, first-out stack that holds at most a fixed number of items.

- `constructor(capacity: number)`: the largest number of items the stack can hold.
- `push(item: T): boolean`: puts `item` on top and returns `true`. When the stack is full it adds nothing and returns `false`.
- `pop(): T | undefined`: removes the top item and returns it, or returns `undefined` when the stack is empty.
- `peek(): T | undefined`: returns the top item without removing it, or `undefined` when the stack is empty.
- `size(): number`: how many items the stack holds.
- `isEmpty(): boolean` and `isFull(): boolean`.
- `clear(): void`: removes every item.
- `toArray(): T[]`: the items from bottom to top, as a new array. Changing that array does not change the stack.
