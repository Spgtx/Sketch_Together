'use client';
import { useRoomBase } from './room-base';
import { useRoomSocial } from './room-social';
import { useRoomSync } from './room-sync';
import { useRoomDrawing } from './room-drawing';
import { useRoomCanvasTools } from './room-canvas-tools';
import { useRoomVectorTools } from './room-vector-tools';
import { useRoomCloudTools } from './room-cloud-tools';
import { useRoomCheckpoints } from './room-checkpoints';
import { useRoomCanvasLifecycle } from './room-canvas-lifecycle';
import { useRoomKeyboard } from './room-keyboard';

export function useRoomController() {
  const base = useRoomBase();
  const social = useRoomSocial({ ...base });
  const sync = useRoomSync({ ...base, ...social });
  const drawing = useRoomDrawing({ ...base, ...social, ...sync });
  const canvasTools = useRoomCanvasTools({ ...base, ...social, ...sync, ...drawing });
  const vectorTools = useRoomVectorTools({ 
    ...base,
    ...social,
    ...sync,
    ...drawing,
    ...canvasTools,
  });
  const cloudTools = useRoomCloudTools({ 
    ...base,
    ...social,
    ...sync,
    ...drawing,
    ...canvasTools,
    ...vectorTools,
  });
  const checkpoints = useRoomCheckpoints({ 
    ...base,
    ...social,
    ...sync,
    ...drawing,
    ...canvasTools,
    ...vectorTools,
    ...cloudTools,
  });
  const scope = {
    ...base,
    ...social,
    ...sync,
    ...drawing,
    ...canvasTools,
    ...vectorTools,
    ...cloudTools,
    ...checkpoints,
  };
  useRoomCanvasLifecycle(scope);
  useRoomKeyboard(scope);
  return scope;
}
