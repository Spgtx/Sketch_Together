'use client';
import { Rect, Ellipse, Line, Path, Triangle, Group, Textbox, FabricImage, Point, util } from 'fabric';
import { continuousPath, type PenNode, type VectorPoint } from '@/lib/advanced-vector';
import { bucketFill, copyPaintSurface, insidePaintArea, paintStroke, type PaintPoint } from '@/lib/raster-paint';
import { hexWithOpacity, pressureStrokePath, quadraticPath, type CurveNode, type StrokePoint } from '@/lib/art-strokes';
import { type ConnectorMeta, type XY } from '@/lib/connector-geometry';
import { isRasterLayer, ensureId, penObject } from './room-model';
import type { useRoomCanvasLifecycle } from './room-canvas-lifecycle';
import type { Canvas } from 'fabric';
import type { Obj, RemoteOperation } from './room-model';

type GestureScope = Parameters<typeof useRoomCanvasLifecycle>[0] & {
  canvas: Canvas;
  makeChange: (kind: RemoteOperation['kind'], object?: Obj) => void;
  clearPaintPreview: () => void;
  previewContext: CanvasRenderingContext2D | null;
  nodeForPoint: (point: XY) => Obj | undefined;
  pathFor: (meta: ConnectorMeta) => string;
};

export function installRoomGestures(context: GestureScope) {
  const {
    clientIdRef,
    silentRef,
    toolRef,
    gestureVersionsRef,
    cloudVersionsRef,
    notify,
    colorRef,
    strokeRef,
    opacityRef,
    fillRef,
    finishPenRef,
    cancelPenRef,
    snapScenePoint,
    activePaintIdRef,
    brushModeRef,
    changeTool,
    liveRoomRef,
    cursorThrottleRef,
    displayNameRef,
    setViewportTick,
    connectorRouteRef,
    setZoom,
    canvas,
    makeChange,
    clearPaintPreview,
    previewContext,
    nodeForPoint,
    pathFor,
  } = context;
  let drawingShape: Obj | null = null;

  let start: Point | null = null;

  let connectionPreview: Line | null = null;

  let connectionEnd: XY | null = null;

  let draggingPan = false;

  let middlePan = false;

  let pressurePoints: StrokePoint[] = [];

  let pressurePreview: Path | null = null;

  const updateRasterImage = (
          id: string,
          mutator: (surface: HTMLCanvasElement) => void,
        ) => {
          const layer = (canvas.getObjects() as Obj[]).find((object) =>
            object.id === id && isRasterLayer(object));
          if (!layer || layer.visible === false) return;
          try {
            const surface = copyPaintSurface((layer as FabricImage).getElement());
            mutator(surface);
            const updated = new FabricImage(surface, {
              left: 0, top: 0,
              selectable: false, evented: false,
              visible: layer.visible,
              opacity: layer.opacity,
              objectCaching: false,
              globalCompositeOperation: layer.rasterLayer?.blend || 'source-over',
            }) as Obj;
            updated.id = layer.id;
            updated.rasterLayer = layer.rasterLayer;
            const index = canvas.getObjects().indexOf(layer);
            silentRef.current = true;
            try {
              canvas.remove(layer);
              canvas.insertAt(index, updated);
            } finally {
              silentRef.current = false;
            }
            canvas.requestRenderAll();
            makeChange('modify', updated);
          } catch {
            notify('Pixel editing failed. Export your drawing before continuing.');
          }
        };

  let rasterPoints: PaintPoint[] = [];

  let rasterId: string | null = null;

  let rasterTool: 'raster-paint' | 'raster-erase' | null = null;

  let curvePoints: CurveNode[] = [];

  let curvePreview: Path | null = null;

  let penNodes: PenNode[] = [];

  let draggedPenIndex: number | null = null;

  const discardPenPreview = () => {
          const context = canvas.getTopContext();
          context.save();
          context.setTransform(1, 0, 0, 1, 0, 0);
          context.clearRect(0, 0, canvas.width, canvas.height);
          context.restore();
        };

  const previewPen = (candidate?: VectorPoint) => {
          discardPenPreview();
          if (!penNodes.length) return;
          const display = candidate ? [...penNodes, candidate] : [...penNodes];
          if (display.length < 2) return;
          const pathData = continuousPath(display);
          if (!pathData) return;
          const context = canvas.getTopContext();
          context.save();
          context.setTransform(...canvas.viewportTransform);
          context.strokeStyle = colorRef.current;
          context.lineWidth = strokeRef.current;
          context.globalAlpha = 0.7;
          context.setLineDash([5, 3]);
          context.stroke(new Path2D(pathData));
          context.restore();
        };

  const finishPen = (closed = false) => {
          discardPenPreview();
          if (penNodes.length > 1) {
            const object = penObject(penNodes, undefined, closed);
            object.set({ stroke: colorRef.current, strokeWidth: strokeRef.current,
              opacity: opacityRef.current, fill: closed ?
              (fillRef.current === 'transparent' ? '#f5d474' : fillRef.current) : '' });
            silentRef.current = true;
            canvas.add(object);
            silentRef.current = false;
            makeChange('add', object);
          }
          penNodes = [];
          canvas.requestRenderAll();
        };

  finishPenRef.current = () => finishPen();

  cancelPenRef.current = () => {
          discardPenPreview();
          penNodes = [];
          canvas.requestRenderAll();
        };

  let lastPressureFrame = 0;

  let lastPosition = { x: 0, y: 0 };

  const pointer = (e: MouseEvent | PointerEvent | TouchEvent) => canvas.getScenePoint(e);

  const onDown = ({ e }: { e: MouseEvent | PointerEvent | TouchEvent }) => {
          const mode = toolRef.current;
          const middleButton = 'button' in e && e.button === 1;
          if (mode === 'hand' || middleButton) {
            draggingPan = true;
            lastPosition = { x: 'clientX' in e ? e.clientX : 0, y: 'clientY' in e ? e.clientY : 0 };
            canvas.defaultCursor = 'grabbing'; return;
          }
          if (mode === 'vector-pen') {
            const raw = pointer(e);
            const point = snapScenePoint(raw);
            if (penNodes.length > 2 &&
              Math.hypot(point.x - penNodes[0].x, point.y - penNodes[0].y) <
              12 / canvas.getZoom()) {
              finishPen(true);
              return;
            }
            if ('detail' in e && e.detail >= 2) {
              finishPen();
              return;
            }
            if (penNodes.length >= 300) {
              finishPen();
              return;
            }
            const last = penNodes[penNodes.length - 1];
            if (last && Math.hypot(point.x - last.x, point.y - last.y) < 2) return;
            penNodes.push(point);
            draggedPenIndex = penNodes.length - 1;
            previewPen();
            return;
          }
          if (mode === 'raster-fill') {
            const position = pointer(e);
            const target = (canvas.getObjects() as Obj[]).find((object) =>
              object.id === activePaintIdRef.current && isRasterLayer(object));
            if (target && insidePaintArea(position)) {
              gestureVersionsRef.current[target.id!] = cloudVersionsRef.current[target.id!] ?? -1;
              updateRasterImage(target.id!, (surface) => {
                bucketFill(surface, position, colorRef.current, opacityRef.current);
              });
            }
            return;
          }
          if (mode === 'raster-paint' || mode === 'raster-erase') {
            const position = pointer(e);
            const target = (canvas.getObjects() as Obj[]).find((object) =>
              object.id === activePaintIdRef.current && isRasterLayer(object));
            if (!target || !insidePaintArea(position) || target.visible === false) {
              notify('Choose a visible paint layer and draw within its pixel area.');
              return;
            }
            rasterId = target.id!;
            rasterTool = mode;
            rasterPoints = [{ x: position.x, y: position.y }];
            gestureVersionsRef.current[rasterId] = cloudVersionsRef.current[rasterId] ?? -1;
            clearPaintPreview();
            return;
          }
          if (mode === 'eraser') {
            const point = pointer(e);
            const target = (canvas.getObjects() as Obj[]).slice().reverse().find((obj) =>
              obj.visible !== false && obj !== curvePreview &&
              obj !== pressurePreview && obj.containsPoint(new Point(point.x, point.y)));
            if (target) canvas.remove(target);
            return;
          }
          if (mode === 'pen' && brushModeRef.current === 'pressure') {
            const point = pointer(e);
            const source = e as PointerEvent;
            const pressure = source.pointerType === 'pen' ? source.pressure : 0.55;
            pressurePoints = [{ x: point.x, y: point.y, pressure }];
            return;
          }
          if (mode === 'curve') {
            const position = snapScenePoint(pointer(e));
            curvePoints.push({ x: position.x, y: position.y });
            if (curvePoints.length === 3) {
              const shouldFill = fillRef.current !== 'transparent';
              const shape = new Path(
                quadraticPath(curvePoints) + (shouldFill ? ' Z' : ''), {
                fill: shouldFill ? fillRef.current : '',
                stroke: colorRef.current,
                strokeWidth: strokeRef.current,
                opacity: opacityRef.current,
                strokeLineCap: 'round',
                strokeLineJoin: 'round',
                objectCaching: false,
              }) as Obj;
              shape.vectorNodes = curvePoints.map((p) => ({ ...p }));
              shape.curveClosed = shouldFill;
              ensureId(shape);
              silentRef.current = true;
              if (curvePreview) canvas.remove(curvePreview);
              canvas.add(shape);
              silentRef.current = false;
              makeChange('add', shape);
              curvePoints = [];
              curvePreview = null;
              canvas.requestRenderAll();
            }
            return;
          }
          if (mode === 'text' || mode === 'note') {
            const p = pointer(e);
            const isNote = mode === 'note';
            const obj = new Textbox(isNote ? 'Type your idea…' : 'Double-click to edit', {
              left: p.x, top: p.y, width: isNote ? 190 : 260, fontFamily: 'Arial',
              fontSize: isNote ? 19 : 26, fontWeight: isNote ? 'bold' : 'normal',
              fill: isNote ? '#292923' : colorRef.current,
              backgroundColor: isNote ? '#f7d78c' : undefined,
              padding: isNote ? 18 : 2,
              editable: true,
            });
            ensureId(obj as Obj);
            canvas.add(obj); canvas.requestRenderAll();
            changeTool('select'); canvas.setActiveObject(obj);
            obj.enterEditing(); obj.selectAll();
            return;
          }
          if (mode === 'connector') {
            start = pointer(e);
            connectionEnd = start;
            connectionPreview = new Line([start.x, start.y, start.x, start.y], {
              stroke: colorRef.current,
              strokeWidth: strokeRef.current,
              strokeDashArray: [7, 4],
              selectable: false,
              evented: false,
            });
            silentRef.current = true;
            canvas.add(connectionPreview);
            silentRef.current = false;
            return;
          }
          if (!['rectangle', 'ellipse', 'line', 'arrow'].includes(mode)) return;
          const snappedStart = snapScenePoint(pointer(e));
          start = new Point(snappedStart.x, snappedStart.y);
          const props = {
            left: start.x,
            top: start.y,
            stroke: colorRef.current,
            strokeWidth: strokeRef.current,
            fill: fillRef.current,
            opacity: opacityRef.current,
            selectable: false,
            evented: false,
          };
          if (mode === 'rectangle') drawingShape = new Rect({ ...props, width: 1, height: 1 }) as Obj;
          if (mode === 'ellipse') drawingShape = new Ellipse({ ...props, rx: 1, ry: 1 }) as Obj;
          if (mode === 'line' || mode === 'arrow') {
            drawingShape = new Line(
              [start.x, start.y, start.x, start.y],
              { ...props },
            ) as Obj;
          }
          if (drawingShape) {
            silentRef.current = true;
            canvas.add(drawingShape);
            silentRef.current = false;
          }
        };

  const onMove = ({ e }: { e: MouseEvent | PointerEvent | TouchEvent }) => {
          const now = Date.now();
          if (liveRoomRef.current && !document.hidden &&
            now - cursorThrottleRef.current > 150 && 'clientX' in e) {
            cursorThrottleRef.current = now;
            const point = pointer(e);
            void liveRoomRef.current?.send('cursor:move', {
              sender: clientIdRef.current,
              x: point.x,
              y: point.y,
              name: displayNameRef.current,
            });
          }
          if (draggingPan && !middlePan && 'clientX' in e) {
            canvas.relativePan(new Point(e.clientX - lastPosition.x, e.clientY - lastPosition.y));
            lastPosition = { x: e.clientX, y: e.clientY };
            canvas.requestRenderAll();
            if (canvas.getActiveObject()) setViewportTick((previous) => previous + 1);
            return;
          }
          if (toolRef.current === 'vector-pen') {
            const position = snapScenePoint(pointer(e));
            if (draggedPenIndex !== null && penNodes[draggedPenIndex]) {
              const anchor = penNodes[draggedPenIndex];
              if (Math.hypot(anchor.x - position.x, anchor.y - position.y) > 5) {
                anchor.outgoing = { ...position };
                anchor.incoming = {
                  x: anchor.x * 2 - position.x,
                  y: anchor.y * 2 - position.y,
                };
              }
              previewPen();
            } else if (penNodes.length) {
              previewPen(position);
            }
            return;
          }
          if (toolRef.current !== 'curve' && curvePreview) {
            silentRef.current = true;
            canvas.remove(curvePreview);
            silentRef.current = false;
            curvePreview = null;
            curvePoints = [];
          }
          if (toolRef.current === 'curve' && curvePoints.length) {
            const candidate = snapScenePoint(pointer(e));
            const nodes: CurveNode[] = curvePoints.length === 1
              ? [curvePoints[0], candidate, candidate]
              : [curvePoints[0], curvePoints[1], candidate];
            const pathData = quadraticPath(nodes);
            silentRef.current = true;
            if (curvePreview) canvas.remove(curvePreview);
            curvePreview = new Path(pathData, {
              stroke: colorRef.current,
              strokeWidth: strokeRef.current,
              fill: '',
              opacity: 0.55,
              selectable: false,
              evented: false,
              strokeDashArray: [5, 5],
            });
            canvas.add(curvePreview);
            silentRef.current = false;
            canvas.requestRenderAll();
            return;
          }
          if (rasterTool && rasterPoints.length) {
            const point = pointer(e);
            if (!insidePaintArea(point)) return;
            const last = rasterPoints[rasterPoints.length - 1];
            if (Math.hypot(point.x - last.x, point.y - last.y) < 0.7) return;
            rasterPoints.push({ x: point.x, y: point.y });
            if (previewContext) {
              const startOnScreen = util.transformPoint(new Point(last.x, last.y),
                canvas.viewportTransform);
              const endOnScreen = util.transformPoint(new Point(point.x, point.y),
                canvas.viewportTransform);
              previewContext.save();
              previewContext.lineCap = 'round';
              previewContext.lineJoin = 'round';
              previewContext.globalAlpha = rasterTool === 'raster-erase' ? 0.5 : opacityRef.current;
              previewContext.strokeStyle = rasterTool === 'raster-erase'
                ? '#e75436' : colorRef.current;
              previewContext.lineWidth = strokeRef.current * canvas.getZoom();
              previewContext.beginPath();
              previewContext.moveTo(startOnScreen.x, startOnScreen.y);
              previewContext.lineTo(endOnScreen.x, endOnScreen.y);
              previewContext.stroke();
              previewContext.restore();
            }
            return;
          }
          if (toolRef.current === 'eraser') {
            const point = pointer(e);
            const target = (canvas.getObjects() as Obj[]).slice().reverse().find((obj) =>
              obj.visible !== false && obj !== curvePreview &&
              obj !== pressurePreview && obj.containsPoint(new Point(point.x, point.y)));
            if (target && 'buttons' in e && e.buttons === 1) canvas.remove(target);
            return;
          }
          if (toolRef.current === 'pen' && brushModeRef.current === 'pressure' &&
            pressurePoints.length) {
            const point = pointer(e);
            const source = e as PointerEvent;
            const last = pressurePoints[pressurePoints.length - 1];
            if (Math.hypot(point.x - last.x, point.y - last.y) < 1) return;
            if (pressurePoints.length >= 3000) return;
            pressurePoints.push({
              x: point.x,
              y: point.y,
              pressure: source.pointerType === 'pen' ? source.pressure : 0.55,
            });
            if (now - lastPressureFrame > 25 && pressurePoints.length > 1) {
              lastPressureFrame = now;
              const nextPath = pressureStrokePath(pressurePoints, strokeRef.current * 2);
              if (nextPath) {
                silentRef.current = true;
                if (pressurePreview) canvas.remove(pressurePreview);
                pressurePreview = new Path(nextPath, {
                  fill: hexWithOpacity(colorRef.current, opacityRef.current),
                  stroke: '',
                  selectable: false,
                  evented: false,
                });
                canvas.add(pressurePreview);
                silentRef.current = false;
                canvas.requestRenderAll();
              }
            }
            return;
          }
          if (connectionPreview && start) {
            const nextPoint = pointer(e);
            connectionEnd = nextPoint;
            connectionPreview.set({ x2: nextPoint.x, y2: nextPoint.y });
            canvas.requestRenderAll();
            return;
          }
          if (!drawingShape || !start) return;
          const p = snapScenePoint(pointer(e));
          const w = p.x - start.x; const h = p.y - start.y;
          if (drawingShape.type === 'rect') {
            drawingShape.set({
              left: Math.min(p.x, start.x),
              top: Math.min(p.y, start.y),
              width: Math.max(1, Math.abs(w)),
              height: Math.max(1, Math.abs(h)),
            });
          }
          else if (drawingShape.type === 'ellipse') {
            drawingShape.set({
              left: Math.min(p.x, start.x),
              top: Math.min(p.y, start.y),
              rx: Math.max(1, Math.abs(w) / 2),
              ry: Math.max(1, Math.abs(h) / 2),
            });
          }
          else if (drawingShape.type === 'line') (drawingShape as Line).set({ x2: p.x, y2: p.y });
          drawingShape.setCoords(); canvas.requestRenderAll();
        };

  const onUp = () => {
          draggedPenIndex = null;
          if (rasterTool && rasterPoints.length && rasterId) {
            const points = rasterPoints;
            const erase = rasterTool === 'raster-erase';
            updateRasterImage(rasterId, (surface) => {
              paintStroke(surface, points, strokeRef.current,
                colorRef.current, opacityRef.current, erase);
            });
            rasterPoints = [];
            rasterId = null;
            rasterTool = null;
            clearPaintPreview();
            draggingPan = false;
            return;
          }
          draggingPan = false;
          if (toolRef.current === 'hand') canvas.defaultCursor = 'grab';
          if (pressurePoints.length) {
            const pathData = pressureStrokePath(pressurePoints, strokeRef.current * 2);
            silentRef.current = true;
            if (pressurePreview) canvas.remove(pressurePreview);
            pressurePreview = null;
            if (pathData) {
              const strokePath = new Path(pathData, {
                fill: hexWithOpacity(colorRef.current, opacityRef.current),
                stroke: '',
                objectCaching: false,
              }) as Obj;
              ensureId(strokePath);
              canvas.add(strokePath);
              silentRef.current = false;
              makeChange('add', strokePath);
            } else {
              silentRef.current = false;
            }
            pressurePoints = [];
            canvas.requestRenderAll();
            return;
          }
          if (connectionPreview && start) {
            silentRef.current = true;
            canvas.remove(connectionPreview);
            silentRef.current = false;
            const end = connectionEnd || start;
            if (Math.hypot(end.x - start.x, end.y - start.y) > 12) {
              const source = nodeForPoint(start);
              const destination = nodeForPoint(end);
              const meta: ConnectorMeta = {
                ...(source && { fromId: ensureId(source) }),
                ...(destination && { toId: ensureId(destination) }),
                from: start,
                to: end,
                route: connectorRouteRef.current,
              };
              const connector = new Path(pathFor(meta), {
                stroke: colorRef.current,
                strokeWidth: strokeRef.current,
                fill: '',
                objectCaching: false,
              }) as Obj;
              connector.connector = meta;
              ensureId(connector);
              silentRef.current = true;
              canvas.add(connector);
              silentRef.current = false;
              makeChange('add', connector);
            }
            connectionPreview = null;
            connectionEnd = null;
            start = null;
            canvas.requestRenderAll();
            return;
          }
          if (!drawingShape || !start) return;
          let obj = drawingShape;
          if (toolRef.current === 'arrow' && obj.type === 'line') {
            const line = obj as Line;
            const angle = Math.atan2(
              (line.y2 || 0) - (line.y1 || 0),
              (line.x2 || 0) - (line.x1 || 0),
            ) * 180 / Math.PI;
            const tip = new Triangle({
              left: line.x2,
              top: line.y2,
              width: 14,
              height: 16,
              originX: 'center',
              originY: 'center',
              angle: angle + 90,
              fill: colorRef.current,
              selectable: false,
              evented: false,
            });
            silentRef.current = true;
            canvas.remove(obj);
            obj = new Group([line, tip], { selectable: true }) as Obj;
            canvas.add(obj);
            silentRef.current = false;
          }
          ensureId(obj);
          obj.set({ selectable: toolRef.current === 'select', evented: toolRef.current === 'select' });
          canvas.requestRenderAll();
          makeChange('add', obj);
          drawingShape = null; start = null;
        };

  const upperCanvas = canvas.upperCanvasEl;

  const blockMiddle = (event: MouseEvent) => {
          if (event.button !== 1) return;
          event.preventDefault();
          // Fabric may be in free-drawing mode; handle middle panning outside its event gate.
          draggingPan = true;
          middlePan = true;
          lastPosition = { x: event.clientX, y: event.clientY };
          upperCanvas.style.cursor = 'grabbing';
        };

  const moveMiddle = (event: MouseEvent) => {
          if (!middlePan) return;
          const dx = event.clientX - lastPosition.x;
          const dy = event.clientY - lastPosition.y;
          canvas.relativePan(new Point(dx, dy));
          lastPosition = { x: event.clientX, y: event.clientY };
          setViewportTick((tick) => tick + 1);
        };

  const endMiddle = (event: MouseEvent) => {
          if (event.button !== 1) return;
          draggingPan = false;
          middlePan = false;
          upperCanvas.style.cursor = '';
        };

  const stopAutoScroll = (event: MouseEvent) => {
          if (event.button === 1) event.preventDefault();
        };

  const onWheel = (event: WheelEvent) => {
          // Ctrl-wheel must zoom only the board, never the browser toolbar or panels.
          if (!event.ctrlKey && !event.metaKey) return;
          event.preventDefault();
          const rect = upperCanvas.getBoundingClientRect();
          const x = event.clientX - rect.left;
          const y = event.clientY - rect.top;
          const next = Math.min(3, Math.max(0.2,
            canvas.getZoom() * Math.exp(-event.deltaY * 0.002)));
          canvas.zoomToPoint(new Point(x, y), next);
          setZoom(Math.round(next * 100));
          setViewportTick((tick) => tick + 1);
        };

  upperCanvas.addEventListener('mousedown', blockMiddle);

  upperCanvas.addEventListener('auxclick', stopAutoScroll);

  upperCanvas.addEventListener('wheel', onWheel, { passive: false });

  window.addEventListener('mousemove', moveMiddle);

  window.addEventListener('mouseup', endMiddle);

  canvas.on('mouse:down', onDown);

  canvas.on('mouse:move', onMove);

  canvas.on('mouse:up', onUp);
  return { upperCanvas, blockMiddle, stopAutoScroll, onWheel, moveMiddle, endMiddle };
}
