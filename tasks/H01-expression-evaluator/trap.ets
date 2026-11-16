export interface Token {
  kind: 'number' | 'name' | 'operator' | 'paren';
  text: string;
  position: number;
}

export class ExpressionError extends Error {
  readonly position: number;

  constructor(message: string, position: number) {
    super(message);
    this.name = 'ExpressionError';
    this.position = position;
  }
}

type Node =
  | { type: 'number'; value: number }
  | { type: 'name'; name: string; position: number }
  | { type: 'negate'; operand: Node }
  | { type: 'binary'; operator: string; position: number; left: Node; right: Node };

function* scan(source: string): Generator<Token> {
  const pattern = /(\d+(?:\.\d+)?)|([A-Za-z_][A-Za-z0-9_]*)|([-+*/%])|[()]/y;
  let position = 0;
  while (position < source.length) {
    if (source[position] === ' ') {
      position++;
      continue;
    }
    pattern.lastIndex = position;
    const match = pattern.exec(source);
    if (!match) {
      throw new ExpressionError(`Unexpected character '${source[position]}'`, position);
    }
    const [text, number, name, operator] = match;
    yield { kind: number ? 'number' : name ? 'name' : operator ? 'operator' : 'paren', text, position };
    position += text.length;
  }
}

export function tokenize(source: string): Token[] {
  return [...scan(source)];
}

function parse(source: string): Node {
  const tokens = tokenize(source);
  let index = 0;

  function unexpected(): ExpressionError {
    const token = tokens[index];
    return token
      ? new ExpressionError(`Unexpected token '${token.text}'`, token.position)
      : new ExpressionError('Unexpected end of expression', source.length);
  }

  function atOperator(operators: string): boolean {
    const token = tokens[index];
    return token?.kind === 'operator' && operators.includes(token.text);
  }

  function parseBinary(operators: string, parseOperand: () => Node): Node {
    let left = parseOperand();
    while (atOperator(operators)) {
      const { text: operator, position } = tokens[index++];
      left = { type: 'binary', operator, position, left, right: parseOperand() };
    }
    return left;
  }

  function parseSum(): Node {
    return parseBinary('+-', parseProduct);
  }

  function parseProduct(): Node {
    return parseBinary('*/%', parseUnary);
  }

  function parseUnary(): Node {
    if (atOperator('-')) {
      index++;
      return { type: 'negate', operand: parseUnary() };
    }
    return parsePrimary();
  }

  function parsePrimary(): Node {
    const token = tokens[index];
    if (token?.kind === 'number') {
      index++;
      return { type: 'number', value: Number(token.text) };
    }
    if (token?.kind === 'name') {
      index++;
      return { type: 'name', name: token.text, position: token.position };
    }
    if (token?.text === '(') {
      index++;
      const inner = parseSum();
      if (tokens[index]?.text !== ')') {
        throw unexpected();
      }
      index++;
      return inner;
    }
    throw unexpected();
  }

  const tree = parseSum();
  if (index < tokens.length) {
    throw unexpected();
  }
  return tree;
}

function compute(node: Node, variables: Record<string, number>): number {
  switch (node.type) {
    case 'number':
      return node.value;
    case 'name':
      if (!(node.name in variables)) {
        throw new ExpressionError(`Unknown variable '${node.name}'`, node.position);
      }
      return variables[node.name];
    case 'negate':
      return -compute(node.operand, variables);
    case 'binary': {
      const left = compute(node.left, variables);
      const right = compute(node.right, variables);
      switch (node.operator) {
        case '+':
          return left + right;
        case '-':
          return left - right;
        case '*':
          return left * right;
      }
      if (right === 0) {
        throw new ExpressionError('Division by zero', node.position);
      }
      return node.operator === '/' ? left / right : left % right;
    }
  }
}

export function evaluate(source: string, variables: Record<string, number>): number {
  return compute(parse(source), variables);
}
