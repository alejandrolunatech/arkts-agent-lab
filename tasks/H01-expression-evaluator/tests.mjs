import test from 'node:test';
import assert from 'node:assert/strict';
import { tokenize, evaluate, ExpressionError } from './solution.mjs';

/** Runs `action` and returns the ExpressionError it throws. */
function failure(action) {
  let caught;
  try {
    action();
  } catch (error) {
    caught = error;
  }
  assert.ok(caught instanceof ExpressionError, 'expected an ExpressionError');
  assert.ok(caught instanceof Error);
  return { message: caught.message, position: caught.position };
}

test('tokenize returns kind, text and position of every token, and rejects other characters', () => {
  const tokens = tokenize('12 + rate_2*(0.5-x)').map((token) => [token.kind, token.text, token.position]);
  assert.deepEqual(tokens, [
    ['number', '12', 0],
    ['operator', '+', 3],
    ['name', 'rate_2', 5],
    ['operator', '*', 11],
    ['paren', '(', 12],
    ['number', '0.5', 13],
    ['operator', '-', 16],
    ['name', 'x', 17],
    ['paren', ')', 18],
  ]);
  assert.deepEqual(tokenize('   '), []);
  assert.deepEqual(tokenize('_a1 % 7').map((token) => token.kind), ['name', 'operator', 'number']);

  assert.deepEqual(failure(() => tokenize('2 $ 3')), { message: "Unexpected character '$'", position: 2 });
  assert.deepEqual(failure(() => tokenize('1. + 2')), { message: "Unexpected character '.'", position: 1 });
  assert.deepEqual(failure(() => tokenize('a + .5')), { message: "Unexpected character '.'", position: 4 });
  assert.deepEqual(failure(() => evaluate('1 + 2 = 3', {})), { message: "Unexpected character '='", position: 6 });
});

test('evaluate follows precedence, grouping and negation', () => {
  assert.equal(evaluate('1 + 2 * 3', {}), 7);
  assert.equal(evaluate('(1 + 2) * 3', {}), 9);
  assert.equal(evaluate('10 - 4 - 3', {}), 3);
  assert.equal(evaluate('100 / 5 / 2', {}), 10);
  assert.equal(evaluate('7 % 4 + 8 / 2', {}), 7);
  assert.equal(evaluate('0.5 + 0.25', {}), 0.75);
  assert.equal(evaluate('2 * -3', {}), -6);
  assert.equal(evaluate('--2', {}), 2);
  assert.equal(evaluate('-(1 + 2) * 2', {}), -6);
  assert.equal(evaluate('5 - -5', {}), 10);
  assert.equal(evaluate('((42))', {}), 42);
});

test('evaluate reads variables and reports unknown ones', () => {
  const variables = { price: 12.5, qty: 4, discount: 0 };
  assert.equal(evaluate('price * qty - discount', variables), 50);
  assert.equal(evaluate('-qty + qty', { qty: 3 }), 0);
  assert.equal(evaluate('discount', variables), 0);
  assert.deepEqual(failure(() => evaluate('price * tax', variables)), { message: "Unknown variable 'tax'", position: 8 });
  assert.deepEqual(failure(() => evaluate('a / 0', {})), { message: "Unknown variable 'a'", position: 0 });
});

test('evaluate reports division by zero at the operator', () => {
  assert.deepEqual(failure(() => evaluate('8 / (2 - 2)', {})), { message: 'Division by zero', position: 2 });
  assert.deepEqual(failure(() => evaluate('1 + 9 % zero', { zero: 0 })), { message: 'Division by zero', position: 6 });
  assert.deepEqual(failure(() => evaluate('1 / 0 + missing', {})), { message: 'Division by zero', position: 2 });
  assert.equal(evaluate('0 / 5', {}), 0);
});

test('syntax errors name the first token that does not fit, before anything is evaluated', () => {
  assert.deepEqual(failure(() => evaluate('1 +', {})), { message: 'Unexpected end of expression', position: 3 });
  assert.deepEqual(failure(() => evaluate('', {})), { message: 'Unexpected end of expression', position: 0 });
  assert.deepEqual(failure(() => evaluate('(1 + 2', {})), { message: 'Unexpected end of expression', position: 6 });
  assert.deepEqual(failure(() => evaluate('(1 + 2 3)', {})), { message: "Unexpected token '3'", position: 7 });
  assert.deepEqual(failure(() => evaluate('1 2', {})), { message: "Unexpected token '2'", position: 2 });
  assert.deepEqual(failure(() => evaluate('4 + * 2', {})), { message: "Unexpected token '*'", position: 4 });
  assert.deepEqual(failure(() => evaluate('+3', {})), { message: "Unexpected token '+'", position: 0 });
  assert.deepEqual(failure(() => evaluate('1 / 0 + )', {})), { message: "Unexpected token ')'", position: 8 });
  assert.deepEqual(failure(() => evaluate('missing )', {})), { message: "Unexpected token ')'", position: 8 });
});
