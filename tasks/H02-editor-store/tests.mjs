import test from 'node:test';
import assert from 'node:assert/strict';
import { EditorStore } from './solution.mjs';

function start(limit = 10) {
  return new EditorStore({ text: 'hello', cursor: 0, bold: false }, limit);
}

/** The current state as a plain object, whatever the store returns. */
function read(store) {
  const state = store.state;
  return { text: state.text, cursor: state.cursor, bold: state.bold };
}

test('the store keeps its own copy of the state', () => {
  const initial = { text: 'hello', cursor: 0, bold: false };
  const store = new EditorStore(initial, 5);
  initial.text = 'changed outside';
  assert.deepEqual(read(store), { text: 'hello', cursor: 0, bold: false });

  const first = store.state;
  first.cursor = 99;
  assert.notEqual(store.state, first);
  assert.deepEqual(read(store), { text: 'hello', cursor: 0, bold: false });
  assert.equal(store.canUndo, false);
  assert.equal(store.canRedo, false);
});

test('apply replaces the fields a patch defines and reports whether anything changed', () => {
  const store = start();
  assert.equal(store.apply({ cursor: 3 }), true);
  assert.deepEqual(read(store), { text: 'hello', cursor: 3, bold: false });
  assert.equal(store.apply({ text: '', bold: true, cursor: undefined }), true);
  assert.deepEqual(read(store), { text: '', cursor: 3, bold: true });

  assert.equal(store.apply({ cursor: 3, bold: true }), false);
  assert.equal(store.apply({}), false);
  assert.equal(store.apply({ text: undefined }), false);
  assert.deepEqual(read(store), { text: '', cursor: 3, bold: true });

  assert.equal(store.undo(), true);
  assert.equal(store.undo(), true);
  assert.equal(store.undo(), false);
  assert.deepEqual(read(store), { text: 'hello', cursor: 0, bold: false });
});

test('undo and redo walk through the steps, and a new step forgets what could be redone', () => {
  const store = start();
  store.apply({ text: 'a' });
  store.apply({ text: 'ab', cursor: 2 });
  store.apply({ bold: true });
  assert.equal(store.redo(), false);

  assert.equal(store.undo(), true);
  assert.deepEqual(read(store), { text: 'ab', cursor: 2, bold: false });
  assert.equal(store.undo(), true);
  assert.deepEqual(read(store), { text: 'a', cursor: 0, bold: false });
  assert.equal(store.canUndo, true);
  assert.equal(store.canRedo, true);

  assert.equal(store.redo(), true);
  assert.deepEqual(read(store), { text: 'ab', cursor: 2, bold: false });

  assert.equal(store.apply({ cursor: 1 }), true);
  assert.equal(store.canRedo, false);
  assert.equal(store.redo(), false);
  assert.deepEqual(read(store), { text: 'ab', cursor: 1, bold: false });
  assert.equal(store.undo(), true);
  assert.deepEqual(read(store), { text: 'ab', cursor: 2, bold: false });
});

test('only the last historyLimit steps can be undone', () => {
  const store = start(2);
  store.apply({ cursor: 1 });
  store.apply({ cursor: 2 });
  store.apply({ cursor: 3 });
  assert.equal(store.undo(), true);
  assert.equal(store.undo(), true);
  assert.equal(store.undo(), false);
  assert.equal(store.state.cursor, 1);
  assert.equal(store.redo(), true);
  assert.equal(store.redo(), true);
  assert.equal(store.redo(), false);
  assert.equal(store.state.cursor, 3);
});

test('watch reports changes of one field, in order of registration, until it is removed', () => {
  const store = start();
  const calls = [];
  const stopText = store.watch('text', (value, previous) => calls.push(['text', value, previous, store.state.text]));
  store.watch('bold', (value, previous) => calls.push(['bold', value, previous]));
  store.watch('text', (value, previous) => calls.push(['text again', value, previous]));
  store.watch('cursor', (value, previous) => calls.push(['cursor', value, previous]));

  store.apply({ text: 'hi', bold: true });
  assert.deepEqual(calls, [
    ['text', 'hi', 'hello', 'hi'],
    ['bold', true, false],
    ['text again', 'hi', 'hello'],
  ]);

  calls.length = 0;
  store.apply({ text: 'hi' });
  store.apply({ cursor: 2 });
  store.undo();
  store.undo();
  store.redo();
  assert.deepEqual(calls, [
    ['cursor', 2, 0],
    ['cursor', 0, 2],
    ['text', 'hello', 'hi', 'hello'],
    ['bold', false, true],
    ['text again', 'hello', 'hi'],
    ['text', 'hi', 'hello', 'hi'],
    ['bold', true, false],
    ['text again', 'hi', 'hello'],
  ]);

  calls.length = 0;
  stopText();
  stopText();
  store.apply({ text: 'bye' });
  assert.deepEqual(calls, [['text again', 'bye', 'hi']]);
});

test('a transaction is one step, and a failing one changes nothing', () => {
  const store = start();
  const seen = [];
  store.watch('cursor', (value, previous) => seen.push([value, previous]));

  const changed = store.transaction((draft) => {
    draft.text = draft.text + ' world';
    draft.cursor = 5;
    draft.cursor = draft.text.length;
  });
  assert.equal(changed, true);
  assert.deepEqual(read(store), { text: 'hello world', cursor: 11, bold: false });
  assert.deepEqual(seen, [[11, 0]]);

  assert.equal(store.transaction((draft) => {
    draft.bold = !draft.bold;
    draft.bold = !draft.bold;
  }), false);
  assert.equal(store.transaction(() => {}), false);

  const failure = new Error('stop');
  assert.throws(() => store.transaction((draft) => {
    draft.text = 'half done';
    throw failure;
  }), (error) => error === failure);
  assert.deepEqual(read(store), { text: 'hello world', cursor: 11, bold: false });

  assert.equal(store.undo(), true);
  assert.equal(store.undo(), false);
  assert.deepEqual(read(store), { text: 'hello', cursor: 0, bold: false });
});
