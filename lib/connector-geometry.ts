/** The entire connector is a single Fabric path (including its arrowhead). */
export type XY = { x: number; y: number };
export type Bounds = { left: number; top: number; width: number; height: number };
export type ConnectorRoute = 'straight' | 'elbow';
export type ConnectorMeta = {
  fromId?: string;
  toId?: string;
  from: XY;
  to: XY;
  route: ConnectorRoute;
};

/** Clip the line to the edge of a shape, instead of running through its centre. */
export function edgeAnchor(bounds: Bounds, toward: XY): XY {
  const centerX = bounds.left + bounds.width / 2;
  const centerY = bounds.top + bounds.height / 2;
  const deltaX = toward.x - centerX;
  const deltaY = toward.y - centerY;
  const ratio = Math.max(
    Math.abs(deltaX) / Math.max(1, bounds.width / 2),
    Math.abs(deltaY) / Math.max(1, bounds.height / 2),
    0.00001,
  );
  return { x: centerX + deltaX / ratio, y: centerY + deltaY / ratio };
}

export function connectorPath(from: XY, to: XY, route: ConnectorRoute): string {
  const bend: XY[] = route === 'elbow' && Math.abs(from.x - to.x) > 16
    ? [{ x: (from.x + to.x) / 2, y: from.y },
      { x: (from.x + to.x) / 2, y: to.y }]
    : [];
  const points = [from, ...bend, to];
  const before = points[points.length - 2];
  const angle = Math.atan2(to.y - before.y, to.x - before.x);
  const left = angle + Math.PI * 0.83;
  const right = angle - Math.PI * 0.83;
  const wing = 12;
  const n = (value: number) => Number(value.toFixed(2));
  const line = points.map((point, i) =>
    `${i === 0 ? 'M' : 'L'} ${n(point.x)} ${n(point.y)}`).join(' ');
  return [
    line,
    `M ${n(to.x + Math.cos(left) * wing)} ${n(to.y + Math.sin(left) * wing)}`,
    `L ${n(to.x)} ${n(to.y)}`,
    `L ${n(to.x + Math.cos(right) * wing)} ${n(to.y + Math.sin(right) * wing)}`,
  ].join(' ');
}
