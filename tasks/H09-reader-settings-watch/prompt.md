Write the file `solution.ets`: one ArkUI page for a HarmonyOS app (stage model, ArkTS).

The app has two reading settings:

- the text size, a whole number from 14 to 30, which is 18 at the start;
- bold, on or off, which is off at the start.

Both are app-wide: they do not belong to this page, and a component on any page of the app can read and change them and is redrawn when they change.

The page is the entry component. It shows, from top to bottom, the label "Bold" with a switch next to it that turns bold on and off, and then three more components. Each of the three is declared as its own component in the file, takes no parameters from the page, and reads or changes the settings by itself.

The first is the size controls. It shows a button "A-", the text size as a number (for example "18") and a button "A+". The two buttons make the text size 2 smaller or 2 larger, never below 14 and never above 30. Under them it shows three preset buttons, "Small", "Medium" and "Large", that set the text size to 14, 18 and 24. A preset is data: a class `SizePreset` with the fields `label` (a string) and `size` (a number). The file holds the three.

The second is the preview. It shows the sentence "The quick brown fox", drawn at the text size, and in bold when bold is on. When the text size changes, the sentence does not jump to the new size: it grows or shrinks smoothly over 300 milliseconds.

The third is the change counter. It shows the text "Changed 0 times". Every time the text size changes to a different value, the number goes up by 1. Changes to bold are not counted. This component has no buttons and never changes a setting. The count is its own: it starts at 0 when the component is created.
