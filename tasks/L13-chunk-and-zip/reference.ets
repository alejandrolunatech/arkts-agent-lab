export interface Pair<A, B> {
  first: A;
  second: B;
}

export function chunk<T>(items: T[], size: number): T[][] {
  const groups: T[][] = [];
  if (size < 1) {
    return groups;
  }
  for (let start = 0; start < items.length; start += size) {
    groups.push(items.slice(start, start + size));
  }
  return groups;
}

export function zip<A, B>(a: A[], b: B[]): Pair<A, B>[] {
  const pairs: Pair<A, B>[] = [];
  const length = Math.min(a.length, b.length);
  for (let i = 0; i < length; i++) {
    const pair: Pair<A, B> = { first: a[i], second: b[i] };
    pairs.push(pair);
  }
  return pairs;
}
