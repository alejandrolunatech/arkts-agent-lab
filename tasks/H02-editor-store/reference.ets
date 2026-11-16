export interface EditorState {
  text: string;
  cursor: number;
  bold: boolean;
}

type FieldValue = string | number | boolean;

type FieldListener = (value: FieldValue, previous: FieldValue) => void;

class Watcher {
  field: string;
  listener: FieldListener;

  constructor(field: string, listener: FieldListener) {
    this.field = field;
    this.listener = listener;
  }
}

function copyOf(source: EditorState): EditorState {
  const copy: EditorState = { text: source.text, cursor: source.cursor, bold: source.bold };
  return copy;
}

function sameState(a: EditorState, b: EditorState): boolean {
  return a.text === b.text && a.cursor === b.cursor && a.bold === b.bold;
}

function fieldOf(state: EditorState, field: string): FieldValue {
  if (field === 'text') {
    return state.text;
  }
  if (field === 'cursor') {
    return state.cursor;
  }
  return state.bold;
}

export class EditorStore {
  private current: EditorState;
  private historyLimit: number;
  private undoSteps: EditorState[] = [];
  private redoSteps: EditorState[] = [];
  private watchers: Watcher[] = [];

  constructor(initial: EditorState, historyLimit: number) {
    this.current = copyOf(initial);
    this.historyLimit = historyLimit;
  }

  get state(): EditorState {
    return copyOf(this.current);
  }

  get canUndo(): boolean {
    return this.undoSteps.length > 0;
  }

  get canRedo(): boolean {
    return this.redoSteps.length > 0;
  }

  apply(patch: Partial<EditorState>): boolean {
    const next = copyOf(this.current);
    if (patch.text !== undefined) {
      next.text = patch.text;
    }
    if (patch.cursor !== undefined) {
      next.cursor = patch.cursor;
    }
    if (patch.bold !== undefined) {
      next.bold = patch.bold;
    }
    if (sameState(next, this.current)) {
      return false;
    }
    this.undoSteps.push(this.current);
    if (this.undoSteps.length > this.historyLimit) {
      this.undoSteps.shift();
    }
    this.redoSteps = [];
    this.moveTo(next);
    return true;
  }

  transaction(run: (draft: EditorState) => void): boolean {
    const draft = copyOf(this.current);
    run(draft);
    return this.apply(draft);
  }

  undo(): boolean {
    const previous = this.undoSteps.pop();
    if (previous === undefined) {
      return false;
    }
    this.redoSteps.push(this.current);
    this.moveTo(previous);
    return true;
  }

  redo(): boolean {
    const next = this.redoSteps.pop();
    if (next === undefined) {
      return false;
    }
    this.undoSteps.push(this.current);
    this.moveTo(next);
    return true;
  }

  watch(field: string, listener: FieldListener): () => void {
    const watcher = new Watcher(field, listener);
    this.watchers.push(watcher);
    return () => {
      const index = this.watchers.indexOf(watcher);
      if (index >= 0) {
        this.watchers.splice(index, 1);
      }
    };
  }

  private moveTo(next: EditorState): void {
    const previous = this.current;
    this.current = next;
    const watchers = this.watchers.slice();
    for (const watcher of watchers) {
      const value = fieldOf(next, watcher.field);
      const before = fieldOf(previous, watcher.field);
      if (value !== before) {
        watcher.listener(value, before);
      }
    }
  }
}
