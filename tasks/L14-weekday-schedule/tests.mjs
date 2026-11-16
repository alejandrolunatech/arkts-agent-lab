import test from 'node:test';
import assert from 'node:assert/strict';
import { Weekday, isOpen, nextOpenDay } from './solution.mjs';

function shop() {
  return [
    { day: Weekday.Monday, openHour: 9, closeHour: 13 },
    { day: Weekday.Monday, openHour: 15, closeHour: 19 },
    { day: Weekday.Wednesday, openHour: 10, closeHour: 18 },
    { day: Weekday.Saturday, openHour: 8, closeHour: 12 },
  ];
}

test('the seven days are distinct values', () => {
  const days = [
    Weekday.Monday,
    Weekday.Tuesday,
    Weekday.Wednesday,
    Weekday.Thursday,
    Weekday.Friday,
    Weekday.Saturday,
    Weekday.Sunday,
  ];
  assert.ok(days.every((day) => day !== undefined));
  assert.equal(new Set(days).size, 7);
});

test('is open from the opening hour up to, not including, the closing hour', () => {
  const rules = shop();
  assert.equal(isOpen(rules, Weekday.Wednesday, 10), true);
  assert.equal(isOpen(rules, Weekday.Wednesday, 17), true);
  assert.equal(isOpen(rules, Weekday.Wednesday, 18), false);
  assert.equal(isOpen(rules, Weekday.Wednesday, 9), false);
  assert.equal(isOpen(rules, Weekday.Saturday, 10), true);
});

test('a day can have several rules and a day without a rule is closed', () => {
  const rules = shop();
  assert.equal(isOpen(rules, Weekday.Monday, 12), true);
  assert.equal(isOpen(rules, Weekday.Monday, 13), false);
  assert.equal(isOpen(rules, Weekday.Monday, 14), false);
  assert.equal(isOpen(rules, Weekday.Monday, 15), true);
  assert.equal(isOpen(rules, Weekday.Tuesday, 10), false);
  assert.equal(isOpen(rules, Weekday.Sunday, 10), false);
  assert.equal(isOpen([], Weekday.Monday, 10), false);
});

test('finds the next day with a rule', () => {
  const rules = shop();
  assert.equal(nextOpenDay(rules, Weekday.Monday), Weekday.Wednesday);
  assert.equal(nextOpenDay(rules, Weekday.Tuesday), Weekday.Wednesday);
  assert.equal(nextOpenDay(rules, Weekday.Wednesday), Weekday.Saturday);
  assert.equal(nextOpenDay(rules, Weekday.Friday), Weekday.Saturday);
});

test('goes on from Sunday to Monday', () => {
  const rules = shop();
  assert.equal(nextOpenDay(rules, Weekday.Saturday), Weekday.Monday);
  assert.equal(nextOpenDay(rules, Weekday.Sunday), Weekday.Monday);
  const sundayOnly = [{ day: Weekday.Sunday, openHour: 10, closeHour: 14 }];
  assert.equal(nextOpenDay(sundayOnly, Weekday.Monday), Weekday.Sunday);
});

test('the same day comes last, and no rule means no day', () => {
  const thursdayOnly = [{ day: Weekday.Thursday, openHour: 9, closeHour: 17 }];
  assert.equal(nextOpenDay(thursdayOnly, Weekday.Thursday), Weekday.Thursday);
  assert.equal(nextOpenDay([], Weekday.Monday), undefined);
  assert.equal(nextOpenDay([], Weekday.Sunday), undefined);
});
