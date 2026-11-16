Write the file `solution.ets`: one ArkUI page for a HarmonyOS app (stage model, ArkTS).

The page is the entry component: a settings screen with four rows in a vertical layout. Every row shows, from left to right, an icon (a single letter shown as text), a title that takes the free space, and a value on the right:

| icon | title     | value      |
|------|-----------|------------|
| W    | Wi-Fi     | Home       |
| B    | Bluetooth | On         |
| L    | Language  | English    |
| S    | Storage   | 12 GB free |

The page stays a single component. The layout of a row is written once, as a reusable row builder that takes the icon, the title and the value, and the page calls that builder for all four rows.
