Write the file `solution.ets`: one ArkUI page for a HarmonyOS app (stage model, ArkTS).

The page is the entry component. It shows a list of three products, one row of text per product:

| id | name         |
|----|--------------|
| 1  | Desk lamp    |
| 2  | Notebook     |
| 3  | Water bottle |

Tapping a product opens the page `pages/Detail`, which already exists in the app. The page is pushed with the page router, on top of the list, so going back returns to the list. The tapped product's id is passed to it as a parameter named `id`.

Only write the list page.
