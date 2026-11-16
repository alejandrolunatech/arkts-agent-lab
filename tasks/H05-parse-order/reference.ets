export enum OrderStatus {
  Draft = 'draft',
  Paid = 'paid',
  Shipped = 'shipped',
}

export class OrderLine {
  sku: string;
  quantity: number;
  unitPrice: number;

  constructor(sku: string, quantity: number, unitPrice: number) {
    this.sku = sku;
    this.quantity = quantity;
    this.unitPrice = unitPrice;
  }

  total(): number {
    return this.quantity * this.unitPrice;
  }
}

export interface Order {
  id: string;
  status: OrderStatus;
  lines: OrderLine[];
}

export interface FieldError {
  path: string;
  message: string;
}

export interface ParseResult {
  order: Order | undefined;
  errors: FieldError[];
}

type JsonValue = Object | null | undefined;

type JsonRecord = Record<string, JsonValue>;

class Problems {
  list: FieldError[] = [];

  add(path: string, message: string): void {
    const problem: FieldError = { path: path, message: message };
    this.list.push(problem);
  }

  result(): ParseResult {
    const failed: ParseResult = { order: undefined, errors: this.list };
    return failed;
  }
}

function isMissing(value: JsonValue): boolean {
  return value === null || value === undefined;
}

function asRecord(value: JsonValue): JsonRecord | undefined {
  if (value === null || value === undefined || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }
  return value as JsonRecord;
}

function textOf(value: JsonValue, path: string, problems: Problems): string {
  if (isMissing(value)) {
    problems.add(path, 'required');
  } else if (typeof value !== 'string') {
    problems.add(path, 'expected a string');
  } else if (value.length === 0) {
    problems.add(path, 'must not be empty');
  } else {
    return value;
  }
  return '';
}

function numberOf(value: JsonValue, path: string, wholeFromOne: boolean, problems: Problems): number {
  if (isMissing(value)) {
    problems.add(path, 'required');
  } else if (typeof value !== 'number') {
    problems.add(path, 'expected a number');
  } else if (wholeFromOne && (!Number.isInteger(value) || value < 1)) {
    problems.add(path, 'must be a whole number of 1 or more');
  } else if (value < 0) {
    problems.add(path, 'must be 0 or more');
  } else {
    return value;
  }
  return 0;
}

function statusOf(value: JsonValue, problems: Problems): OrderStatus {
  if (value === 'paid') {
    return OrderStatus.Paid;
  }
  if (value === 'shipped') {
    return OrderStatus.Shipped;
  }
  if (!isMissing(value) && value !== 'draft') {
    problems.add('status', 'expected one of draft, paid, shipped');
  }
  return OrderStatus.Draft;
}

function reportUnknown(record: JsonRecord, known: string[], prefix: string, problems: Problems): void {
  for (const key of Object.keys(record)) {
    if (!known.includes(key)) {
      problems.add(prefix + key, 'unknown field');
    }
  }
}

function lineOf(value: JsonValue, path: string, problems: Problems): OrderLine {
  const record = asRecord(value);
  if (record === undefined) {
    problems.add(path, 'expected an object');
    return new OrderLine('', 0, 0);
  }
  const sku = textOf(record['sku'], `${path}.sku`, problems);
  const quantity = numberOf(record['quantity'], `${path}.quantity`, true, problems);
  const unitPrice = numberOf(record['unitPrice'], `${path}.unitPrice`, false, problems);
  reportUnknown(record, ['sku', 'quantity', 'unitPrice'], `${path}.`, problems);
  return new OrderLine(sku, quantity, unitPrice);
}

export function parseOrder(text: string): ParseResult {
  const problems = new Problems();
  let parsed: JsonValue = null;
  try {
    parsed = JSON.parse(text) as JsonValue;
  } catch (error) {
    problems.add('', 'invalid JSON');
    return problems.result();
  }
  const record = asRecord(parsed);
  if (record === undefined) {
    problems.add('', 'expected an object');
    return problems.result();
  }

  const id = textOf(record['id'], 'id', problems);
  const status = statusOf(record['status'], problems);
  const lines: OrderLine[] = [];
  const rawLines = record['lines'];
  if (isMissing(rawLines)) {
    problems.add('lines', 'required');
  } else if (!Array.isArray(rawLines)) {
    problems.add('lines', 'expected an array');
  } else {
    const items = rawLines as JsonValue[];
    if (items.length === 0) {
      problems.add('lines', 'must not be empty');
    }
    for (let i = 0; i < items.length; i++) {
      lines.push(lineOf(items[i], `lines[${i}]`, problems));
    }
  }
  reportUnknown(record, ['id', 'status', 'lines'], '', problems);

  if (problems.list.length > 0) {
    return problems.result();
  }
  const order: Order = { id: id, status: status, lines: lines };
  const done: ParseResult = { order: order, errors: [] };
  return done;
}
