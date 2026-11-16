Write the file `solution.ets`.

Export an interface `Point` with two fields: `x: number` and `y: number`.

Export an interface `Box` with four fields: `min: Point`, `max: Point`, `width: number` and `height: number`.

Export a function `boundingBox(points: Point[]): Box | undefined` that returns the smallest axis-aligned rectangle that contains every point.

- `min` holds the smallest `x` and the smallest `y` of the input, `max` the largest `x` and the largest `y`.
- `width` is `max.x - min.x` and `height` is `max.y - min.y`.
- A single point gives a box with `min` and `max` equal to that point and a width and height of 0.
- An empty input returns `undefined`.
- `min` and `max` are new objects, never one of the input points, and the input is not modified.
