'use client';
import type { Obj, Tool } from './room-model';
import { useCallback } from 'react';
import { Textbox, FabricImage } from 'fabric';
import type { TextStyle } from '@/components/editor/TextControls';
import { snapPosition, type PenNode, type VectorPoint } from '@/lib/advanced-vector';
import { createPaintSurface, MAX_PAINT_LAYERS, validBlendMode, type BlendMode } from '@/lib/raster-paint';
import { quadraticPath, type BrushPreset, type CurveNode } from '@/lib/art-strokes';
import { type ConnectorRoute } from '@/lib/connector-geometry';
import { isRasterLayer, ensureId, curveObject, penObject } from './room-model';
import type { useRoomBase } from './room-base';
import type { useRoomSync } from './room-sync';
export function useRoomDrawing(scope: ReturnType<typeof import('./room-base').useRoomBase> &
  ReturnType<typeof import('./room-sync').useRoomSync>) {
  const {
    connectorRouteRef,
    setConnectorRoute,
    brushModeRef,
    setBrushMode,
    canvasRef,
    updateBrush,
    toolRef,
    setTool,
    objectSnapRef,
    gridSnapRef,
    finishPenRef,
    refreshLayers,
    setSelectedText,
    commit,
    silentRef,
    setSelectedPenNodes,
    setColor,
    colorRef,
    setStroke,
    strokeRef,
    opacityRef,
    setOpacity,
    fillRef,
    setFill,
    setSelectedCurveNodes,
    rerouteAllRef,
    setSelectedCurveClosed,
    notify,
    activePaintIdRef,
    setActivePaintId,
    setPanelTab,
  } = scope;
  const changeConnectorRoute = useCallback((route: ConnectorRoute) => {
      connectorRouteRef.current = route;
      setConnectorRoute(route);
      changeTool('connector');
    // Tool selection is resolved after initial render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
  
  const changeBrushMode = useCallback((next: BrushPreset) => {
      brushModeRef.current = next;
      setBrushMode(next);
      const canvas = canvasRef.current;
      if (canvas) updateBrush(canvas);
      toolRef.current = 'pen';
      setTool('pen');
      if (!canvas) return;
      canvas.discardActiveObject();
      canvas.isDrawingMode = next !== 'pressure';
      canvas.selection = false;
      canvas.skipTargetFind = true;
      canvas.requestRenderAll();
    }, [updateBrush]);
  
  const snapScenePoint = useCallback((point: VectorPoint) => {
      const canvas = canvasRef.current;
      if (!canvas) return point;
      const anchors: VectorPoint[] = [];
      if (objectSnapRef.current) {
        for (const object of canvas.getObjects()) {
          if (!object.visible || (object as Obj).connector) continue;
          const box = object.getBoundingRect();
          anchors.push(
            { x: box.left, y: box.top },
            { x: box.left + box.width, y: box.top + box.height },
            { x: box.left + box.width / 2, y: box.top + box.height / 2 },
          );
        }
      }
      return snapPosition(point, gridSnapRef.current, 20, anchors,
        9 / Math.max(0.25, canvas.getZoom()));
    }, []);
  
  const changeTool = useCallback((next: Tool) => {
      if (toolRef.current === 'vector-pen' && next !== 'vector-pen') {
        finishPenRef.current?.();
      }
      toolRef.current = next;
      setTool(next);
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.discardActiveObject();
      canvas.isDrawingMode = next === 'pen' && brushModeRef.current !== 'pressure';
      canvas.selection = next === 'select' || next === 'node';
      canvas.skipTargetFind = next !== 'select' && next !== 'node';
      canvas.defaultCursor = next === 'hand' ? 'grab'
        : next === 'select' || next === 'node' ? 'default'
        : next === 'eraser' ? 'cell' : 'crosshair';
      canvas.forEachObject((obj) => {
        const raster = isRasterLayer(obj as Obj);
        obj.selectable = (next === 'select' || next === 'node') && !raster;
        obj.evented = (next === 'select' || next === 'node') && !raster;
      });
      canvas.requestRenderAll();
      refreshLayers(canvas);
    }, [refreshLayers]);
  
  const updateSelectedText = useCallback((changes: Partial<TextStyle>) => {
      const canvas = canvasRef.current;
      const active = canvas?.getActiveObject();
      if (!canvas || !(active instanceof Textbox)) return;
      if (changes.fontSize !== undefined &&
        (changes.fontSize < 6 || changes.fontSize > 300)) return;
      active.set(changes);
      active.setCoords();
      canvas.requestRenderAll();
      setSelectedText({
        fontFamily: active.fontFamily,
        fontSize: active.fontSize,
        fontWeight: active.fontWeight,
        fontStyle: active.fontStyle,
        underline: Boolean(active.underline),
        textAlign: active.textAlign,
        charSpacing: active.charSpacing,
        lineHeight: active.lineHeight,
        fill: typeof active.fill === 'string' ? active.fill : '#292923',
      });
      commit('modify', active as Obj);
    }, [commit]);
  
  const replacePenNodes = useCallback((nodes: PenNode[]) => {
      if (nodes.length < 2 || nodes.length > 300 || nodes.some((node) =>
        !Number.isFinite(node.x) || !Number.isFinite(node.y))) return;
      const canvas = canvasRef.current;
      const selected = canvas?.getActiveObject() as Obj | undefined;
      if (!canvas || !selected?.penNodes) return;
      const replacement = penObject(nodes, selected, selected.penClosed);
      const index = canvas.getObjects().indexOf(selected);
      if (index < 0) return;
      silentRef.current = true;
      try {
        canvas.discardActiveObject();
        canvas.remove(selected);
        canvas.insertAt(index, replacement);
        canvas.setActiveObject(replacement);
        canvas.requestRenderAll();
      } finally { silentRef.current = false; }
      setSelectedPenNodes(nodes);
      commit('modify', replacement);
    }, [commit]);
  
  const changeColor = useCallback((next: string) => {
      setColor(next); colorRef.current = next;
      const canvas = canvasRef.current;
      if (canvas) updateBrush(canvas);
      const active = canvas?.getActiveObject() as Obj | undefined;
      if (active && canvas) {
        if (active.type === 'textbox' || active.type === 'i-text') active.set('fill', next);
        else if (active.type === 'group') active.set('stroke', next);
        else active.set('stroke', next);
        canvas.requestRenderAll(); commit('modify', active);
      }
    }, [commit, updateBrush]);
  
  const changeStroke = useCallback((next: number) => {
      setStroke(next); strokeRef.current = next;
      const canvas = canvasRef.current;
      if (canvas) updateBrush(canvas);
      const active = canvas?.getActiveObject() as Obj | undefined;
      if (active && canvas && active.type !== 'textbox') {
        active.set('strokeWidth', next);
        canvas.requestRenderAll();
        commit('modify', active);
      }
    }, [commit, updateBrush]);
  
  const changeOpacity = useCallback((next: number) => {
      const safe = Math.max(0.05, Math.min(1, next));
      opacityRef.current = safe;
      setOpacity(safe);
      const canvas = canvasRef.current;
      if (!canvas) return;
      updateBrush(canvas);
      const selected = canvas.getActiveObject() as Obj | undefined;
      if (selected) {
        selected.set('opacity', safe);
        canvas.requestRenderAll();
        commit('modify', selected);
      }
    }, [commit, updateBrush]);
  
  const changeFill = useCallback((next: string) => {
      fillRef.current = next;
      setFill(next);
      const canvas = canvasRef.current;
      const selected = canvas?.getActiveObject() as Obj | undefined;
      if (!selected || !canvas) return;
      selected.set('fill', next);
      canvas.requestRenderAll();
      commit('modify', selected);
    }, [commit]);
  
  const replaceCurveNodes = useCallback((nodes: CurveNode[]) => {
      if (nodes.length !== 3 || nodes.some((node) =>
        !Number.isFinite(node.x) || !Number.isFinite(node.y) ||
        Math.abs(node.x) > 100000 || Math.abs(node.y) > 100000)) return;
      const canvas = canvasRef.current;
      const selected = canvas?.getActiveObject() as Obj | undefined;
      if (!canvas || !selected || selected.vectorNodes?.length !== 3) return;
      const path = quadraticPath(nodes);
      if (!path) return;
      const replacement = curveObject(nodes, selected);
      const at = canvas.getObjects().indexOf(selected);
      if (at < 0) return;
      silentRef.current = true;
      try {
        canvas.discardActiveObject();
        canvas.remove(selected);
        canvas.insertAt(at, replacement);
        canvas.setActiveObject(replacement);
        canvas.requestRenderAll();
      } finally {
        silentRef.current = false;
      }
      setSelectedCurveNodes(nodes);
      rerouteAllRef.current?.();
      commit('modify', replacement);
    }, [commit]);
  
  const updateCurveNode = useCallback((
      index: number, axis: 'x' | 'y', value: number,
    ) => {
      const canvas = canvasRef.current;
      const nodes = (canvas?.getActiveObject() as Obj | undefined)?.vectorNodes;
      if (!nodes || !Number.isFinite(value)) return;
      const next = nodes.map((node) => ({ ...node }));
      next[index][axis] = value;
      replaceCurveNodes(next);
    }, [replaceCurveNodes]);
  
  const setCurveClosed = useCallback((closed: boolean) => {
      const canvas = canvasRef.current;
      const selected = canvas?.getActiveObject() as Obj | undefined;
      if (!canvas || !selected?.vectorNodes) return;
      selected.curveClosed = closed;
      selected.fill = closed ? (fillRef.current === 'transparent'
        ? colorRef.current : fillRef.current) : '';
      replaceCurveNodes(selected.vectorNodes);
      setSelectedCurveClosed(closed);
    }, [replaceCurveNodes]);
  
  const addPaintLayer = useCallback(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const count = (canvas.getObjects() as Obj[]).filter(isRasterLayer).length;
      if (count >= MAX_PAINT_LAYERS) {
        notify('Maximum paint layers reached. Export before adding more.');
        return;
      }
      const layer = new FabricImage(createPaintSurface(), {
        left: 0, top: 0, selectable: false, evented: false,
        objectCaching: false, lockMovementX: true, lockMovementY: true,
        globalCompositeOperation: 'source-over',
      }) as Obj;
      layer.rasterLayer = { name: `Paint ${count + 1}`, blend: 'source-over' };
      ensureId(layer);
      activePaintIdRef.current = layer.id!;
      setActivePaintId(layer.id!);
      canvas.add(layer);
      canvas.requestRenderAll();
      setPanelTab('paint');
      changeTool('raster-paint');
      notify('Transparent paint layer added. Use the Pixel brush to begin.');
    }, [changeTool, notify]);
  
  const selectPaintLayer = useCallback((id: string) => {
      const canvas = canvasRef.current;
      const match = (canvas?.getObjects() as Obj[] | undefined)?.find(
        (object) => object.id === id && isRasterLayer(object));
      if (!match) return;
      activePaintIdRef.current = id;
      setActivePaintId(id);
      changeTool('raster-paint');
      refreshLayers(canvas!);
    }, [changeTool, refreshLayers]);
  
  const changePaintBlend = useCallback((blend: BlendMode) => {
      if (!validBlendMode(blend)) return;
      const canvas = canvasRef.current;
      const active = (canvas?.getObjects() as Obj[] | undefined)?.find(
        (object) => object.id === activePaintIdRef.current && isRasterLayer(object));
      if (!active || !canvas) return;
      active.rasterLayer!.blend = blend;
      active.set('globalCompositeOperation', blend);
      active.dirty = true;
      canvas.requestRenderAll();
      commit('modify', active);
    }, [commit]);
  
  const renamePaintLayer = useCallback((name: string) => {
      const canvas = canvasRef.current;
      const selected = (canvas?.getObjects() as Obj[] | undefined)?.find((object) =>
        object.id === activePaintIdRef.current && isRasterLayer(object));
      if (!selected || !canvas) return;
      selected.rasterLayer!.name = name.slice(0, 40);
      commit('modify', selected);
    }, [commit]);
  
  const togglePaintLayer = useCallback(() => {
      const canvas = canvasRef.current;
      const selected = (canvas?.getObjects() as Obj[] | undefined)?.find((object) =>
        object.id === activePaintIdRef.current && isRasterLayer(object));
      if (!selected || !canvas) return;
      selected.set('visible', selected.visible === false);
      canvas.requestRenderAll();
      commit('modify', selected);
    }, [commit]);
  
  const deletePaintLayer = useCallback(() => {
      const canvas = canvasRef.current;
      const selected = (canvas?.getObjects() as Obj[] | undefined)?.find((object) =>
        object.id === activePaintIdRef.current && isRasterLayer(object));
      if (!canvas || !selected) return;
      if (!window.confirm('Delete this paint layer and all its pixels?')) return;
      canvas.remove(selected);
      canvas.requestRenderAll();
      refreshLayers(canvas);
    }, [refreshLayers]);
  
  const exportPaintLayer = useCallback(() => {
      const canvas = canvasRef.current;
      const selected = (canvas?.getObjects() as Obj[] | undefined)?.find((object) =>
        object.id === activePaintIdRef.current && isRasterLayer(object));
      if (!selected) return;
      try {
        const src = (selected as FabricImage).getSrc();
        if (!src) throw new Error('Layer has no PNG source');
        const anchor = document.createElement('a');
        anchor.href = src;
        anchor.download = `${selected.rasterLayer!.name.replace(/[^\w-]/g, '_')}.png`;
        anchor.click();
      } catch {
        notify('Could not download this paint layer. Export the whole board as JSON.');
      }
    }, [notify]);
  return {
    changeConnectorRoute,
    changeBrushMode,
    snapScenePoint,
    changeTool,
    updateSelectedText,
    replacePenNodes,
    changeColor,
    changeStroke,
    changeOpacity,
    changeFill,
    replaceCurveNodes,
    updateCurveNode,
    setCurveClosed,
    addPaintLayer,
    selectPaintLayer,
    changePaintBlend,
    renamePaintLayer,
    togglePaintLayer,
    deletePaintLayer,
    exportPaintLayer,
  };
}
