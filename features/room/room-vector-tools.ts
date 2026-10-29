'use client';
import type { Obj } from './room-model';
import { useCallback } from 'react';
import { Rect, Group, Textbox, FabricImage, FabricObject, Gradient, util } from 'fabric';
import { splitPenNodes } from '@/lib/path-workshop';
import { makeMeshImage, type MeshColors } from '@/lib/mesh-fill';
import type { GradientMode } from '@/components/editor/FillWorkshop';
import type { ExportOptions } from '@/components/editor/ExportStudio';
import { computeAutoLayout, normalizeLayout, type SavedComponent } from '@/lib/prototype-layout';
import { DEVICES, type DevicePreset } from '@/components/editor/DeviceFrames';
import { ensureId, snapshot, serialize, penObject, saveBlob } from './room-model';
import type { useRoomBase } from './room-base';
import type { useRoomSync } from './room-sync';
import type { useRoomDrawing } from './room-drawing';
import type { useRoomCanvasTools } from './room-canvas-tools';
export function useRoomVectorTools(scope: ReturnType<typeof import('./room-base').useRoomBase> &
  ReturnType<typeof import('./room-sync').useRoomSync> &
  ReturnType<typeof import('./room-drawing').useRoomDrawing> &
  ReturnType<typeof import('./room-canvas-tools').useRoomCanvasTools>) {
  const {
    canvasRef,
    notify,
    silentRef,
    commitWholeBoard,
    refreshLayers,
    setSelectedPenNodes,
    replacePenNodes,
    commit,
    title,
    groupSelected,
    components,
    setComponents,
    setSelectedComponent,
    layoutSettings,
    fill,
    setGroupMembers,
    commitMember,
    changeTool,
  } = scope;
  const splitSelectedNode = useCallback((index: number) => {
      const canvas = canvasRef.current;
      const selected = canvas?.getActiveObject() as Obj | undefined;
      if (!canvas || !selected?.penNodes || selected.penClosed) {
        notify('Select an open continuous pen path.');
        return;
      }
      try {
        const [left, right] = splitPenNodes(selected.penNodes, index);
        const a = penObject(left, selected);
        const b = penObject(right, selected);
        a.id = crypto.randomUUID();
        b.id = crypto.randomUUID();
        silentRef.current = true;
        try {
          canvas.discardActiveObject();
          canvas.remove(selected);
          canvas.add(a, b);
          canvas.setActiveObject(a);
        } finally { silentRef.current = false; }
        commitWholeBoard(canvas);
        refreshLayers(canvas);
        setSelectedPenNodes(left);
      } catch (error) {
        notify(error instanceof Error ? error.message : 'Unable to split the path.');
      }
    }, [commitWholeBoard, refreshLayers, notify]);
  
  const deleteSelectedNode = useCallback((index: number) => {
      const selected = canvasRef.current?.getActiveObject() as Obj | undefined;
      if (!selected?.penNodes || selected.penNodes.length <= 2) {
        notify('Choose a path with at least three nodes.');
        return;
      }
      replacePenNodes(selected.penNodes.filter((_, i) => i !== index));
    }, [replacePenNodes, notify]);
  
  const cornerSelectedNode = useCallback((index: number) => {
      const selected = canvasRef.current?.getActiveObject() as Obj | undefined;
      const nodes = selected?.penNodes;
      if (!nodes || !nodes[index]) return;
      const next = nodes.map((node) => ({ ...node }));
      const node = next[index];
      if (node.incoming || node.outgoing) {
        delete node.incoming;
        delete node.outgoing;
      } else {
        const before = next[index - 1] || node;
        const after = next[index + 1] || node;
        node.incoming = {
          x: node.x - (after.x - before.x) / 6,
          y: node.y - (after.y - before.y) / 6,
        };
        node.outgoing = {
          x: node.x + (after.x - before.x) / 6,
          y: node.y + (after.y - before.y) / 6,
        };
      }
      replacePenNodes(next);
    }, [replacePenNodes]);
  
  const applyShapeGradient = useCallback((
      mode: GradientMode,
      colors: [string, string],
      angle: number,
    ) => {
      const canvas = canvasRef.current;
      const selected = canvas?.getActiveObjects() as Obj[] | undefined;
      if (!canvas || !selected?.length) {
        notify('Select a shape to apply a gradient fill.');
        return;
      }
      for (const object of selected) {
        const width = Math.max(1, object.width);
        const height = Math.max(1, object.height);
        const radians = angle * Math.PI / 180;
        const dx = Math.cos(radians) * width / 2;
        const dy = Math.sin(radians) * height / 2;
        const colorStops = [
          { offset: 0, color: colors[0] },
          { offset: 1, color: colors[1] },
        ];
        const gradient = mode === 'linear'
          ? new Gradient<'linear'>({
            type: 'linear',
            coords: {
              x1: width / 2 - dx, y1: height / 2 - dy,
              x2: width / 2 + dx, y2: height / 2 + dy,
            },
            colorStops,
          })
          : new Gradient<'radial'>({
            type: 'radial',
            coords: {
              x1: width / 2, y1: height / 2,
              x2: width / 2, y2: height / 2,
              r1: 0, r2: Math.max(width, height) / 2,
            },
            colorStops,
          });
        object.set('fill', gradient);
        commit('modify', object);
      }
      canvas.requestRenderAll();
      refreshLayers(canvas);
      notify('Gradient fill applied.');
    }, [commit, refreshLayers, notify]);
  
  const applyMeshFill = useCallback(async (colors: MeshColors) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      try {
        const source = canvas.getActiveObject() as Obj | null;
        const data = makeMeshImage(colors);
        const image = await FabricImage.fromURL(data) as Obj;
        image.meshColors = colors;
        image.set({
          left: source?.meshColors ? source.left : 130,
          top: source?.meshColors ? source.top : 130,
          scaleX: source?.meshColors ? source.scaleX : 1,
          scaleY: source?.meshColors ? source.scaleY : 1,
        });
        if (source?.meshColors) {
          image.id = ensureId(source);
          silentRef.current = true;
          canvas.remove(source);
          canvas.add(image);
          canvas.setActiveObject(image);
          silentRef.current = false;
          commit('modify', image);
        } else {
          ensureId(image);
          canvas.add(image);
          canvas.setActiveObject(image);
          commit('add', image);
        }
        canvas.requestRenderAll();
        refreshLayers(canvas);
      } catch {
        silentRef.current = false;
        notify('Mesh artwork could not be created.');
      }
    }, [commit, notify, refreshLayers]);
  
  const advancedExport = useCallback((options: ExportOptions) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const base = (title.trim() || 'sketchtogether-board')
        .replace(/[^a-zA-Z0-9_-]+/g, '-').slice(0, 50);
      if (options.format === 'json') {
        saveBlob(snapshot(canvas), 'application/json', `${base}.json`);
        notify('Editable board backup downloaded.');
        return;
      }
      const selected = canvas.getActiveObjects();
      if (options.selectionOnly && !selected.length) {
        notify('Select artwork before exporting only the selection.');
        return;
      }
      const others = options.selectionOnly
        ? canvas.getObjects().filter((object) => !selected.includes(object)) : [];
      const visible = others.map((object) => object.visible);
      const oldBackground = canvas.backgroundColor;
      const oldViewport = canvas.viewportTransform;
      try {
        const bounds = options.selectionOnly
          ? selected.map((object) => object.getBoundingRect()) : [];
        const left = bounds.length ? Math.floor(Math.min(...bounds.map((r) => r.left))) : 0;
        const top = bounds.length ? Math.floor(Math.min(...bounds.map((r) => r.top))) : 0;
        const width = bounds.length ? Math.ceil(Math.max(...bounds.map((r) =>
          r.left + r.width)) - left) : canvas.width;
        const height = bounds.length ? Math.ceil(Math.max(...bounds.map((r) =>
          r.top + r.height)) - top) : canvas.height;
        if (width * height * options.multiplier ** 2 > 32_000_000) {
          throw new Error('Export exceeds the 32-megapixel safety limit.');
        }
        others.forEach((object) => object.set('visible', false));
        canvas.backgroundColor = options.transparent && options.format !== 'jpeg'
          ? '' : '#fffdfa';
        canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
        canvas.requestRenderAll();
        if (options.format === 'svg') {
          const svg = canvas.toSVG({
            viewBox: { x: left, y: top, width, height },
          });
          saveBlob(svg, 'image/svg+xml', `${base}.svg`);
        } else {
          const format = options.format;
          const url = canvas.toDataURL({
            format, multiplier: options.multiplier,
            quality: 0.92, left, top, width, height,
          });
          const link = document.createElement('a');
          link.href = url;
          link.download = `${base}.${format === 'jpeg' ? 'jpg' : format}`;
          link.click();
        }
        notify('Artwork exported successfully.');
      } catch (error) {
        notify(error instanceof Error ? error.message : 'Export failed.');
      } finally {
        others.forEach((obj, index) => obj.set('visible', visible[index]));
        canvas.backgroundColor = oldBackground;
        canvas.setViewportTransform(oldViewport);
        canvas.requestRenderAll();
      }
    }, [title, notify]);
  
  const saveComponent = useCallback(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      let object = canvas.getActiveObject() as Obj | null;
      const selected = canvas.getActiveObjects() as Obj[];
      if (selected.length > 1) {
        groupSelected();
        object = canvas.getActiveObject() as Obj | null;
      }
      if (!(object instanceof Group)) {
        notify('Select multiple objects or an existing group to make a component.');
        return;
      }
      const componentGroup = object as Group & Obj;
      const name = `Creative piece ${components.length + 1}`;
      const id = crypto.randomUUID();
      componentGroup.component = { id, name, kind: 'master' };
      const item: SavedComponent = {
        id,
        name,
        data: serialize(componentGroup),
      };
      const next = [...components, item].slice(-40);
      try {
        localStorage.setItem('sketch:components', JSON.stringify(next));
      } catch {
        notify('Cannot save the component shelf. Check browser storage.');
        return;
      }
      setComponents(next);
      setSelectedComponent(componentGroup.component);
      commit('modify', componentGroup);
      notify('Saved to your component shelf. You can place more copies.');
    }, [commit, components, groupSelected, notify]);
  
  const insertComponent = useCallback(async (item: SavedComponent) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      try {
        const result = await util.enlivenObjects<Obj>([item.data]);
        const object = result[0];
        if (!(object instanceof Group)) {
          throw new Error('Component is no longer a group');
        }
        const componentGroup = object as Group & Obj;
        componentGroup.id = crypto.randomUUID();
        componentGroup.getObjects().forEach((child) => {
          (child as Obj).id = crypto.randomUUID();
        });
        componentGroup.component = {
          id: item.id,
          name: item.name,
          kind: 'instance',
        };
        object.set({ left: 170, top: 140, visible: true });
        object.setCoords();
        silentRef.current = true;
        canvas.add(object);
        silentRef.current = false;
        canvas.setActiveObject(object);
        canvas.requestRenderAll();
        commit('add', object);
        setSelectedComponent(componentGroup.component);
      } catch {
        silentRef.current = false;
        notify('Could not place that component.');
      }
    }, [commit, notify]);
  
  const deleteComponent = useCallback((id: string) => {
      setComponents((current) => {
        const next = current.filter((item) => item.id !== id);
        try { localStorage.setItem('sketch:components', JSON.stringify(next)); }
        catch { /* the current in-memory shelf still updates */ }
        return next;
      });
    }, []);
  
  const autoLayoutSelected = useCallback(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      let group = canvas.getActiveObject();
      if (!(group instanceof Group) || group.type === 'activeselection') {
        if (canvas.getActiveObjects().length < 2) {
          notify('Select a group or two or more elements to arrange.');
          return;
        }
        groupSelected();
        group = canvas.getActiveObject();
      }
      if (!(group instanceof Group)) return;
      const members = group.getObjects();
      if (!members.length) return;
      const settings = normalizeLayout(layoutSettings);
      const dimensions = members.map((member) => ({
        width: member.getScaledWidth(), height: member.getScaledHeight(),
      }));
      const layout = computeAutoLayout(dimensions, settings);
      silentRef.current = true;
      try {
        members.forEach((member, index) => {
          member.set({
            left: layout.positions[index].x - layout.width / 2,
            top: layout.positions[index].y - layout.height / 2,
          });
          member.setCoords();
        });
        group.set({ width: layout.width, height: layout.height, dirty: true });
        group.setCoords();
        canvas.requestRenderAll();
      } finally { silentRef.current = false; }
      (group as Obj).component = {
        id: (group as Obj).component?.id || crypto.randomUUID(),
        name: (group as Obj).component?.name || 'Auto layout',
        kind: (group as Obj).component?.kind || 'instance',
        layout: settings,
      };
      commit('modify', group as Obj);
    }, [commit, groupSelected, layoutSettings, notify]);
  
  const modifyGroupMember = useCallback((id: string, changes: {
      fill?: string; visible?: boolean;
    }) => {
      const canvas = canvasRef.current;
      const group = canvas?.getActiveObject();
      if (!canvas || !(group instanceof Group) || group.type === 'activeselection') return;
      const member = group.getObjects().find((object) => (object as Obj).id === id) as
        Obj | undefined;
      if (!member) return;
      silentRef.current = true;
      try {
        member.set(changes);
        group.set('dirty', true);
        group.setCoords();
        canvas.requestRenderAll();
      } finally { silentRef.current = false; }
      setGroupMembers(group.getObjects().map((object, index) => {
        const child = object as Obj;
        return { id: ensureId(child), name: `${index + 1} · ${child.type}`,
          fill: typeof child.fill === 'string' && /^#[\da-f]{6}$/i.test(child.fill)
            ? child.fill : '#333333', visible: child.visible !== false };
      }));
      if ((group as Obj)._requiresMemberMigration) {
        (group as Obj)._requiresMemberMigration = false;
        commit('modify', group as Obj);
      } else commitMember(group as Obj, member);
    }, [commit, commitMember]);
  
  const addDeviceFrame = useCallback((preset: DevicePreset) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const device = DEVICES.find((entry) => entry.id === preset);
      if (!device) return;
      const width = device.width;
      const height = device.height;
      const border = new Rect({ width, height, rx: 16, ry: 16,
        fill: '#fffdf7', stroke: '#34332f', strokeWidth: 3 });
      const top = new Textbox(`${device.name.toUpperCase()} · ${width} × ${height}`, {
        top: 14, left: 22, width: width - 44,
        fontSize: 15, fill: '#44443d', fontFamily: 'Arial',
        selectable: false, evented: false,
      });
      const elements: FabricObject[] = [border, top];
      if (preset === 'iphone' || preset === 'android') {
        elements.push(new Rect({ left: width / 2 - 32, top: 7,
          width: 64, height: 6, rx: 3, ry: 3, fill: '#33312d' }));
      }
      const frame = new Group(elements, { left: 120, top: 100,
        objectCaching: false }) as Obj;
      frame.deviceFrame = preset;
      ensureId(frame);
      const scale = Math.min(1, 650 / width, 650 / height);
      frame.scale(scale);
      frame.setCoords();
      silentRef.current = true;
      canvas.add(frame);
      silentRef.current = false;
      changeTool('select');
      canvas.setActiveObject(frame);
      commit('add', frame);
      notify(`${device.name} frame added. Resize it or draw around it.`);
    }, [changeTool, commit, notify]);
  return {
    splitSelectedNode,
    deleteSelectedNode,
    cornerSelectedNode,
    applyShapeGradient,
    applyMeshFill,
    advancedExport,
    saveComponent,
    insertComponent,
    deleteComponent,
    autoLayoutSelected,
    modifyGroupMember,
    addDeviceFrame,
  };
}
