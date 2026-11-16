Write the file `solution.ets`.

Export a type `Transform`: a function that takes one `string` and returns a `string`.

Export three functions that fit `Transform`:

- `trim(text: string): string` removes whitespace from both ends.
- `lowerCase(text: string): string` turns the text into lower case.
- `collapseSpaces(text: string): string` replaces every run of whitespace characters (spaces, tabs, line breaks) with one space.

Export a class `Pipeline`: an ordered list of named steps. `new Pipeline()` has no steps.

- `add(name: string, step: Transform)` puts a step at the end and returns the pipeline itself, so calls can be chained: `new Pipeline().add('trim', trim).add('lower', lowerCase)`. The same name may be added more than once.
- `run(text: string): string` passes the text through every step in the order they were added and returns the result. With no steps it returns the text unchanged.
- `names(): string[]` returns the step names in order, as a new array.
- `toFunction(): Transform` returns a function that does what `run` does. It keeps working when it is stored in a variable or handed to another function, and it also runs the steps added after it was made.

Export a function `compose(...steps: Transform[]): Transform` that returns one function applying the given steps from first to last. With no steps it returns its input unchanged.
