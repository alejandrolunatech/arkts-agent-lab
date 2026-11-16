Write the file `solution.ets`: the state of a small text editor, changed by patches, with undo, redo and listeners on single fields.

Export an interface `EditorState` with three fields: `text: string`, `cursor: number`, `bold: boolean`.

Export a class `EditorStore`.

- `constructor(initial: EditorState, historyLimit: number)`: the store starts with a copy of `initial`; changing the object that was passed in later has no effect on the store. `historyLimit` is a whole number, 1 or more.
- A getter `state`, an `EditorState`: a new object on every read, holding the current values. Changing the returned object has no effect on the store.
- `apply(patch: Partial<EditorState>): boolean`: every field that is present in `patch` with a value other than `undefined` replaces the current value of that field; the other fields keep their value. When no field ends up with a different value, nothing happens and the result is `false`. Otherwise the change is one step: the state before it can be restored with `undo`, everything that could be redone is forgotten, and the result is `true`.
- `transaction(run: (draft: EditorState) => void): boolean`: calls `run` once with a draft, a copy of the current state that `run` may change field by field. When `run` returns, the values of the draft are applied exactly as `apply` would apply them, as one step, and the result is that of `apply`. When `run` throws, the store is left unchanged and the error reaches the caller.
- `undo(): boolean`: goes back one step and returns `true`, or returns `false` when there is no step to undo.
- `redo(): boolean`: applies again the step that the last `undo` took back and returns `true`, or returns `false` when there is nothing to redo.
- Getters `canUndo` and `canRedo`, both `boolean`: what `undo()` and `redo()` would return.
- The store remembers at most `historyLimit` steps to undo. When a step is added beyond that, the oldest one is forgotten.
- `watch(field: string, listener: (value: string | number | boolean, previous: string | number | boolean) => void): () => void`: `field` is `'text'`, `'cursor'` or `'bold'`. After every `apply`, `transaction`, `undo` or `redo` that changes the value of that field, the listener is called once with the new value and the value before the change. The store's state is already the new one when a listener runs. Listeners are called in the order in which they were registered. The function returned by `watch` removes that listener; calling it again does nothing.
