Write the file `solution.ets`: one ArkUI page for a HarmonyOS app (stage model, ArkTS), made of two components in the same file.

The page is the entry component. It owns a rating, a whole number from 0 to 5 that starts at 3, and shows it in a line of text: "Your rating: 3".

Under that line the page places a second, separate component: the rating control. The control does not keep a rating of its own; it works on the page's rating. It shows:

- a button "-" that lowers the rating by 1, never below 0,
- the text "3 / 5" (the current rating out of 5),
- a button "+" that raises the rating by 1, never above 5.

When a button in the control is tapped, both the control's text and the page's "Your rating" line must show the new value.
