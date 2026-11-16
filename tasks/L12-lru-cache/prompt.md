Write the file `solution.ets`.

Export a class `LruCache<K, V>`: a cache that holds at most `capacity` keys and, when it is full, drops the key that was used least recently. Keys can be of any type: the number `1` and the string `'1'` are different keys, and two objects are the same key only when they are the same object.

- `constructor(capacity: number)`: `capacity` is a whole number, 1 or more.
- `set(key: K, value: V): void` stores the value and makes `key` the most recently used key. Setting a key that is already stored replaces its value. If the cache then holds more than `capacity` keys, the least recently used key is removed.
- `get(key: K): V | undefined` returns the stored value and makes `key` the most recently used key. For a key that is not stored it returns `undefined`.
- `has(key: K): boolean` says whether the key is stored. It does not count as a use.
- `keys(): K[]` returns the stored keys as a new array, from the least recently used to the most recently used. It does not count as a use.
- A getter `size`, a `number`: how many keys are stored.
