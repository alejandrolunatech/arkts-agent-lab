export type Pair<A, B> = { first: A; second: B };

export function chunk<T>(items: T[], size: number): T[][] {
  if (size < 1) return [];
  return Array.from({ length: Math.ceil(items.length / size) }, (_, index) =>
    items.slice(index * size, (index + 1) * size),
  );
}

export function zip<A, B>(a: A[], b: B[]): Pair<A, B>[] {
  const length = Math.min(a.length, b.length);
  return a.slice(0, length).map((first, index) => ({ first, second: b[index] }));
}
