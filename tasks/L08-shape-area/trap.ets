interface Circle {
  radius: number;
}

interface Rectangle {
  width: number;
  height: number;
}

interface Triangle {
  base: number;
  height: number;
}

export type Shape = Circle | Rectangle | Triangle;

function isCircle(shape: Shape): shape is Circle {
  return 'radius' in shape;
}

function isRectangle(shape: Shape): shape is Rectangle {
  return 'width' in shape;
}

export function circle(radius: number): Shape {
  return { radius };
}

export function rectangle(width: number, height: number): Shape {
  return { width, height };
}

export function triangle(base: number, height: number): Shape {
  return { base, height };
}

export function area(shape: Shape): number {
  if (isCircle(shape)) {
    return Math.PI * shape.radius ** 2;
  }
  if (isRectangle(shape)) {
    return shape.width * shape.height;
  }
  return (shape.base * shape.height) / 2;
}

export function totalArea(shapes: Shape[]): number {
  return shapes.reduce((sum, shape) => sum + area(shape), 0);
}
