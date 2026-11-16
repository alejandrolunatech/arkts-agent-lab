import test from 'node:test';
import assert from 'node:assert/strict';
import { parseOrder, OrderLine, OrderStatus } from './solution.mjs';

/** The errors of a result as `path: message` strings. */
function problems(value) {
  const result = parseOrder(typeof value === 'string' ? value : JSON.stringify(value));
  assert.equal(result.order, undefined);
  return result.errors.map((error) => `${error.path}: ${error.message}`);
}

test('a complete order comes back with OrderLine objects', () => {
  const result = parseOrder(`{
    "lines": [
      { "unitPrice": 9.5, "sku": "pen", "quantity": 2 },
      { "sku": "ink", "quantity": 1, "unitPrice": 20 }
    ],
    "status": "paid",
    "id": "A-17"
  }`);
  assert.deepEqual(result.errors, []);
  const order = result.order;
  assert.equal(order.id, 'A-17');
  assert.equal(order.status, 'paid');
  assert.equal(order.status, OrderStatus.Paid);
  assert.equal(order.lines.length, 2);
  assert.ok(order.lines.every((line) => line instanceof OrderLine));
  assert.deepEqual(order.lines.map((line) => [line.sku, line.quantity, line.unitPrice, line.total()]), [
    ['pen', 2, 9.5, 19],
    ['ink', 1, 20, 20],
  ]);
  assert.equal(new OrderLine('x', 4, 2.5).total(), 10);
});

test('status is draft when it is missing or null, and keeps a valid value', () => {
  const short = parseOrder('{"id":"B-1","lines":[{"sku":"cup","quantity":3,"unitPrice":0}]}');
  assert.deepEqual(short.errors, []);
  assert.equal(short.order.status, 'draft');
  assert.equal(short.order.status, OrderStatus.Draft);
  assert.equal(short.order.lines[0].total(), 0);

  const nulled = parseOrder('{"id":"B-2","status":null,"lines":[{"sku":"cup","quantity":1,"unitPrice":2.5}]}');
  assert.deepEqual(nulled.errors, []);
  assert.equal(nulled.order.status, 'draft');

  const shipped = parseOrder('{"id":"B-3","status":"shipped","lines":[{"sku":"cup","quantity":1,"unitPrice":1}]}');
  assert.equal(shipped.order.status, OrderStatus.Shipped);
  assert.equal(OrderStatus.Shipped, 'shipped');
});

test('text that is not a JSON object gives a single error with an empty path', () => {
  assert.deepEqual(problems('{"id": '), [': invalid JSON']);
  assert.deepEqual(problems(''), [': invalid JSON']);
  assert.deepEqual(problems('[{"id":"A"}]'), [': expected an object']);
  assert.deepEqual(problems('null'), [': expected an object']);
  assert.deepEqual(problems('42'), [': expected an object']);
  assert.deepEqual(problems('"order"'), [': expected an object']);
  assert.deepEqual(problems('true'), [': expected an object']);
});

test('every wrong field of the order is reported, in the fixed order', () => {
  assert.deepEqual(problems({ lines: 'none', status: 'sent' }), [
    'id: required',
    'status: expected one of draft, paid, shipped',
    'lines: expected an array',
  ]);
  assert.deepEqual(problems({ id: 12, status: 1, lines: { sku: 'x' } }), [
    'id: expected a string',
    'status: expected one of draft, paid, shipped',
    'lines: expected an array',
  ]);
  assert.deepEqual(problems({ id: '', lines: [] }), ['id: must not be empty', 'lines: must not be empty']);
  assert.deepEqual(problems({ id: null, lines: null }), ['id: required', 'lines: required']);
  assert.deepEqual(problems({}), ['id: required', 'lines: required']);
  assert.deepEqual(problems({ id: 'C-1', status: 'Paid', lines: [{ sku: 'a', quantity: 1, unitPrice: 1 }] }), [
    'status: expected one of draft, paid, shipped',
  ]);
});

test('every line is checked and reported with its index', () => {
  assert.deepEqual(
    problems({
      id: 'D-1',
      lines: [
        { sku: 'a', quantity: 1, unitPrice: 1 },
        null,
        { sku: '', quantity: '2', unitPrice: -1 },
        [],
        { quantity: 0 },
        'line',
        { sku: 5, quantity: 1.5, unitPrice: null },
      ],
    }),
    [
      'lines[1]: expected an object',
      'lines[2].sku: must not be empty',
      'lines[2].quantity: expected a number',
      'lines[2].unitPrice: must be 0 or more',
      'lines[3]: expected an object',
      'lines[4].sku: required',
      'lines[4].quantity: must be a whole number of 1 or more',
      'lines[4].unitPrice: required',
      'lines[5]: expected an object',
      'lines[6].sku: expected a string',
      'lines[6].quantity: must be a whole number of 1 or more',
      'lines[6].unitPrice: required',
    ],
  );
  assert.deepEqual(problems({ id: 'D-2', lines: [{ sku: 'a', quantity: -3, unitPrice: 0 }] }), [
    'lines[0].quantity: must be a whole number of 1 or more',
  ]);
});

test('unknown fields are errors: those of a line with the line, those of the order last', () => {
  assert.deepEqual(
    problems({
      coupon: 'X',
      id: 'E-1',
      lines: [
        { sku: 'a', quantity: 1, unitPrice: 1, colour: 'red' },
        { size: null, sku: 'b', price: 3, quantity: 1 },
      ],
      total: 10,
      Status: 'paid',
    }),
    [
      'lines[0].colour: unknown field',
      'lines[1].unitPrice: required',
      'lines[1].size: unknown field',
      'lines[1].price: unknown field',
      'coupon: unknown field',
      'total: unknown field',
      'Status: unknown field',
    ],
  );
  assert.deepEqual(problems({ id: 'E-2', lines: [{ sku: 'a', quantity: 1, unitPrice: 1 }], extra: null }), ['extra: unknown field']);
});
