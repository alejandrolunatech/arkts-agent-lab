Write the file `solution.ets`: one ArkUI page for a HarmonyOS app (stage model, ArkTS).

The page is the entry component. From top to bottom it shows:

- A single-line text input with the placeholder "New todo" and, next to it, a button "Add".
- The list of todos, one line of text per todo, in the order they were added.

Behaviour:

- "Add" appends a todo with the typed text to the end of the list and clears the input. Text that is empty or only spaces adds nothing.
- Tapping a todo removes that todo, and only that one, even when two todos have the same text.
- The list on screen must update when todos are added or removed, and every rendered todo must have a stable key, so that removing one does not rebuild the others.
