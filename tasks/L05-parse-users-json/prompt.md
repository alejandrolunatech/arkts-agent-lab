Write the file `solution.ets`.

Export an interface `User` with three fields: `id: number`, `name: string` and `email: string`.

Export a function `parseUsers(json: string): User[]` that reads a JSON text and returns the valid users in it.

- The text is expected to be a JSON array. If it is not valid JSON, or its top-level value is not an array, the result is an empty array. The function never throws.
- An element of the array is a valid user when it is an object whose `id` is an integer number, whose `name` is a non-empty string and whose `email` is a string that contains `@`.
- Every other element is skipped: `null`, numbers, strings, nested arrays, objects with a missing field or a field of the wrong type (an `id` of `"7"` is not a number).
- Valid users are returned in the order of the input. Each returned user has exactly the fields `id`, `name` and `email`; any other field of the element is dropped.
