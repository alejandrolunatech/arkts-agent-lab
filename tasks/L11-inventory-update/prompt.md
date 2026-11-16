Write the file `solution.ets`.

Export an interface `Item` with three fields: `id: string`, `name: string` and `quantity: number`.

Export an interface `Change` with two fields: `id: string` and `quantity: number`.

Export a function `updateQuantity(items: Item[], id: string, quantity: number): Item[]`.

- It returns a new array with the same items in the same order, where the item with that `id` has the new `quantity`.
- If `quantity` is 0 or less, that item is left out of the result instead.
- If no item has that `id`, the result holds the same items as the input.
- It never modifies `items` or any object inside it. The changed item in the result is a new object.
- Ids are unique within `items`.

Export a function `applyChanges(items: Item[], changes: Change[]): Item[]`.

- It applies the changes one after another, each with the rules of `updateQuantity`, and returns the final list.
- Once a change has removed an item, later changes to the same `id` do nothing.
- It never modifies `items`, `changes` or any object inside them.
