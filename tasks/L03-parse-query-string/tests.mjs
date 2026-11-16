import test from 'node:test';
import assert from 'node:assert/strict';
import { parseQuery } from './solution.mjs';

test('parses pairs into a Map, in order', () => {
  const params = parseQuery('a=1&b=two&c=3');
  assert.ok(params instanceof Map);
  assert.deepEqual([...params], [['a', '1'], ['b', 'two'], ['c', '3']]);
});

test('ignores a leading question mark and empty parts', () => {
  assert.deepEqual([...parseQuery('?a=1&&b=2&')], [['a', '1'], ['b', '2']]);
  assert.equal(parseQuery('').size, 0);
  assert.equal(parseQuery('?').size, 0);
  assert.equal(parseQuery('&&').size, 0);
});

test('the last value wins and the key keeps its first position', () => {
  const params = parseQuery('sort=asc&page=2&sort=desc');
  assert.deepEqual([...params], [['sort', 'desc'], ['page', '2']]);
});

test('splits at the first equals sign and allows missing values', () => {
  const params = parseQuery('expr=a=b&flag&empty=&=5');
  assert.deepEqual([...params], [['expr', 'a=b'], ['flag', ''], ['empty', '']]);
});

test('decodes plus signs and percent-escapes in keys and values', () => {
  const params = parseQuery('full+name=Ada+Lovelace&city=Logro%C3%B1o&q=1%2B1%3D2&a%20b=c%26d');
  assert.equal(params.get('full name'), 'Ada Lovelace');
  assert.equal(params.get('city'), 'Logroño');
  assert.equal(params.get('q'), '1+1=2');
  assert.equal(params.get('a b'), 'c&d');
});

test('keeps a malformed escape as written', () => {
  const params = parseQuery('bad=%zz+x&ok=1');
  assert.equal(params.get('bad'), '%zz x');
  assert.equal(params.get('ok'), '1');
});
