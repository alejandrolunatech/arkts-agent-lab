Write the file `solution.ets`.

Export `Weekday`, an enumeration of the seven days of the week with the members `Monday`, `Tuesday`, `Wednesday`, `Thursday`, `Friday`, `Saturday` and `Sunday`. Callers write `Weekday.Monday` and use `Weekday` as the type of a day. The week runs from Monday to Sunday.

Export an interface `OpeningRule` with three fields: `day: Weekday`, `openHour: number` and `closeHour: number`. A rule means the place is open on that day from `openHour` up to, but not including, `closeHour`. `openHour` is always lower than `closeHour`. A day can have several rules, for example one for the morning and one for the afternoon, and a day with no rule is closed.

Export a function `isOpen(rules: OpeningRule[], day: Weekday, hour: number): boolean` that says whether some rule covers that day and hour.

Export a function `nextOpenDay(rules: OpeningRule[], day: Weekday): Weekday | undefined`.

- It returns the first day after `day` that has at least one rule, going forward through the week and from Sunday on to Monday.
- `day` itself is never the first candidate. It is the last one: if it is the only day with a rule, the answer is `day`, one week later.
- If no day has a rule, it returns `undefined`.
