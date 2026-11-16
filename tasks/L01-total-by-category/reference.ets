export interface Expense {
  category: string;
  amount: number;
}

export function totalByCategory(expenses: Expense[]): Map<string, number> {
  const totals = new Map<string, number>();
  for (const expense of expenses) {
    const current = totals.get(expense.category) ?? 0;
    totals.set(expense.category, current + expense.amount);
  }
  return totals;
}
