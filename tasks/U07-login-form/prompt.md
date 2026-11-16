Write the file `solution.ets`: one ArkUI page for a HarmonyOS app (stage model, ArkTS).

The page is the entry component: a sign-in form in a vertical layout.

- A single-line text input for the email, with the placeholder "Email". It brings up the keyboard for typing email addresses.
- A single-line text input for the password, with the placeholder "Password". What the user types in it is masked.
- A button "Sign in".

Validation, checked again every time the user types:

- The email is valid when it has exactly one "@", at least one character before it, and after it a "." with at least one character on each side (`name@host.tld`).
- The password is valid when it has at least 8 characters.
- While the email field is not empty and not valid, the message "Enter a valid email address" is shown under it. While the password field is not empty and not valid, the message "Password must be at least 8 characters" is shown under it. A message disappears as soon as its field is valid or empty.
- "Sign in" is disabled (it cannot be tapped) until both fields are valid. Tapping it when enabled only writes a line to the log; there is no network.
