Write the file `solution.ets`.

Export a type `Listener<T>`: a function that takes one argument `payload: T` and returns nothing.

Export a generic class `EventBus<T>` that keeps a list of listeners for each event name. It has a constructor without parameters and four methods:

- `on(event: string, listener: Listener<T>): void` registers `listener` for `event`. Registering the same function again for the same event changes nothing.
- `off(event: string, listener: Listener<T>): void` removes `listener` from `event`. It does nothing when that listener is not registered for that event.
- `emit(event: string, payload: T): number` calls every listener registered for `event` with `payload`, in the order they were registered, and returns how many listeners it called. An event without listeners returns 0.
- `listenerCount(event: string): number` returns how many listeners are registered for `event`.

Events are independent: the same function can be registered for several events, and removing it from one leaves the others.

One `emit` calls the listeners that were registered when it started. A listener that calls `on` or `off` while it runs only changes later calls to `emit`.
