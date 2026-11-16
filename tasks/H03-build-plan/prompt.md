Write the file `solution.ets`: the plan of a build, made from tasks that depend on each other.

Export a class `MissingDependencyError` that extends `Error`.

- Its constructor is `constructor(task: string, dependency: string)`.
- It has two fields, `task: string` and `dependency: string`, holding the constructor arguments.
- Its `message` is `Task '<task>' depends on unknown task '<dependency>'`.

Export a class `CycleError` that extends `Error`.

- Its constructor is `constructor(path: string[])`.
- It has a field `path: string[]` holding the constructor argument.
- Its `message` is `Dependency cycle: ` followed by the names of `path` joined with ` -> `, for example `Dependency cycle: a -> b -> a`.

Export a class `BuildPlan`.

- `constructor(spec: Record<string, string[]>)`: every key of `spec` is the name of a task, and its value lists the names of the tasks it depends on. "Key order" below is the order of the keys of `spec`. A name may appear more than once in a list; that changes nothing. The constructor checks the whole plan and throws as described below.
- `order(): string[]` returns every task once, each one after all the tasks it depends on. The exact order is this: go through the tasks in key order and place each one; to place a task that is not placed yet, first place each of its dependencies in the order in which they are listed, then the task itself. The result is a new array on every call.
- `layers(): string[][]` groups the tasks for running in parallel. Layer 0 holds the tasks that depend on nothing; every other task is in the layer right after the highest layer of its dependencies. Inside a layer the tasks are in key order. A plan without tasks has no layers.
- `dependentsOf(name: string): string[]` returns every task that depends on `name`, directly or through other tasks, in the order they have in `order()`. `name` itself is not included. For a name that is not a task it returns an empty array.

Errors of the constructor:

- First, every dependency must be a key of `spec`. Checking the tasks in key order and each list in its order, the first dependency that is not a key throws `new MissingDependencyError(task, dependency)`.
- Then the tasks are placed as described for `order()`. The tasks whose placing has started and not finished form a chain, in the order in which they were started. When a task in that chain is reached again, the constructor throws a `CycleError` whose `path` is the chain from that task to its end, followed by that task once more. For `{ app: ['lib'], lib: ['core'], core: ['lib'] }` the path is `['lib', 'core', 'lib']`. A task that lists itself gives `['x', 'x']`.
