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

type JsonObject = Record<string, unknown>;
type Report = (path: string, message: string) => void;

const ORDER_FIELDS = ['id', 'status', 'lines'];
const LINE_FIELDS = ['sku', 'quantity', 'unitPrice'];

function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStatus(value: unknown): value is OrderStatus {
  return Object.values(OrderStatus).includes(value as OrderStatus);
}

/** The value of a field, with `null` and a missing key both read as `undefined`. */
function field(source: JsonObject, key: string): unknown {
  return key in source && source[key] !== null ? source[key] : undefined;
}

function readText(source: JsonObject, key: string, path: string, report: Report): string {
  const value = field(source, key);
  if (value === undefined) {
    report(path, 'required');
  } else if (typeof value !== 'string') {
    report(path, 'expected a string');
  } else if (value === '') {
    report(path, 'must not be empty');
  } else {
    return value;
  }
  return '';
}

function readNumber(source: JsonObject, key: string, path: string, report: Report): number | undefined {
  const value = field(source, key);
  if (value === undefined) {
    report(path, 'required');
  } else if (typeof value !== 'number') {
    report(path, 'expected a number');
  } else {
    return value;
  }
  return undefined;
}

function reportUnknown(source: JsonObject, known: string[], prefix: string, report: Report): void {
  for (const key in source) {
    if (!known.includes(key)) {
      report(prefix + key, 'unknown field');
    }
  }
}

function parseLine(value: unknown, path: string, report: Report): OrderLine {
  if (!isObject(value)) {
    report(path, 'expected an object');
    return new OrderLine('', 0, 0);
  }
  const sku = readText(value, 'sku', `${path}.sku`, report);
  const quantity = readNumber(value, 'quantity', `${path}.quantity`, report);
  if (quantity !== undefined && (!Number.isInteger(quantity) || quantity < 1)) {
    report(`${path}.quantity`, 'must be a whole number of 1 or more');
  }
  const unitPrice = readNumber(value, 'unitPrice', `${path}.unitPrice`, report);
  if (unitPrice !== undefined && unitPrice < 0) {
    report(`${path}.unitPrice`, 'must be 0 or more');
  }
  reportUnknown(value, LINE_FIELDS, `${path}.`, report);
  return new OrderLine(sku, quantity ?? 0, unitPrice ?? 0);
}

export function parseOrder(text: string): ParseResult {
  const errors: FieldError[] = [];
  const report: Report = (path, message) => errors.push({ path, message });

  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { order: undefined, errors: [{ path: '', message: 'invalid JSON' }] };
  }
  if (!isObject(raw)) {
    return { order: undefined, errors: [{ path: '', message: 'expected an object' }] };
  }

  const id = readText(raw, 'id', 'id', report);

  const status = field(raw, 'status') ?? OrderStatus.Draft;
  if (!isStatus(status)) {
    report('status', 'expected one of draft, paid, shipped');
  }

  const rawLines = field(raw, 'lines');
  let lines: OrderLine[] = [];
  if (rawLines === undefined) {
    report('lines', 'required');
  } else if (!Array.isArray(rawLines)) {
    report('lines', 'expected an array');
  } else if (rawLines.length === 0) {
    report('lines', 'must not be empty');
  } else {
    lines = rawLines.map((line, index) => parseLine(line, `lines[${index}]`, report));
  }

  reportUnknown(raw, ORDER_FIELDS, '', report);
  if (errors.length > 0) {
    return { order: undefined, errors };
  }
  return { order: { id, status: status as OrderStatus, lines }, errors };
}
