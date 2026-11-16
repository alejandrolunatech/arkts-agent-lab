import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultSettings, mergeSettings } from './solution.mjs';

const DEFAULTS = { theme: 'light', fontSize: 14, notifications: true, language: 'en' };

test('defaultSettings returns the defaults, a new object every call', () => {
  const first = defaultSettings();
  assert.deepEqual({ ...first }, DEFAULTS);
  first.theme = 'changed';
  assert.equal(defaultSettings().theme, 'light');
});

test('user fields win, missing fields come from the defaults', () => {
  const merged = mergeSettings(defaultSettings(), { theme: 'dark', language: 'es' });
  assert.deepEqual({ ...merged }, { theme: 'dark', fontSize: 14, notifications: true, language: 'es' });
});

test('false, 0 and an empty string are real user values', () => {
  const merged = mergeSettings(defaultSettings(), { notifications: false, fontSize: 0, theme: '' });
  assert.equal(merged.notifications, false);
  assert.equal(merged.fontSize, 0);
  assert.equal(merged.theme, '');
  assert.equal(merged.language, 'en');
});

test('empty user settings give a copy of the defaults', () => {
  const defaults = { theme: 'sepia', fontSize: 18, notifications: false, language: 'nl' };
  const merged = mergeSettings(defaults, {});
  assert.deepEqual({ ...merged }, defaults);
  assert.notEqual(merged, defaults);
});

test('the arguments are not modified', () => {
  const defaults = defaultSettings();
  const user = { fontSize: 20 };
  mergeSettings(defaults, user);
  assert.deepEqual({ ...defaults }, DEFAULTS);
  assert.deepEqual(user, { fontSize: 20 });
});
