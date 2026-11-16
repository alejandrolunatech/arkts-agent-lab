Write the file `solution.ets`: one ArkUI page for a HarmonyOS app (stage model, ArkTS).

The page is the entry component. When it appears, it sends an HTTP GET request to `https://example.com/api/items`. The response body is a JSON array of objects, each with an `id` (a number) and a `name` (a string).

- While the request is running, the page shows the text "Loading...".
- When the request succeeds, the page shows a list with one row per item, each row showing the item's name.
- When the request fails, or the server does not answer with status 200, the page shows the text "Could not load the items".
