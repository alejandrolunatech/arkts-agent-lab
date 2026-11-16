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
  if (quantity <= 0) {
    return items.filter((item) => item.id !== id);
  }
  return items.map((item) => (item.id === id ? { ...item, quantity } : item));
}

export function applyChanges(items: Item[], changes: Change[]): Item[] {
  const byId: Record<string, Item> = {};
  for (const item of items) {
    byId[item.id] = { ...item };
  }
  for (const change of changes) {
    if (byId[change.id] === undefined) continue;
    if (change.quantity <= 0) {
      delete byId[change.id];
    } else {
      byId[change.id].quantity = change.quantity;
    }
  }
  return Object.values(byId);
}
