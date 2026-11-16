export interface Expense {
  category: string;
  amount: number;
}

export function totalByCategory(expenses: Expense[]): Map<string, number> {
  const totals: { [key: string]: number } = {};
  for (const { category, amount } of expenses) {
    totals[category] = (totals[category] || 0) + amount;
  }
  return new Map(Object.entries(totals));
}
