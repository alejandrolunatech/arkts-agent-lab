Write the file `solution.ets`.

Export an interface `Settings` with four fields: `theme: string`, `fontSize: number`, `notifications: boolean` and `language: string`.

Export a type `UserSettings` with the same four fields, all optional.

Export a function `defaultSettings(): Settings` that returns the defaults: theme `'light'`, font size `14`, notifications `true`, language `'en'`. Every call returns a new object.

Export a function `mergeSettings(defaults: Settings, user: UserSettings): Settings` that returns a new object with all four fields:

- A field that `user` has takes the user's value, also when that value is `false`, `0` or `''`.
- A field that `user` does not have takes the value from `defaults`.
- Neither argument is modified.
