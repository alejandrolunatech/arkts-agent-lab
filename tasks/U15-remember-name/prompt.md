Write the file `solution.ets`: one ArkUI page for a HarmonyOS app (stage model, ArkTS).

The page is the entry component. It shows, from top to bottom:

- a line of text with the saved name, "Hello, Ana" when the saved name is Ana, or "No name saved" when nothing has been saved yet;
- a text input where the user types their name;
- a button "Save".

Pressing "Save" stores the typed name on the device and the line of text shows it. The name must survive closing the app: the next time the page appears, also after the app has been closed and opened again, the saved name is read back and shown.
