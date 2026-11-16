Write the file `solution.ets`: a small calculator for arithmetic expressions with variables, such as `price * (qty - 1) / 2`.

Export an interface `Token` with three fields:

- `kind: string`, one of `'number'`, `'name'`, `'operator'`, `'paren'`.
- `text: string`, the exact characters of the token.
- `position: number`, the index of the token's first character in the source.

Export a class `ExpressionError` that extends `Error`, with the constructor `constructor(message: string, position: number)` and a field `position: number` holding the second argument. Every error below is an `ExpressionError`.

Export a function `tokenize(source: string): Token[]` that returns the tokens of `source` from left to right.

- Space characters (`' '`) separate tokens and are skipped.
- A number is one or more digits, optionally followed by `.` and one or more digits: `12`, `0.5`. A `.` is only part of a number when it has a digit on both sides.
- A name is a letter `a` to `z`, `A` to `Z` or `_`, followed by any number of those letters, digits or `_`.
- An operator is one of `+`, `-`, `*`, `/`, `%`. A paren is `(` or `)`.
- Any other character throws with the message `Unexpected character '<character>'` and the position of that character.

Export a function `evaluate(source: string, variables: Record<string, number>): number` that returns the value of the expression.

- `*`, `/` and `%` bind tighter than `+` and `-`. Operators of the same strength apply from left to right. Parentheses group. `%` is the remainder, as the `%` operator on numbers.
- A `-` where an operand is expected negates the operand that follows it: `-x`, `2 * -3`, `-(1 + 2)`, `--2` (which is 2). It binds tighter than every two-sided operator. There is no one-sided `+`.
- A name stands for the value stored under that key in `variables`. A name that is not a key of `variables` throws `Unknown variable '<name>'` at the position of the name.
- Dividing by zero with `/` or `%` throws `Division by zero` at the position of the operator.
- A syntax error throws `Unexpected token '<text>'` at the position of the first token that cannot stand where it is: a token other than a number, a name, `-` or `(` where an operand is expected, a token other than `)` where a group must close, or any token after a complete expression. When the source ends where an operand or a `)` is still needed, which includes an empty source, the error is `Unexpected end of expression` at position `source.length`.
- Errors of `tokenize` come first, then syntax errors, and only an expression without syntax errors is evaluated. Evaluation goes from left to right: the left operand of an operator is evaluated completely, then the right one, then the operator is applied. The first error stops everything.
