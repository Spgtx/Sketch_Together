'use client';
import type { Tool } from './room-model';
import { useEffect } from 'react';
import { Textbox } from 'fabric';
import type { useRoomBase } from './room-base';
import type { useRoomDrawing } from './room-drawing';
import type { useRoomCanvasTools } from './room-canvas-tools';
import type { useRoomCloudTools } from './room-cloud-tools';
export function useRoomKeyboard(scope: ReturnType<typeof import('./room-base').useRoomBase> &
  ReturnType<typeof import('./room-sync').useRoomSync> &
  ReturnType<typeof import('./room-drawing').useRoomDrawing> &
  ReturnType<typeof import('./room-canvas-tools').useRoomCanvasTools> &
  ReturnType<typeof import('./room-vector-tools').useRoomVectorTools> &
  ReturnType<typeof import('./room-cloud-tools').useRoomCloudTools>) {
  const {
    modal,
    canvasRef,
    restoreHistory,
    ungroupSelected,
    groupSelected,
    zoomTo,
    duplicateSelected,
    fitToDrawing,
    removeSelected,
    changeTool,
    toolRef,
    finishPenRef,
    setModal,
    cancelPenRef,
  } = scope;
  useEffect(() => {
      const shortcut = (event: KeyboardEvent) => {
        const target = event.target as HTMLElement;
        if (target.closest('input,textarea,select,[contenteditable="true"]') || modal) {
          return;
        }
        const active = canvasRef.current?.getActiveObject();
        if (active instanceof Textbox && active.isEditing) return;
        const command = event.ctrlKey || event.metaKey;
        const key = event.key.toLowerCase();
        if (command && key === 'z') {
          event.preventDefault();
          void restoreHistory(event.shiftKey ? 'redo' : 'undo');
          return;
        }
        if (command && key === 'y') {
          event.preventDefault();
          void restoreHistory('redo');
          return;
        }
        if (command && key === 'g') {
          event.preventDefault();
          if (event.shiftKey) ungroupSelected();
          else groupSelected();
          return;
        }
        if (command && (key === '+' || key === '=')) {
          event.preventDefault();
          zoomTo(Math.round((canvasRef.current?.getZoom() || 1) * 100) + 20);
          return;
        }
        if (command && key === '-') {
          event.preventDefault();
          zoomTo(Math.round((canvasRef.current?.getZoom() || 1) * 100) - 20);
          return;
        }
        if (command && key === 'd') {
          event.preventDefault();
          void duplicateSelected();
          return;
        }
        if (command && key === '0') {
          event.preventDefault();
          fitToDrawing();
          return;
        }
        if (event.key === 'Backspace' || event.key === 'Delete') {
          event.preventDefault();
          removeSelected();
          return;
        }
        if (command) return;
        const mappings: Record<string, Tool> = {
          v: 'select',
          h: 'hand',
          p: 'pen',
          e: 'eraser',
          b: 'curve',
          q: 'vector-pen',
          d: 'node',
          g: 'raster-paint',
          x: 'raster-erase',
          f: 'raster-fill',
          r: 'rectangle',
          o: 'ellipse',
          l: 'line',
          a: 'arrow',
          c: 'connector',
          t: 'text',
          n: 'note',
        };
        if (mappings[key]) changeTool(mappings[key]);
        if (key === 'enter' && toolRef.current === 'vector-pen') {
          finishPenRef.current?.();
          return;
        }
        if (key === '?' ) setModal('shortcuts');
        if (key === 'escape') {
          cancelPenRef.current?.();
          canvasRef.current?.discardActiveObject();
          canvasRef.current?.requestRenderAll();
        }
      };
      window.addEventListener('keydown', shortcut);
      return () => window.removeEventListener('keydown', shortcut);
    }, [
      changeTool,
      modal,
      removeSelected,
      restoreHistory,
      duplicateSelected,
      fitToDrawing,
      groupSelected,
      ungroupSelected,
      zoomTo,
    ]);

}
