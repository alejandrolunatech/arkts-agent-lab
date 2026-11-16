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

export function boundingBox(points: Point[]): Box | undefined {
  if (points.length === 0) {
    return undefined;
  }
  let minX = points[0].x;
  let minY = points[0].y;
  let maxX = minX;
  let maxY = minY;
  for (const point of points) {
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  }
  const min: Point = { x: minX, y: minY };
  const max: Point = { x: maxX, y: maxY };
  const box: Box = { min: min, max: max, width: maxX - minX, height: maxY - minY };
  return box;
}
