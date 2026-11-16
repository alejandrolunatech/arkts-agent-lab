Write the file `solution.ets`.

Export a type named `Shape` that stands for any shape. How you model it (an interface, a class, a type alias) is your choice; model it so that another kind of shape can be added later.

Export three functions that create shapes:

- `circle(radius: number): Shape`
- `rectangle(width: number, height: number): Shape`
- `triangle(base: number, height: number): Shape`, a triangle given by one side and the height on that side.

Export a function `area(shape: Shape): number` that returns the area of one shape: `π · radius²` for a circle, `width · height` for a rectangle and `base · height / 2` for a triangle.

Export a function `totalArea(shapes: Shape[]): number` that returns the sum of the areas of all the shapes, and 0 for an empty list.
