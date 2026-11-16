import test from 'node:test';
import assert from 'node:assert/strict';
import { parseUsers } from './solution.mjs';

const plain = (users) => users.map((user) => ({ ...user }));

test('parses a list of valid users in order', () => {
  const users = parseUsers('[{"id":2,"name":"Bo","email":"bo@example.org"},{"id":1,"name":"Ana","email":"ana@example.org"}]');
  assert.ok(Array.isArray(users));
  assert.deepEqual(plain(users), [
    { id: 2, name: 'Bo', email: 'bo@example.org' },
    { id: 1, name: 'Ana', email: 'ana@example.org' },
  ]);
});

test('invalid JSON gives an empty array and does not throw', () => {
  assert.deepEqual(parseUsers('[{"id":1,'), []);
  assert.deepEqual(parseUsers(''), []);
  assert.deepEqual(parseUsers('not json'), []);
});

test('a top-level value that is not an array gives an empty array', () => {
  assert.deepEqual(parseUsers('{"id":1,"name":"Ana","email":"ana@example.org"}'), []);
  assert.deepEqual(parseUsers('null'), []);
  assert.deepEqual(parseUsers('42'), []);
  assert.deepEqual(parseUsers('"users"'), []);
});

test('skips elements that are not objects', () => {
  const users = parseUsers('[null, 7, "x", true, [1, 2], [], {"id":3,"name":"Cy","email":"cy@example.org"}]');
  assert.deepEqual(plain(users), [{ id: 3, name: 'Cy', email: 'cy@example.org' }]);
});

test('skips objects with missing or wrongly typed fields', () => {
  const users = parseUsers(
    JSON.stringify([
      { id: '7', name: 'Text id', email: 'a@example.org' },
      { id: 1.5, name: 'Fraction id', email: 'b@example.org' },
      { id: 2, name: '', email: 'c@example.org' },
      { id: 3, name: 42, email: 'd@example.org' },
      { id: 4, name: 'No at sign', email: 'example.org' },
      { id: 5, name: 'No email' },
      { name: 'No id', email: 'e@example.org' },
      { id: null, name: 'Null id', email: 'f@example.org' },
      { id: 6, name: 'Null email', email: null },
      {},
      { id: 0, name: 'Zed', email: 'zed@example.org' },
    ]),
  );
  assert.deepEqual(plain(users), [{ id: 0, name: 'Zed', email: 'zed@example.org' }]);
});

test('drops fields that are not part of a user', () => {
  const users = parseUsers('[{"id":9,"name":"Dee","email":"dee@example.org","admin":true,"tags":["a"]}]');
  assert.deepEqual(Object.keys(users[0]).sort(), ['email', 'id', 'name']);
  assert.deepEqual(plain(users), [{ id: 9, name: 'Dee', email: 'dee@example.org' }]);
});
