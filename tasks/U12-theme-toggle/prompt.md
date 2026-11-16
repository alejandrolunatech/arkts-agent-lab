Write the file `solution.ets`: one ArkUI page for a HarmonyOS app (stage model, ArkTS).

The app has a dark-mode setting, on or off, that is off at the start. It is app-wide: it does not belong to this page, and a component on any page of the app can read it and is redrawn when it changes.

The page is the entry component. It shows the label "Dark mode" with a switch next to it. Turning the switch on or off changes the setting.

Under the switch the page shows two more components. Each is declared as its own component in the file, takes no parameters from the page, and reads the setting by itself:

- a title that says "Dark mode is on" or "Dark mode is off";
- a card with the text "Sample content", with a dark background and light text when dark mode is on, and a light background and dark text when it is off.

Both change as soon as the switch is flipped.
