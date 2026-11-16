Write the file `solution.ets`: one ArkUI page for a HarmonyOS app (stage model, ArkTS).

The data for one log entry is a class `LogEntry` with three fields: `id` (a number), `message` (a string) and `level` (a string: "info", "warning" or "error").

The entry with id n has the message "Event n". Its level is "error" when n is divisible by 50, otherwise "warning" when n is divisible by 10, otherwise "info".

The file creates 3000 entries at the start, with the ids 1 to 3000. Nothing is loaded from a network or a file.

The page is the entry component. It shows:

- at the top, the text "3000 entries", with the number of entries there are now;
- under it, a scrolling list of all the entries, the highest id first.

The list builds its rows only as they scroll into view. It never builds all the rows up front, because there are thousands of them.

A row is a component of its own, declared in the file. It shows the entry's message and, next to it, the entry's level. The level text has the colour `#D32F2F` for "error", `#F57C00` for "warning" and `#757575` for "info".

Pulling the list down from its top shows the standard refresh indicator. One second later, five new entries are added at the top of the list, with the five ids that follow the highest id so far (3001 to 3005 the first time) and the same rules for message and level. Then the indicator hides and the text at the top shows the new number of entries.
