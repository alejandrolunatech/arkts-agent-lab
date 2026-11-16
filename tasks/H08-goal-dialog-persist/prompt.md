Write the file `solution.ets`: one ArkUI page for a HarmonyOS app (stage model, ArkTS).

The page is the entry component: a water tracker with two numbers, the glasses drunk and the daily goal. The first time the app runs, the count is 0 and the goal is 8. The page shows:

- the text "0 of 8 glasses", with the count and the goal;
- under it, the text "Goal reached", only while the count is equal to the goal or higher;
- a button "Add a glass". Pressing it adds 1 to the count;
- a button "Change goal". Pressing it opens a dialog.

The dialog is a component of its own, declared in the file. The system shows it as a modal dialog window on top of the page. It contains:

- the title "Daily goal";
- a field where the user types a number. It is empty when the dialog opens and has the hint "Glasses per day";
- three quick choices, as buttons: "Light", "Standard" and "Active". Pressing one writes its number of glasses into the field: 6, 8 and 12;
- the buttons "Cancel" and "Save".

A quick choice is data: a class `GoalPreset` with the fields `label` (a string) and `glasses` (a number). The file holds the three.

"Cancel" closes the dialog and changes nothing. "Save" does nothing unless the field holds a whole number of 1 or more. When it does, "Save" closes the dialog and gives that number to the page by calling a function that the page handed to the dialog. The page makes that number the new goal. The dialog never changes the goal by itself.

The count and the goal are kept on the device: when the app is closed and opened again, the page shows the count and the goal it showed before.
