Write the file `solution.ets`.

Export a function `formatDuration(totalSeconds: number): string`. `totalSeconds` is a whole number.

- Below one minute the text is the seconds and `s`: `0s`, `59s`.
- Below one hour it is minutes and seconds: `1m 00s`, `12m 34s`.
- From one hour on it is hours, minutes and seconds: `1h 05m 09s`, `100h 00m 00s`. Hours are never turned into days.
- The first number is written as it is; every number after it has two digits, with a leading zero when needed.
- Parts are separated by one space.
- A negative value gives `-` followed by the text of the same value without the sign: `-1m 30s`.

Export a function `parseDuration(text: string): number` that reads such a text and returns the seconds.

- The text is one or more parts separated by single spaces. A part is one or more digits followed by `h`, `m` or `s`.
- The parts are added up, whatever their order or size: `1h 05m 09s` is 3909, `90s` is 90, `30s 2m` is 150.
- A `-` in front of the first part makes the result negative: `-1m 30s` is -90.
- Anything else gives `NaN`: an empty text, a part without that shape (`12`, `5x`, `1.5h`), or a space that does not sit between two parts (at either end, or two in a row).
