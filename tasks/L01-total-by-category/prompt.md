Write the file `solution.ets`.

Export an interface `Expense` with two fields: `category: string` and `amount: number`.

Export a function `totalByCategory(expenses: Expense[]): Map<string, number>` that returns the sum of `amount` for each `category`.

- Categories appear in the map in the order they first appear in the input.
- An empty input returns an empty map.
