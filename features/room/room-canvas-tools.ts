'use client';
import type { Obj } from './room-model';
import { useCallback } from 'react';
import { Canvas, Path, Group, FabricImage, FabricObject, Point } from 'fabric';
import { booleanPath, objectPolygons, multipolygonToPath } from '@/lib/vector-booleans';
import { dividePolygons, offsetPolygons, cutPolyline, openPolylinePath, combinePaths } from '@/lib/path-workshop';
import { type ShapeBoolean } from '@/lib/advanced-vector';
import { isRasterLayer, ensureId, restorePaintCompositing } from './room-model';
import type { useRoomBase } from './room-base';
import type { useRoomSync } from './room-sync';
import type { useRoomDrawing } from './room-drawing';
export function useRoomCanvasTools(scope: ReturnType<typeof import('./room-base').useRoomBase> &
  ReturnType<typeof import('./room-sync').useRoomSync> &
  ReturnType<typeof import('./room-drawing').useRoomDrawing>) {
  const {
    canvasRef,
    ready,
    historyRef,
    silentRef,
    rerouteAllRef,
    changeTool,
    toolRef,
    commitReplacement,
    persist,
    updateHistoryUI,
    refreshLayers,
    notify,
    setViewportTick,
    setZoom,
    recordHistory,
    activePaintIdRef,
    setActivePaintId,
    setPanelTab,
    fillRef,
    colorRef,
    color,
    strokeRef,
  } = scope;
  const restoreHistory = useCallback(async (direction: 'undo' | 'redo') => {
      const canvas = canvasRef.current;
      if (!canvas || !ready) return;
      const history = historyRef.current;
      let target: string | undefined;
      if (direction === 'undo' && history.past.length > 1) {
        history.future.push(history.past.pop()!);
        target = history.past[history.past.length - 1];
      } else if (direction === 'redo' && history.future.length) {
        target = history.future.pop();
        if (target) history.past.push(target);
      }
      if (!target) return;
      silentRef.current = true;
      try {
        await canvas.loadFromJSON(JSON.parse(target));
        restorePaintCompositing(canvas);
        canvas.backgroundColor = 'transparent';
        rerouteAllRef.current?.();
        canvas.requestRenderAll();
        changeTool(toolRef.current);
        commitReplacement(canvas);
        persist(canvas);
        updateHistoryUI();
        refreshLayers(canvas);
      } catch { notify('Could not restore the previous edit.'); }
      finally { silentRef.current = false; }
    }, [ready, changeTool, persist, commitReplacement, notify, updateHistoryUI, refreshLayers]);
  
  const zoomTo = useCallback((percentage: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const target = Math.max(25, Math.min(300, percentage));
      canvas.zoomToPoint(new Point(canvas.getWidth() / 2, canvas.getHeight() / 2), target / 100);
      canvas.requestRenderAll();
      setViewportTick((previous) => previous + 1);
      setZoom(target);
    }, []);
  
  const resetView = useCallback(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
      canvas.requestRenderAll();
      setViewportTick((previous) => previous + 1);
      setZoom(100);
    }, []);
  
  const fitToDrawing = useCallback(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const visible = canvas.getObjects().filter((obj) => obj.visible !== false);
      if (visible.length === 0) {
        resetView();
        return;
      }
      const boxes = visible.map((obj) => obj.getBoundingRect());
      const left = Math.min(...boxes.map((box) => box.left));
      const top = Math.min(...boxes.map((box) => box.top));
      const right = Math.max(...boxes.map((box) => box.left + box.width));
      const bottom = Math.max(...boxes.map((box) => box.top + box.height));
      const spanX = Math.max(100, right - left);
      const spanY = Math.max(100, bottom - top);
      const scale = Math.min(2.5, Math.max(0.25, Math.min(
        Math.max(100, canvas.width - Math.min(230, canvas.width * 0.25)) / spanX,
        Math.max(100, canvas.height - Math.min(160, canvas.height * 0.25)) / spanY,
      )));
      const centerX = (left + right) / 2;
      const centerY = (top + bottom) / 2;
      canvas.setViewportTransform([
        scale, 0, 0, scale,
        canvas.width / 2 - centerX * scale,
        canvas.height / 2 - centerY * scale,
      ]);
      canvas.requestRenderAll();
      setViewportTick((previous) => previous + 1);
      setZoom(Math.round(scale * 100));
    }, [resetView]);
  
  const commitWholeBoard = useCallback((canvas: Canvas) => {
      canvas.requestRenderAll();
      recordHistory(canvas);
      persist(canvas);
      commitReplacement(canvas);
    }, [recordHistory, persist, commitReplacement]);
  
  const focusLayer = useCallback((id: string) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const object = canvas.getObjects().find((obj) => (obj as Obj).id === id);
      if (!object) return;
      const wasHidden = object.visible === false;
      if (wasHidden) object.set('visible', true);
      if (isRasterLayer(object as Obj)) {
        activePaintIdRef.current = id;
        setActivePaintId(id);
        setPanelTab('paint');
        changeTool('raster-paint');
      } else {
        changeTool('select');
        canvas.setActiveObject(object);
      }
      canvas.requestRenderAll();
      if (wasHidden) commitWholeBoard(canvas);
      else refreshLayers(canvas);
    }, [changeTool, refreshLayers, commitWholeBoard]);
  
  const moveLayer = useCallback((id: string, direction: 'up' | 'down') => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const objects = canvas.getObjects();
      const index = objects.findIndex((obj) => (obj as Obj).id === id);
      const destination = index + (direction === 'up' ? 1 : -1);
      if (index < 0 || destination < 0 || destination >= objects.length) return;
      canvas.moveObjectTo(objects[index], destination);
      commitWholeBoard(canvas);
    }, [commitWholeBoard]);
  
  const toggleLayer = useCallback((id: string) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const object = canvas.getObjects().find((obj) => (obj as Obj).id === id);
      if (!object) return;
      object.set('visible', object.visible === false);
      canvas.discardActiveObject();
      commitWholeBoard(canvas);
    }, [commitWholeBoard]);
  
  const groupSelected = useCallback(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const objects = canvas.getActiveObjects() as Obj[];
      if (objects.length < 2) {
        notify('Shift-click two or more objects before grouping.');
        return;
      }
      const ids = new Set(objects.map((object) => object.id));
      if ((canvas.getObjects() as Obj[]).some((object) =>
        object.connector && (ids.has(object.connector.fromId) ||
        ids.has(object.connector.toId)))) {
        notify('Remove attached smart connectors before grouping their endpoints.');
        return;
      }
      silentRef.current = true;
      try {
        canvas.discardActiveObject();
        objects.forEach((object) => ensureId(object));
        const group = new Group(objects, { objectCaching: false }) as Obj;
        ensureId(group);
        canvas.add(group);
        canvas.setActiveObject(group);
      } finally { silentRef.current = false; }
      commitWholeBoard(canvas);
      refreshLayers(canvas);
    }, [commitWholeBoard, notify, refreshLayers]);
  
  const ungroupSelected = useCallback(() => {
      const canvas = canvasRef.current;
      const active = canvas?.getActiveObject();
      if (!canvas || !(active instanceof Group) || active.type === 'activeselection') {
        notify('Select a grouped object first.');
        return;
      }
      silentRef.current = true;
      try {
        canvas.discardActiveObject();
        const members = active.removeAll();
        canvas.remove(active);
        members.forEach((member) => canvas.add(member));
      } finally { silentRef.current = false; }
      commitWholeBoard(canvas);
      refreshLayers(canvas);
    }, [commitWholeBoard, refreshLayers, notify]);
  
  const applyShapeBoolean = useCallback((operation: ShapeBoolean) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const objects = canvas.getActiveObjects();
      if (objects.length !== 2) {
        notify('Select two closed vector shapes before applying a boolean operation.');
        return;
      }
      let pathData: string;
      try {
        pathData = booleanPath(
          objectPolygons(objects[0]), objectPolygons(objects[1]), operation,
        );
      } catch (error) {
        notify(error instanceof Error ? error.message : 'Unsupported vector shape.');
        return;
      }
      if (!pathData) {
        notify('These shapes have no area remaining after that operation.');
        return;
      }
      const result = new Path(pathData, {
        fill: fillRef.current === 'transparent' ? colorRef.current : fillRef.current,
        fillRule: 'evenodd', stroke: '', objectCaching: false,
      }) as Obj;
      ensureId(result);
      silentRef.current = true;
      try {
        canvas.discardActiveObject();
        canvas.remove(...objects);
        canvas.add(result);
        canvas.setActiveObject(result);
      } finally { silentRef.current = false; }
      commitWholeBoard(canvas);
      refreshLayers(canvas);
    }, [commitWholeBoard, notify, refreshLayers]);
  
  const replaceVectorSelection = useCallback((
      originals: FabricObject[],
      paths: string[],
      filled = true,
    ) => {
      const canvas = canvasRef.current;
      if (!canvas || !paths.length) return;
      const color = fillRef.current === 'transparent'
        ? colorRef.current : fillRef.current;
      const replacements = paths.map((data) => {
        const result = new Path(data, {
          fill: filled ? color : '',
          fillRule: 'evenodd',
          stroke: filled ? '' : colorRef.current,
          strokeWidth: strokeRef.current,
          objectCaching: false,
        }) as Obj;
        ensureId(result);
        return result;
      });
      silentRef.current = true;
      try {
        canvas.discardActiveObject();
        canvas.remove(...originals);
        canvas.add(...replacements);
        canvas.setActiveObject(replacements[0]);
        canvas.requestRenderAll();
      } finally {
        silentRef.current = false;
      }
      commitWholeBoard(canvas);
      refreshLayers(canvas);
    }, [commitWholeBoard, refreshLayers]);
  
  const pathWorkshopAction = useCallback(async (
      action: 'division' | 'fracture' | 'cut' | 'combine' | 'break' | 'flatten',
    ) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const objects = canvas.getActiveObjects() as Obj[];
      if (!objects.length) {
        notify('Select the path or shapes to edit.');
        return;
      }
      if (action === 'flatten') {
        const bounds = objects.map((obj) => obj.getBoundingRect());
        const left = Math.floor(Math.min(...bounds.map((rect) => rect.left)) - 2);
        const top = Math.floor(Math.min(...bounds.map((rect) => rect.top)) - 2);
        const right = Math.ceil(Math.max(...bounds.map((rect) =>
          rect.left + rect.width)) + 2);
        const bottom = Math.ceil(Math.max(...bounds.map((rect) =>
          rect.top + rect.height)) + 2);
        const width = right - left;
        const height = bottom - top;
        if (width < 1 || height < 1 || width * height > 10_000_000) {
          notify('Selection is too large to flatten.');
          return;
        }
        const others = canvas.getObjects().filter((obj) => !objects.includes(obj as Obj));
        const previous = others.map((obj) => obj.visible);
        const background = canvas.backgroundColor;
        const viewport = canvas.viewportTransform;
        let png: string;
        try {
          others.forEach((obj) => obj.set('visible', false));
          canvas.backgroundColor = '';
          canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
          canvas.requestRenderAll();
          png = canvas.toDataURL({
            format: 'png', multiplier: 1, left, top, width, height,
          });
        } finally {
          others.forEach((obj, index) => obj.set('visible', previous[index]));
          canvas.backgroundColor = background;
          canvas.setViewportTransform(viewport);
          canvas.requestRenderAll();
        }
        try {
          const image = await FabricImage.fromURL(png);
          image.set({ left, top, objectCaching: false });
          ensureId(image as Obj);
          silentRef.current = true;
          try {
            canvas.discardActiveObject();
            canvas.remove(...objects);
            canvas.add(image);
            canvas.setActiveObject(image);
          } finally { silentRef.current = false; }
          commitWholeBoard(canvas);
          refreshLayers(canvas);
          notify('Selection flattened into a single raster image.');
        } catch {
          notify('Could not flatten this selection. The original artwork is unchanged.');
        }
        return;
      }
      try {
        if (action === 'break') {
          if (objects.length !== 1) throw new Error('Select one compound closed path.');
          const multi = objectPolygons(objects[0]);
          const paths = multi.flatMap((poly) => poly.map((ring) =>
            multipolygonToPath([[ring]])));
          if (paths.length < 2) throw new Error('This path has only one contour.');
          replaceVectorSelection(objects, paths);
          return;
        }
        if (action === 'combine') {
          if (objects.length < 2) throw new Error('Select two or more closed shapes.');
          const paths = objects.map((obj) => multipolygonToPath(objectPolygons(obj)));
          replaceVectorSelection(objects, [combinePaths(paths)]);
          return;
        }
        if (objects.length !== 2) throw new Error('Select two objects for this operation.');
        const cutter = objectPolygons(objects[1]);
        if (action === 'cut') {
          const source = objects[0];
          if (!source.penNodes || source.penClosed || source.penNodes.some((node) =>
            node.incoming || node.outgoing)) {
            throw new Error('Cut Path requires an open, straight-segment pen path first.');
          }
          const coordinates = source.penNodes.map((node) =>
            [node.x, node.y] as [number, number]);
          const parts = cutPolyline(coordinates, cutter);
          if (parts.length < 2) throw new Error('Cutter does not cross the open path.');
          // A cutter splits the path, but remains on the board.
          replaceVectorSelection([source], parts.map(openPolylinePath), false);
          return;
        }
        replaceVectorSelection(objects, dividePolygons(
          objectPolygons(objects[0]), cutter, action,
        ));
      } catch (error) {
        notify(error instanceof Error ? error.message : 'Cannot edit these paths.');
      }
    }, [commitWholeBoard, notify, refreshLayers, replaceVectorSelection]);
  
  const offsetSelected = useCallback((amount: number) => {
      const canvas = canvasRef.current;
      const selected = canvas?.getActiveObject() as Obj | undefined;
      if (!canvas || !selected) return;
      try {
        const original = selected.offsetBasePolygons || objectPolygons(selected);
        const data = offsetPolygons(original, amount);
        if (!data) throw new Error('No geometry remains at this offset.');
        const replacement = new Path(data, {
          fill: selected.fill || colorRef.current,
          stroke: selected.stroke || '',
          strokeWidth: selected.strokeWidth,
          fillRule: 'evenodd',
          objectCaching: false,
        }) as Obj;
        replacement.id = ensureId(selected);
        replacement.offsetBasePolygons = original;
        replacement.offsetDistance = amount;
        silentRef.current = true;
        try {
          canvas.discardActiveObject();
          canvas.remove(selected);
          canvas.add(replacement);
          canvas.setActiveObject(replacement);
        } finally { silentRef.current = false; }
        commitWholeBoard(canvas);
        refreshLayers(canvas);
      } catch (error) {
        notify(error instanceof Error ? error.message : 'Could not offset this shape.');
      }
    }, [notify, commitWholeBoard, refreshLayers]);
  return {
    restoreHistory,
    zoomTo,
    resetView,
    fitToDrawing,
    commitWholeBoard,
    focusLayer,
    moveLayer,
    toggleLayer,
    groupSelected,
    ungroupSelected,
    applyShapeBoolean,
    replaceVectorSelection,
    pathWorkshopAction,
    offsetSelected,
  };
}
