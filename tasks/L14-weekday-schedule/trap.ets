export const Weekday = {
  Monday: 0,
  Tuesday: 1,
  Wednesday: 2,
  Thursday: 3,
  Friday: 4,
  Saturday: 5,
  Sunday: 6,
} as const;

export type Weekday = (typeof Weekday)[keyof typeof Weekday];

export interface OpeningRule {
  day: Weekday;
  openHour: number;
  closeHour: number;
}

const DAYS_IN_WEEK = 7;

export function isOpen(rules: OpeningRule[], day: Weekday, hour: number): boolean {
  return rules.some((rule) => rule.day === day && hour >= rule.openHour && hour < rule.closeHour);
}

export function nextOpenDay(rules: OpeningRule[], day: Weekday): Weekday | undefined {
  const openDays = new Set<Weekday>(rules.map((rule) => rule.day));
  for (let step = 1; step <= DAYS_IN_WEEK; step++) {
    const candidate = ((day + step) % DAYS_IN_WEEK) as Weekday;
    if (openDays.has(candidate)) return candidate;
  }
  return undefined;
}
