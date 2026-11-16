Write the file `solution.ets`: one ArkUI page for a HarmonyOS app (stage model, ArkTS).

The page is the entry component. It shows a list of articles that would come from a server. There is no network in this task: buttons on the page stand in for what the server would do. At any moment the page is in exactly one of three states and shows only that state's content:

- **Loading** (the state the page starts in): the text "Loading..." and two buttons. "Finish loading" moves to the loaded state with the articles "First article", "Second article" and "Third article". "Fail loading" moves to the error state.
- **Error**: the text "Could not load the articles." and a button "Retry" that moves back to the loading state.
- **Loaded**: the three articles, one line of text each.

The screen must update when the state changes.
