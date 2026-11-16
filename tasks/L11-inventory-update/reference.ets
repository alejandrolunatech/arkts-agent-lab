export interface Item {
  id: string;
  name: string;
  quantity: number;
}

export interface Change {
  id: string;
  quantity: number;
}

export function updateQuantity(items: Item[], id: string, quantity: number): Item[] {
  const result: Item[] = [];
  for (const item of items) {
    if (item.id !== id) {
      result.push(item);
    } else if (quantity > 0) {
      const changed: Item = { id: item.id, name: item.name, quantity: quantity };
      result.push(changed);
    }
  }
  return result;
}

export function applyChanges(items: Item[], changes: Change[]): Item[] {
  let result: Item[] = items.slice();
  for (const change of changes) {
    result = updateQuantity(result, change.id, change.quantity);
  }
  return result;
}
