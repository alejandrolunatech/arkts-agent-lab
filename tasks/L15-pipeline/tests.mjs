import test from 'node:test';
import assert from 'node:assert/strict';
import { Pipeline, compose, trim, lowerCase, collapseSpaces } from './solution.mjs';

const exclaim = (text) => `${text}!`;
const brackets = (text) => `[${text}]`;

test('the three built-in transforms', () => {
  assert.equal(trim('  Hello World \n'), 'Hello World');
  assert.equal(lowerCase('Hello WORLD'), 'hello world');
  assert.equal(collapseSpaces('a   b \t\n c'), 'a b c');
  assert.equal(collapseSpaces('  a  '), ' a ');
});

test('runs the steps in the order they were added', () => {
  const pipeline = new Pipeline();
  assert.equal(pipeline.run('  Unchanged  '), '  Unchanged  ');
  pipeline.add('exclaim', exclaim);
  pipeline.add('brackets', brackets);
  assert.equal(pipeline.run('hi'), '[hi!]');
  assert.equal(new Pipeline().add('brackets', brackets).add('exclaim', exclaim).run('hi'), '[hi]!');
});

test('add returns the same pipeline so calls chain', () => {
  const pipeline = new Pipeline();
  const returned = pipeline.add('trim', trim);
  assert.equal(returned, pipeline);
  const text = pipeline.add('lower', lowerCase).add('collapse', collapseSpaces).add('exclaim', exclaim).run('  Hello   BIG\tWorld ');
  assert.equal(text, 'hello big world!');
});

test('names lists the steps in order as a new array', () => {
  const pipeline = new Pipeline();
  assert.deepEqual(pipeline.names(), []);
  pipeline.add('trim', trim).add('exclaim', exclaim).add('exclaim', exclaim);
  assert.deepEqual(pipeline.names(), ['trim', 'exclaim', 'exclaim']);
  pipeline.names().push('extra');
  assert.deepEqual(pipeline.names(), ['trim', 'exclaim', 'exclaim']);
  assert.equal(pipeline.run(' a '), 'a!!');
});

test('toFunction gives a function that works on its own', () => {
  const pipeline = new Pipeline().add('trim', trim).add('lower', lowerCase);
  const clean = pipeline.toFunction();
  assert.deepEqual([' A ', 'b  ', '  C'].map((text) => clean(text)), ['a', 'b', 'c']);
  pipeline.add('brackets', brackets);
  assert.equal(clean('  Late '), '[late]');
  const outer = new Pipeline().add('inner', clean).add('exclaim', exclaim);
  assert.equal(outer.run(' Nested '), '[nested]!');
});

test('compose applies its steps from first to last', () => {
  assert.equal(compose(trim, lowerCase, collapseSpaces)('  Many   Spaces HERE  '), 'many spaces here');
  assert.equal(compose(exclaim, brackets)('x'), '[x!]');
  assert.equal(compose(brackets, exclaim)('x'), '[x]!');
  assert.equal(compose()(' same '), ' same ');
});
