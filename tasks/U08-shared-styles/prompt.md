Write the file `solution.ets`: one ArkUI page for a HarmonyOS app (stage model, ArkTS).

The page is the entry component. It shows three cards in a vertical layout. Each card has a title and, under it, one line of text:

| title   | text       |
|---------|------------|
| Storage | 12 GB free |
| Battery | 80 %       |
| Network | Wi-Fi      |

All three cards look the same: full width, 16 of padding, corners rounded by 12, background colour `#F1F3F5`. That card look is written once in the file, as a reusable style, and applied to each card.

All three titles look the same: font size 18, bold, colour `#182431`. That title look is also written once, as a reusable text style, and applied to each title.
