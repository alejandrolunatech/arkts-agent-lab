export enum Weekday {
  Monday,
  Tuesday,
  Wednesday,
  Thursday,
  Friday,
  Saturday,
  Sunday
}

export interface OpeningRule {
  day: Weekday;
  openHour: number;
  closeHour: number;
}

const WEEK: Weekday[] = [
  Weekday.Monday,
  Weekday.Tuesday,
  Weekday.Wednesday,
  Weekday.Thursday,
  Weekday.Friday,
  Weekday.Saturday,
  Weekday.Sunday
];

export function isOpen(rules: OpeningRule[], day: Weekday, hour: number): boolean {
  for (const rule of rules) {
    if (rule.day === day && hour >= rule.openHour && hour < rule.closeHour) {
      return true;
    }
  }
  return false;
}

function hasRule(rules: OpeningRule[], day: Weekday): boolean {
  for (const rule of rules) {
    if (rule.day === day) {
      return true;
    }
  }
  return false;
}

export function nextOpenDay(rules: OpeningRule[], day: Weekday): Weekday | undefined {
  const start = WEEK.indexOf(day);
  for (let step = 1; step <= WEEK.length; step++) {
    const candidate = WEEK[(start + step) % WEEK.length];
    if (hasRule(rules, candidate)) {
      return candidate;
    }
  }
  return undefined;
}
