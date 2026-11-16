Write the file `solution.ets`: one ArkUI page for a HarmonyOS app (stage model, ArkTS). The app has only this page: there is no other page file to open.

The data for one address is a class `Address` with three fields, all strings: `id`, `label` and `street`. The file holds three addresses:

| id   | label | street           |
|------|-------|------------------|
| home | Home  | 12 Elm Street    |
| work | Work  | 400 Harbour Road |
| gym  | Gym   | 7 Mill Lane      |

The page is the entry component. It has two screens, both inside this one page, and moves between them with the system's standard navigation: the second screen is pushed on top of the first, has its own title bar with a back arrow, and the system back gesture returns to the first screen.

The first screen has the title "Checkout" and shows:

- the text "Deliver to: Home", with the label of the chosen address. The home address is chosen at the start;
- a button "Change address". Pressing it opens the second screen and hands it the id of the address that is chosen now;
- the label "Large text" with a switch next to it, off at the start.

The second screen has the title "Addresses" and shows one row per address, with the address's label and street. The row of the address whose id the screen was handed also shows the word "Current".

Pressing a row closes the second screen and hands the id of that row's address back to the first screen as the result. The first screen then shows the label of that address. Going back without pressing a row changes nothing.

A row is a component of its own, declared in the file. Its texts have font size 24 when "Large text" is on and 16 when it is off. The "Large text" value belongs to the page, and the row reads it from the page by itself: it is not passed as a parameter to the second screen, and the second screen does not pass it to the row.
