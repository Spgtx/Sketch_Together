'use client';
import { useEffect } from 'react';
import { type PaperStyle } from '@/components/editor/PaperPicker';
import type { Checkpoint } from '@/components/editor/CheckpointsPanel';
import { snapshot, restorePaintCompositing } from './room-model';
import type { useRoomBase } from './room-base';
import type { useRoomDrawing } from './room-drawing';
import type { useRoomCanvasTools } from './room-canvas-tools';
export function useRoomCheckpoints(scope: ReturnType<typeof import('./room-base').useRoomBase> &
  ReturnType<typeof import('./room-sync').useRoomSync> &
  ReturnType<typeof import('./room-drawing').useRoomDrawing> &
  ReturnType<typeof import('./room-canvas-tools').useRoomCanvasTools> &
  ReturnType<typeof import('./room-vector-tools').useRoomVectorTools> &
  ReturnType<typeof import('./room-cloud-tools').useRoomCloudTools>) {
  const {
    roomId,
    setCheckpoints,
    notify,
    canvasRef,
    ready,
    checkpoints,
    silentRef,
    rerouteAllRef,
    changeTool,
    toolRef,
    commitWholeBoard,
    setPaper,
    toast,
    setToast,
  } = scope;
  useEffect(() => {
      try {
        const stored = JSON.parse(
          localStorage.getItem(`sketchtogether:checkpoints:${roomId}`) || '[]',
        );
        setCheckpoints(Array.isArray(stored) ? stored.slice(0, 8) : []);
      } catch {
        setCheckpoints([]);
      }
    }, [roomId]);
  
  function persistCheckpoints(next: Checkpoint[]): boolean {
      try {
        localStorage.setItem(`sketchtogether:checkpoints:${roomId}`, JSON.stringify(next));
        setCheckpoints(next);
        return true;
      } catch {
        notify('Storage is full. Export the board before creating more snapshots.');
        return false;
      }
    }
  
  function createCheckpoint() {
      const canvas = canvasRef.current;
      if (!canvas || !ready) return;
      const now = Date.now();
      const current: Checkpoint = {
        id: crypto.randomUUID(),
        label: `Saved moment ${new Date(now).toLocaleDateString()}`,
        createdAt: now,
        state: JSON.parse(snapshot(canvas)) as Record<string, unknown>,
      };
      if (persistCheckpoints([current, ...checkpoints].slice(0, 8))) {
        notify('A copy of this moment is saved on this device.');
      }
    }
  
  async function restoreCheckpoint(checkpoint: Checkpoint) {
      const canvas = canvasRef.current;
      if (!canvas || !ready) return;
      if (!window.confirm('Restore this moment? This replaces the shared board.')) return;
      silentRef.current = true;
      try {
        await canvas.loadFromJSON(checkpoint.state);
        restorePaintCompositing(canvas);
        canvas.backgroundColor = 'transparent';
        rerouteAllRef.current?.();
        changeTool(toolRef.current);
        silentRef.current = false;
        canvas.requestRenderAll();
        commitWholeBoard(canvas);
        notify('That saved moment is now on your board.');
      } catch {
        notify('Could not restore this saved moment.');
      } finally {
        silentRef.current = false;
      }
    }
  
  function deleteCheckpoint(id: string) {
      if (persistCheckpoints(checkpoints.filter((item) => item.id !== id))) {
        notify('Saved moment removed from this device.');
      }
    }
  
  function changePaper(next: PaperStyle) {
      setPaper(next);
      try {
        localStorage.setItem(`sketchtogether:paper:${roomId}`, next);
      } catch {
        notify('Your browser cannot remember this paper preference.');
      }
    }
  
  useEffect(() => {
      if (!toast) return;
      const timer = setTimeout(() => setToast(''), 3800);
      return () => clearTimeout(timer);
    }, [toast]);
  return { persistCheckpoints, createCheckpoint, restoreCheckpoint, deleteCheckpoint, changePaper };
}
