Write the file `solution.ets`: one ArkUI page for a HarmonyOS app (stage model, ArkTS).

The data for one grocery item is a class `GroceryItem` with three fields: `id` (a number), `name` (a string) and `bought` (a boolean).

The page is the entry component: a shopping list. It starts with four items, none of them bought: Milk (id 1), Bread (id 2), Eggs (id 3) and Apples (id 4). The page shows, from top to bottom:

- the text "4 items, 0 bought", with the number of items in the list and the number of them that are bought. It is always up to date;
- the list, with one row per item;
- a text input with the hint "New item" and, next to it, a button "Add".

A row is a component of its own, declared in the file. It shows the item's name. The name of a bought item is struck through and has the colour `#9E9E9E`.

Holding a finger on a row for half a second flips its item between bought and not bought, and the row shows it at once. A short tap on a row does nothing.

Swiping a row to the left slides it aside and uncovers a button "Delete" with the background colour `#D32F2F` at the right edge of the row, the way rows of a system list do. Pressing "Delete" removes the item from the list.

Pressing "Add" adds an item with the typed name, not bought, at the end of the list, and empties the text input. Spaces around the name are removed, and nothing is added when nothing is left. The new item gets an id that no item has had before, not even an item that was deleted.
