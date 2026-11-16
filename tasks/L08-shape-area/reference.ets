export interface Shape {
  area(): number;
}

class Circle implements Shape {
  private radius: number;

  constructor(radius: number) {
    this.radius = radius;
  }

  area(): number {
    return Math.PI * this.radius * this.radius;
  }
}

class Rectangle implements Shape {
  private width: number;
  private height: number;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
  }

  area(): number {
    return this.width * this.height;
  }
}

class Triangle implements Shape {
  private base: number;
  private height: number;

  constructor(base: number, height: number) {
    this.base = base;
    this.height = height;
  }

  area(): number {
    return (this.base * this.height) / 2;
  }
}

export function circle(radius: number): Shape {
  return new Circle(radius);
}

export function rectangle(width: number, height: number): Shape {
  return new Rectangle(width, height);
}

export function triangle(base: number, height: number): Shape {
  return new Triangle(base, height);
}

export function area(shape: Shape): number {
  return shape.area();
}

export function totalArea(shapes: Shape[]): number {
  let total = 0;
  for (const shape of shapes) {
    total += shape.area();
  }
  return total;
}
