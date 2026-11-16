export interface Point {
  x: number;
  y: number;
}

export interface Box {
  min: Point;
  max: Point;
  width: number;
  height: number;
}

function range(values: number[]): [number, number] {
  return [Math.min(...values), Math.max(...values)];
}

export function boundingBox(points: Point[]): Box | undefined {
  if (points.length === 0) {
    return undefined;
  }
  const [minX, maxX] = range(points.map(({ x }) => x));
  const [minY, maxY] = range(points.map(({ y }) => y));
  return {
    min: { x: minX, y: minY },
    max: { x: maxX, y: maxY },
    width: maxX - minX,
    height: maxY - minY,
  };
}
