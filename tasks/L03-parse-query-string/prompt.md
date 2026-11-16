Write the file `solution.ets`.

Export a function `parseQuery(query: string): Map<string, string>` that parses a URL query string such as `a=1&b=two`.

- One leading `?` is ignored: `?a=1` and `a=1` give the same result.
- Pairs are separated by `&`. Empty parts (as in `a=1&&b=2` or a trailing `&`) are ignored.
- A pair is split at its first `=`: in `expr=a=b` the key is `expr` and the value is `a=b`. A part without `=` is a key with the value `''`.
- Keys and values are decoded: `+` becomes a space and percent-escapes such as `%20` or `%C3%B1` are decoded as UTF-8, so `%2B` gives a literal `+`. A key or value with a malformed escape (`%zz`) is kept as it is written, with only `+` replaced.
- A pair whose key is empty (`=5`) is ignored.
- Keys appear in the map in the order they first appear in the query. When a key appears more than once, the last value wins and the key keeps its first position.
- An empty query returns an empty map.
