import { Canvas, Path, FabricImage, FabricObject } from 'fabric';
import { type MeshColors } from '@/lib/mesh-fill';
import { type ComponentMeta } from '@/lib/prototype-layout';
import { continuousPath, type PenNode } from '@/lib/advanced-vector';
import { validBlendMode, type BlendMode } from '@/lib/raster-paint';
import { type RoomTool } from '@/components/editor/RoomToolRail';
import { type Template } from '@/lib/boards';
import { quadraticPath, type CurveNode } from '@/lib/art-strokes';
import { type ConnectorMeta } from '@/lib/connector-geometry';

export type Tool = RoomTool;

export type Obj = FabricObject & {
  id?: string;
  connector?: ConnectorMeta;
  vectorNodes?: CurveNode[];
  penNodes?: PenNode[];
  penClosed?: boolean;
  deviceFrame?: string;
  component?: ComponentMeta;
  _requiresMemberMigration?: boolean;
  curveClosed?: boolean;
  rasterLayer?: { name: string; blend: BlendMode };
  stickerId?: string;
  meshColors?: MeshColors;
  offsetBasePolygons?: import('@/lib/vector-booleans').MultiPolygon;
  offsetDistance?: number;
};

// Persist our extended Fabric object metadata across save/load and collaboration.
FabricObject.customProperties = [
  'id', 'connector', 'vectorNodes', 'curveClosed', 'penNodes', 'penClosed',
  'deviceFrame', 'rasterLayer', 'stickerId', 'component', 'meshColors',
  'offsetBasePolygons', 'offsetDistance',
];

export const isRasterLayer = (object: Obj): object is Obj & FabricImage & {
  rasterLayer: { name: string; blend: BlendMode };
} => Boolean(object.rasterLayer && object.type === 'image');

export type RemoteOperation = {
  sender: string;
  kind: 'add' | 'modify' | 'modify-member' | 'remove' | 'clear' | 'replace';
  object?: Record<string, unknown>;
  id?: string;
  state?: Record<string, unknown>;
  revision?: number;
};

export type Cursor = { x: number; y: number; color: string; name: string; lastSeen: number };

export const COLORS = ['#292923', '#e75436', '#edb942', '#7d9f85', '#7577b3', '#ffffff'];

export const CURSOR_COLORS = ['#e75436', '#6d8e77', '#9470b8', '#ad824c', '#456d9d'];

export const REACTIONS = ['❤️', '✨', '👏', '💡'] as const;

export const MAX_HISTORY = 35;

export const LOCAL_PREFIX = 'sketchtogether:canvas:';

export const PENDING_PREFIX = 'sketchtogether:pending:';

export function validTemplate(input: string | null): Template {
  return input === 'brainstorm' || input === 'flow' || input === 'retro'
    ? input
    : 'blank';
}

export function ensureId(obj: Obj) { if (!obj.id) obj.id = crypto.randomUUID(); return obj.id; }

export function snapshot(canvas: Canvas) {
  canvas.getObjects().forEach((object) => ensureId(object as Obj));
  return JSON.stringify(canvas.toJSON());
}

export function serialize(obj: Obj): Record<string, unknown> {
  ensureId(obj);
  return obj.toObject(FabricObject.customProperties) as Record<string, unknown>;
}

export function curveObject(nodes: CurveNode[], source: Obj): Obj {
  const path = new Path(quadraticPath(nodes) + (source.curveClosed ? ' Z' : ''), {
    fill: source.curveClosed ? (source.fill || '#e7b65f') : '',
    stroke: source.stroke || '#292923',
    strokeWidth: source.strokeWidth || 3,
    opacity: source.opacity,
    strokeLineCap: 'round',
    strokeLineJoin: 'round',
    objectCaching: false,
  }) as Obj;
  path.id = ensureId(source);
  path.vectorNodes = nodes.map((node) => ({ ...node }));
  path.curveClosed = Boolean(source.curveClosed);
  return path;
}

export function penObject(nodes: PenNode[], source?: Obj, closed = false): Obj {
  const path = new Path(continuousPath(nodes, closed), {
    fill: closed ? (source?.fill || '#f6d478') : '',
    stroke: source?.stroke || '#292923',
    strokeWidth: source?.strokeWidth || 3,
    opacity: source?.opacity ?? 1,
    strokeLineCap: 'round',
    strokeLineJoin: 'round',
    objectCaching: false,
  }) as Obj;
  path.id = source ? ensureId(source) : crypto.randomUUID();
  path.penNodes = nodes.map((node) => ({ ...node }));
  path.penClosed = closed;
  return path;
}

export function restorePaintCompositing(canvas: Canvas) {
  (canvas.getObjects() as Obj[]).forEach((object) => {
    if (!isRasterLayer(object)) return;
    const blend = validBlendMode(object.rasterLayer.blend)
      ? object.rasterLayer.blend : 'source-over';
    object.set({
      globalCompositeOperation: blend,
      selectable: false,
      evented: false,
    });
  });
}

export function saveBlob(content: BlobPart, type: string, name: string) {
  const href = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement('a'); link.href = href; link.download = name; link.click();
  setTimeout(() => URL.revokeObjectURL(href), 1000);
}
