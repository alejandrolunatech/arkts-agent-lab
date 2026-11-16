Write the file `solution.ets`: it reads an order from JSON text, checks every field and returns either the order or the list of everything that is wrong with it.

Export an enum `OrderStatus` with three members: `Draft = 'draft'`, `Paid = 'paid'`, `Shipped = 'shipped'`.

Export a class `OrderLine`.

- `constructor(sku: string, quantity: number, unitPrice: number)`, and three fields with those names and types holding the arguments.
- `total(): number` returns `quantity * unitPrice`.

Export three interfaces:

- `Order` with the fields `id: string`, `status: OrderStatus` and `lines: OrderLine[]`.
- `FieldError` with the fields `path: string` and `message: string`.
- `ParseResult` with the fields `order: Order | undefined` and `errors: FieldError[]`.

Export a function `parseOrder(text: string): ParseResult`.

- When `text` is not valid JSON, the result has one error with path `''` and message `invalid JSON`. When it is valid JSON but not a JSON object (an array, `null`, a number, a string, a boolean), the one error has path `''` and message `expected an object`.
- Otherwise the fields below are checked. For these fields a value of `null` is treated exactly like a missing field. Each field gives at most one error: the first of its rules that fails, in the order written. The path of a field of the order is its name.
- `id`: `required` when missing; `expected a string` when not a string; `must not be empty` when `''`.
- `status`: optional, `OrderStatus.Draft` when missing. Any value other than the strings `'draft'`, `'paid'`, `'shipped'` gives `expected one of draft, paid, shipped`.
- `lines`: `required` when missing; `expected an array` when not an array; `must not be empty` when it has no elements. Every element is checked with the path `lines[<index>]`: an element that is not a JSON object gives `expected an object` at that path, and for an object its fields are checked with paths such as `lines[0].sku`:
  - `sku`: the same three rules as `id`.
  - `quantity`: `required` when missing; `expected a number` when not a number; `must be a whole number of 1 or more` when it is a number with a fraction or below 1.
  - `unitPrice`: `required` when missing; `expected a number` when not a number; `must be 0 or more` when negative.
- Any other field, whatever its value, is an error with the message `unknown field`: the path is the field's name for a field of the order, and `lines[<index>].<name>` for a field of a line.
- The errors are listed in this order: `id`, `status`, `lines` (its elements by index, and for each line `sku`, `quantity`, `unitPrice`, then the unknown fields of that line in the order in which they appear in the text), and last the unknown fields of the order in the order in which they appear in the text.
- When there is at least one error, `order` is `undefined`. When there is none, `errors` is an empty array and `order` holds the values, with its lines as `OrderLine` objects in the order of the text.
