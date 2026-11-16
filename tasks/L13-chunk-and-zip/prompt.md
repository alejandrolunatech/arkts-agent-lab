Write the file `solution.ets`.

Export a generic type `Pair<A, B>` for an object with two fields: `first: A` and `second: B`.

Export a function `chunk<T>(items: T[], size: number): T[][]`.

- It splits `items` into consecutive groups of `size` elements, in order. The last group holds what is left and may be shorter.
- An empty input gives an empty array.
- A `size` below 1 gives an empty array. Otherwise `size` is a whole number.
- `items` is not modified, and every group is a new array.

Export a function `zip<A, B>(a: A[], b: B[]): Pair<A, B>[]`.

- Element `i` of the result has `first` equal to `a[i]` and `second` equal to `b[i]`.
- The result is as long as the shorter of the two inputs.
- Neither input is modified.
