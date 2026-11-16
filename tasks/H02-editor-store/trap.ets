export interface EditorState {
  text: string;
  cursor: number;
  bold: boolean;
}

type Field = keyof EditorState;
type FieldValue = EditorState[Field];
type FieldListener = (value: FieldValue, previous: FieldValue) => void;

const FIELDS: Field[] = ['text', 'cursor', 'bold'];

export class EditorStore {
  private current: Readonly<EditorState>;
  private readonly historyLimit: number;
  private undoSteps: Readonly<EditorState>[] = [];
  private redoSteps: Readonly<EditorState>[] = [];
  private watchers: { field: Field; listener: FieldListener }[] = [];

  constructor(initial: EditorState, historyLimit: number) {
    this.current = Object.freeze({ ...initial });
    this.historyLimit = historyLimit;
  }

  get state(): EditorState {
    return { ...this.current };
  }

  get canUndo(): boolean {
    return this.undoSteps.length > 0;
  }

  get canRedo(): boolean {
    return this.redoSteps.length > 0;
  }

  apply(patch: Partial<EditorState>): boolean {
    const defined = Object.fromEntries(Object.entries(patch).filter(([, value]) => value !== undefined));
    const next: EditorState = { ...this.current, ...defined };
    if (FIELDS.every((field) => next[field] === this.current[field])) {
      return false;
    }
    this.undoSteps = [...this.undoSteps, this.current].slice(-this.historyLimit);
    this.redoSteps = [];
    this.moveTo(next);
    return true;
  }

  transaction(run: (draft: EditorState) => void): boolean {
    const draft = { ...this.current };
    run(draft);
    return this.apply(draft);
  }

  undo(): boolean {
    const previous = this.undoSteps.pop();
    if (!previous) {
      return false;
    }
    this.redoSteps.push(this.current);
    this.moveTo(previous);
    return true;
  }

  redo(): boolean {
    const next = this.redoSteps.pop();
    if (!next) {
      return false;
    }
    this.undoSteps.push(this.current);
    this.moveTo(next);
    return true;
  }

  watch(field: string, listener: FieldListener): () => void {
    const watcher = { field: field as Field, listener };
    this.watchers.push(watcher);
    return () => {
      this.watchers = this.watchers.filter((registered) => registered !== watcher);
    };
  }

  private moveTo(next: Readonly<EditorState>): void {
    const previous = this.current;
    this.current = Object.freeze({ ...next });
    for (const { field, listener } of [...this.watchers]) {
      if (next[field] !== previous[field]) {
        listener(next[field], previous[field]);
      }
    }
  }
}
