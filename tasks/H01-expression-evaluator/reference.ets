export interface Token {
  kind: string;
  text: string;
  position: number;
}

export class ExpressionError extends Error {
  position: number;

  constructor(message: string, position: number) {
    super(message);
    this.name = 'ExpressionError';
    this.position = position;
  }
}

function isDigit(ch: string): boolean {
  return ch >= '0' && ch <= '9';
}

function isNamePart(ch: string): boolean {
  return (ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') || ch === '_' || isDigit(ch);
}

function endOfDigits(source: string, from: number): number {
  let index = from;
  while (isDigit(source.charAt(index))) {
    index++;
  }
  return index;
}

export function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  let index = 0;
  while (index < source.length) {
    const start = index;
    const ch = source.charAt(index);
    index++;
    let kind = 'paren';
    if (ch === ' ') {
      continue;
    } else if (isDigit(ch)) {
      kind = 'number';
      index = endOfDigits(source, index);
      if (source.charAt(index) === '.' && isDigit(source.charAt(index + 1))) {
        index = endOfDigits(source, index + 1);
      }
    } else if (isNamePart(ch)) {
      kind = 'name';
      while (isNamePart(source.charAt(index))) {
        index++;
      }
    } else if ('+-*/%'.includes(ch)) {
      kind = 'operator';
    } else if (ch !== '(' && ch !== ')') {
      throw new ExpressionError(`Unexpected character '${ch}'`, start);
    }
    const token: Token = { kind: kind, text: source.substring(start, index), position: start };
    tokens.push(token);
  }
  return tokens;
}

/** A number or a name (no operands), a negation (one operand) or a two-sided operator (two operands). */
class Expr {
  token: Token;
  operands: Expr[];

  constructor(token: Token, operands: Expr[]) {
    this.token = token;
    this.operands = operands;
  }
}

function compute(expr: Expr, variables: Record<string, number>): number {
  const token = expr.token;
  if (token.kind === 'number') {
    return Number(token.text);
  }
  if (token.kind === 'name') {
    if (!Object.keys(variables).includes(token.text)) {
      throw new ExpressionError(`Unknown variable '${token.text}'`, token.position);
    }
    return variables[token.text];
  }
  if (expr.operands.length === 1) {
    return -compute(expr.operands[0], variables);
  }
  const left = compute(expr.operands[0], variables);
  const right = compute(expr.operands[1], variables);
  if (token.text === '+') {
    return left + right;
  }
  if (token.text === '-') {
    return left - right;
  }
  if (token.text === '*') {
    return left * right;
  }
  if (right === 0) {
    throw new ExpressionError('Division by zero', token.position);
  }
  return token.text === '/' ? left / right : left % right;
}

class Parser {
  private tokens: Token[];
  private index: number = 0;
  private end: number;

  constructor(source: string) {
    this.tokens = tokenize(source);
    this.end = source.length;
  }

  parse(): Expr {
    const tree = this.binary('+-');
    if (this.index < this.tokens.length) {
      throw this.unexpected();
    }
    return tree;
  }

  private unexpected(): ExpressionError {
    if (this.index >= this.tokens.length) {
      return new ExpressionError('Unexpected end of expression', this.end);
    }
    const token = this.tokens[this.index];
    return new ExpressionError(`Unexpected token '${token.text}'`, token.position);
  }

  private kind(): string {
    return this.index < this.tokens.length ? this.tokens[this.index].kind : '';
  }

  private at(kind: string, texts: string): boolean {
    return this.kind() === kind && texts.includes(this.tokens[this.index].text);
  }

  /** A chain of `+ -` over chains of `* / %` over single operands, each chain from left to right. */
  private binary(operators: string): Expr {
    let left = operators === '+-' ? this.binary('*/%') : this.unary();
    while (this.at('operator', operators)) {
      const operator = this.tokens[this.index];
      this.index++;
      const right = operators === '+-' ? this.binary('*/%') : this.unary();
      left = new Expr(operator, [left, right]);
    }
    return left;
  }

  private unary(): Expr {
    if (this.at('operator', '-')) {
      const minus = this.tokens[this.index];
      this.index++;
      return new Expr(minus, [this.unary()]);
    }
    if (this.kind() === 'number' || this.kind() === 'name') {
      this.index++;
      return new Expr(this.tokens[this.index - 1], []);
    }
    if (!this.at('paren', '(')) {
      throw this.unexpected();
    }
    this.index++;
    const inner = this.binary('+-');
    if (!this.at('paren', ')')) {
      throw this.unexpected();
    }
    this.index++;
    return inner;
  }
}

export function evaluate(source: string, variables: Record<string, number>): number {
  return compute(new Parser(source).parse(), variables);
}
