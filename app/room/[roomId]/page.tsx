'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type CSSProperties,
} from 'react';
import { useParams } from 'next/navigation';
import { connectLiveRoom, type LiveRoom } from '@/lib/realtime/supabase-room';
import { enterRoom, editorInviteUrl } from '@/lib/room-links';
import {
  createCloudRoom,
  saveOwnerAccess,
  uploadLocalDocument,
} from '@/lib/cloud-room-client';
import { stickerPngDataUrl } from '@/lib/sticker-render';
import {
  Canvas,
  PencilBrush,
  SprayBrush,
  Rect,
  Ellipse,
  Line,
  Path,
  Triangle,
  Group,
  Textbox,
  FabricImage,
  FabricObject,
  Point,
  util,
} from 'fabric';
import { StudioIcon } from '@/components/StudioIcon';
import { CurveHandles } from '@/components/editor/CurveHandles';
import {
  bucketFill,
  copyPaintSurface,
  createPaintSurface,
  insidePaintArea,
  MAX_PAINT_LAYERS,
  paintStroke,
  validBlendMode,
  type BlendMode,
  type PaintPoint,
} from '@/lib/raster-paint';
import type { PaintLayerItem } from '@/components/editor/RasterToolsPanel';
import type { LayerItem } from '@/components/editor/LayersPanel';
import { ReactionBursts, type ReactionBurst } from '@/components/editor/ReactionBursts';
import {
  RoomToolRail,
  type RoomTool,
} from '@/components/editor/RoomToolRail';
import { getBoards, touchBoard, type Template } from '@/lib/boards';
import { seedTemplate } from '@/lib/templates';
import { isPaperStyle, type PaperStyle } from '@/components/editor/PaperPicker';
import { stickerUrl, type StickerId } from '@/lib/stickers';
import {
  RoomDrawer,
  type DrawerTab,
} from '@/components/editor/RoomDrawer';
import { RoomDialogs, type RoomDialog } from '@/components/editor/RoomDialogs';
import type { Checkpoint } from '@/components/editor/CheckpointsPanel';
import type { SyncChange, SyncPolicy } from '@/lib/sync-model';
import {
  hexWithOpacity,
  pressureStrokePath,
  quadraticPath,
  type BrushPreset,
  type CurveNode,
  type StrokePoint,
} from '@/lib/art-strokes';
import {
  connectorPath,
  edgeAnchor,
  type ConnectorMeta,
  type ConnectorRoute,
  type XY,
} from '@/lib/connector-geometry';

type Tool = RoomTool;
type Obj = FabricObject & {
  id?: string;
  connector?: ConnectorMeta;
  vectorNodes?: CurveNode[];
  curveClosed?: boolean;
  rasterLayer?: { name: string; blend: BlendMode };
  stickerId?: string;
};
// Fabric's custom property registry preserves connector metadata after save/load.
FabricObject.customProperties = [
  'id', 'connector', 'vectorNodes', 'curveClosed', 'rasterLayer', 'stickerId',
];
const isRasterLayer = (object: Obj): object is Obj & FabricImage & {
  rasterLayer: { name: string; blend: BlendMode };
} => Boolean(object.rasterLayer && object.type === 'image');
type RemoteOperation = {
  sender: string;
  kind: 'add' | 'modify' | 'remove' | 'clear' | 'replace';
  object?: Record<string, unknown>;
  id?: string;
  state?: Record<string, unknown>;
  revision?: number;
};
type Cursor = { x: number; y: number; color: string; name: string; lastSeen: number };
const COLORS = ['#292923', '#e75436', '#edb942', '#7d9f85', '#7577b3', '#ffffff'];
const CURSOR_COLORS = ['#e75436', '#6d8e77', '#9470b8', '#ad824c', '#456d9d'];
const REACTIONS = ['❤️', '✨', '👏', '💡'] as const;
const MAX_HISTORY = 35;
const LOCAL_PREFIX = 'sketchtogether:canvas:';
const PENDING_PREFIX = 'sketchtogether:pending:';
function validTemplate(input: string | null): Template {
  return input === 'brainstorm' || input === 'flow' || input === 'retro'
    ? input
    : 'blank';
}

function ensureId(obj: Obj) { if (!obj.id) obj.id = crypto.randomUUID(); return obj.id; }
function snapshot(canvas: Canvas) {
  canvas.getObjects().forEach((object) => ensureId(object as Obj));
  return JSON.stringify(canvas.toJSON());
}
function serialize(obj: Obj): Record<string, unknown> {
  ensureId(obj);
  return obj.toObject(FabricObject.customProperties) as Record<string, unknown>;
}
function curveObject(nodes: CurveNode[], source: Obj): Obj {
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

function restorePaintCompositing(canvas: Canvas) {
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

function saveBlob(content: BlobPart, type: string, name: string) {
  const href = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement('a'); link.href = href; link.download = name; link.click();
  setTimeout(() => URL.revokeObjectURL(href), 1000);
}

export default function BoardRoom() {
  const params = useParams();
  const roomId = (params.roomId as string) || '';
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasElementRef = useRef<HTMLCanvasElement>(null);
  const rasterPreviewRef = useRef<HTMLCanvasElement>(null);
  const activePaintIdRef = useRef<string | null>(null);
  const canvasRef = useRef<Canvas | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const boardInputRef = useRef<HTMLInputElement>(null);
  const liveRoomRef = useRef<LiveRoom | null>(null);
  const clientIdRef = useRef('');
  const toolRef = useRef<Tool>('pen');
  const connectorRouteRef = useRef<ConnectorRoute>('elbow');
  const cloudEnabledRef = useRef(false);
  const syncPolicyRef = useRef<SyncPolicy>('protected');
  const cloudRevisionRef = useRef(0);
  const cloudVersionsRef = useRef<Record<string, number>>({});
  const gestureVersionsRef = useRef<Record<string, number>>({});
  const editingIdsRef = useRef<Set<string>>(new Set());
  const rerouteAllRef = useRef<(() => void) | null>(null);
  const queueRef = useRef<Array<SyncChange & { previousOp?: string }>>([]);
  const acknowledgedRef = useRef<Record<string, number>>({});
  const sendingRef = useRef(false);
  const conflictedRef = useRef(false);
  const needsRefreshRef = useRef(false);
  const colorRef = useRef(COLORS[0]);
  const strokeRef = useRef(3);
  const brushModeRef = useRef<BrushPreset>('pencil');
  const opacityRef = useRef(1);
  const fillRef = useRef('transparent');
  const displayNameRef = useRef('Guest');
  const reactionTimersRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());
  const silentRef = useRef(false);
  const mountedRef = useRef(false);
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const historyRef = useRef<{ past: string[]; future: string[] }>({ past: [], future: [] });
  const cursorThrottleRef = useRef(0);
  const remoteQueueRef = useRef<Promise<void>>(Promise.resolve());
  const remoteRefreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [tool, setTool] = useState<Tool>('pen');
  const [connectorRoute, setConnectorRoute] = useState<ConnectorRoute>('elbow');
  const [syncPolicy, setSyncPolicy] = useState<SyncPolicy>('protected');
  const [cloudEnabled, setCloudEnabled] = useState(false);
  const [locked, setLocked] = useState(false);
  const [syncWarning, setSyncWarning] = useState('');
  const [color, setColor] = useState(COLORS[0]);
  const [stroke, setStroke] = useState(3);
  const [paper, setPaper] = useState<PaperStyle>('dots');
  const [panelTab, setPanelTab] = useState<DrawerTab>('ink');
  const [brushMode, setBrushMode] = useState<BrushPreset>('pencil');
  const [opacity, setOpacity] = useState(1);
  const [fill, setFill] = useState('transparent');
  const [selectedCurveNodes, setSelectedCurveNodes] = useState<CurveNode[] | null>(null);
  const [selectedCurveClosed, setSelectedCurveClosed] = useState(false);
  const [paintLayers, setPaintLayers] = useState<PaintLayerItem[]>([]);
  const [activePaintId, setActivePaintId] = useState<string | null>(null);
  const [viewportTick, setViewportTick] = useState(0);
  const [layers, setLayers] = useState<LayerItem[]>([]);
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);
  const [displayName, setDisplayName] = useState('Guest');
  const [people, setPeople] = useState<string[]>([]);
  const [bursts, setBursts] = useState<ReactionBurst[]>([]);
  const [panelOpen, setPanelOpen] = useState(true);
  const [title, setTitle] = useState('Untitled board');
  const [connected, setConnected] = useState(false);
  const [online, setOnline] = useState(1);
  const [hasRealtime, setHasRealtime] = useState(false);
  const [ready, setReady] = useState(false);
  const [saveStatus, setSaveStatus] = useState('Opening board…');
  const [zoom, setZoom] = useState(100);
  const [historyState, setHistoryState] = useState({ undo: false, redo: false });
  const [cursors, setCursors] = useState<Record<string, Cursor>>({});
  const [toast, setToast] = useState('');
  const [modal, setModal] = useState<RoomDialog | null>(null);
  const [shareUrl, setShareUrl] = useState('');
  const [shareMessage, setShareMessage] = useState('');
  const [shareBusy, setShareBusy] = useState(false);
  const [movingOnline, setMovingOnline] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    // On small screens the canvas should be visible before the tool drawer.
    if (window.matchMedia('(max-width: 650px)').matches) {
      setPanelOpen(false);
    }
  }, []);

  const notify = useCallback((message: string) => {
    setToast(message);
  }, []);

  useEffect(() => {
    try {
      const previous = localStorage.getItem(`sketchtogether:paper:${roomId}`);
      setPaper(isPaperStyle(previous) ? previous : 'dots');
    } catch {
      setPaper('dots');
    }
  }, [roomId]);

  useEffect(() => {
    try {
      const name = localStorage.getItem('sketchtogether:guest:name')?.trim();
      if (name) {
        displayNameRef.current = name.slice(0, 22);
        setDisplayName(displayNameRef.current);
      }
    } catch { /* the guest name is optional */ }
  }, []);

  function saveDisplayName(nextName: string) {
    const safeName = nextName.trim().slice(0, 22) || 'Guest';
    setDisplayName(safeName);
    displayNameRef.current = safeName;
    try {
      localStorage.setItem('sketchtogether:guest:name', safeName);
    } catch { /* session-only name */ }
    const room = liveRoomRef.current;
    if (room) {
      void room.updateName(safeName).catch(() => {
        notify('Could not update your live name.');
      });
    }
    setModal(null);
  }

  const showReaction = useCallback((emoji: string) => {
    if (!REACTIONS.some((reaction) => reaction === emoji)) return;
    const id = crypto.randomUUID();
    setBursts((previous) => [...previous.slice(-7), { id, emoji }]);
    const timer = setTimeout(() => {
      setBursts((previous) => previous.filter((reaction) => reaction.id !== id));
      reactionTimersRef.current.delete(timer);
    }, 1700);
    reactionTimersRef.current.add(timer);
  }, []);

  function sendReaction(emoji: string) {
    showReaction(emoji);
    if (liveRoomRef.current && connected) {
      void liveRoomRef.current.send('room:reaction', {
        sender: clientIdRef.current,
        emoji,
      }).catch(() => notify('Reaction appeared locally, but could not be sent.'));
    }
  }

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
  const updateHistoryUI = useCallback(() => {
    setHistoryState({
      undo: historyRef.current.past.length > 1,
      redo: historyRef.current.future.length > 0,
    });
  }, []);

  const refreshLayers = useCallback((canvas: Canvas) => {
    const raster = (canvas.getObjects() as Obj[]).filter(isRasterLayer);
    setPaintLayers(raster.slice().reverse().map((object) => ({
      id: ensureId(object),
      name: object.rasterLayer.name,
      blend: object.rasterLayer.blend,
      visible: object.visible !== false,
    })));
    if (!raster.some((object) => object.id === activePaintIdRef.current)) {
      activePaintIdRef.current = raster.length ? ensureId(raster[raster.length - 1]) : null;
      setActivePaintId(activePaintIdRef.current);
    }
    const selected = new Set(canvas.getActiveObjects());
    setLayers(canvas.getObjects().slice().reverse().map((obj, index) => {
      const typed = obj as Obj;
      const kind = typed.rasterLayer ? 'Raster paint layer'
        : typed.type === 'textbox' ? 'Text or note'
        : typed.type === 'path' ? 'Hand-drawn mark'
          : typed.type === 'image' ? 'Illustration or photo'
            : typed.type === 'group' ? 'Grouped shape'
              : `${typed.type || 'Shape'} shape`;
      const content = typed.rasterLayer?.name || (typed.type === 'textbox'
        ? (typed as Textbox).text?.trim().slice(0, 23)
        : '');
      return {
        id: ensureId(typed),
        label: content || `${kind} ${index + 1}`,
        kind,
        visible: typed.visible !== false,
        selected: selected.has(obj),
      };
    }));
  }, []);

  const updateBrush = useCallback((canvas: Canvas) => {
    const preset = brushModeRef.current;
    if (preset === 'pressure') return;
    const needsSpray = preset === 'spray';
    if (
      !canvas.freeDrawingBrush ||
      (needsSpray && !(canvas.freeDrawingBrush instanceof SprayBrush)) ||
      (!needsSpray && !(canvas.freeDrawingBrush instanceof PencilBrush))
    ) {
      canvas.freeDrawingBrush = needsSpray
        ? new SprayBrush(canvas)
        : new PencilBrush(canvas);
    }
    const brush = canvas.freeDrawingBrush;
    if (!brush) return;
    const opacity = preset === 'marker'
      ? opacityRef.current * 0.33
      : opacityRef.current;
    brush.color = hexWithOpacity(colorRef.current, opacity);
    brush.width = preset === 'marker'
      ? Math.max(12, strokeRef.current * 3)
      : preset === 'ink' ? strokeRef.current * 1.2
      : strokeRef.current;
    if (brush instanceof SprayBrush) {
      brush.density = 18;
      brush.dotWidth = Math.max(1, strokeRef.current / 3);
      brush.dotWidthVariance = 1;
    }
  }, []);

  const recordHistory = useCallback((canvas: Canvas) => {
    const current = snapshot(canvas);
    const h = historyRef.current;
    if (h.past[h.past.length - 1] !== current) {
      h.past.push(current);
      if (h.past.length > MAX_HISTORY) h.past.shift();
      h.future = [];
      updateHistoryUI();
    }
    refreshLayers(canvas);
  }, [updateHistoryUI, refreshLayers]);

  const persist = useCallback((canvas: Canvas) => {
    const json = snapshot(canvas);
    try {
      localStorage.setItem(LOCAL_PREFIX + roomId, JSON.stringify({
        state: JSON.parse(json),
        updatedAt: Date.now(),
      }));
    } catch {
      setSaveStatus('Storage full · export your board');
      notify('Browser storage is full. Export a JSON backup to keep this board.');
      return;
    }
    touchBoard(roomId);
    if (cloudEnabledRef.current) {
      setSaveStatus(conflictedRef.current ? 'Collision · action needed' : 'Syncing changes…');
    } else {
      setSaveStatus('Saved on this device only');
    }
  }, [roomId, notify]);

  const publish = useCallback((event: Omit<RemoteOperation, 'sender'>) => {
    const room = liveRoomRef.current;
    if (!room) return;
    const payload = { ...event, sender: clientIdRef.current };
    // Large raster data lives in Redis, not Supabase's limited Broadcast frame.
    // Peers reload the authoritative state when they receive this compact signal.
    const compact = cloudEnabledRef.current &&
      JSON.stringify(payload).length > 40_000;
    const outgoing = compact
      ? { sender: payload.sender, kind: payload.kind, revision: payload.revision }
      : payload;
    void room.send('board:event', outgoing).catch(() => setConnected(false));
  }, []);

  /**
   * The queue is ordered per client; the Redis script serializes all clients.
   * A protected change uses the version seen WHEN the gesture occurred,
   * not the version we happen to see later when its network request begins.
   */
  const savePending = useCallback(() => {
    try {
      const data = {
        queue: queueRef.current,
        acknowledged: acknowledgedRef.current,
      };
      if (data.queue.length) {
        localStorage.setItem(PENDING_PREFIX + roomId, JSON.stringify(data));
      } else {
        localStorage.removeItem(PENDING_PREFIX + roomId);
      }
    } catch {
      notify('Cannot cache offline edits. Download a board backup before leaving.');
    }
  }, [roomId, notify]);

  const flushCloud = useCallback(async () => {
    if (sendingRef.current || conflictedRef.current || !cloudEnabledRef.current) return;
    sendingRef.current = true;
    try {
      while (queueRef.current.length > 0 && !conflictedRef.current) {
        const change = queueRef.current[0];
        const isBoardChange = change.kind === 'clear' || change.kind === 'replace';
        const fromPredecessor = change.previousOp
          ? acknowledgedRef.current[change.previousOp]
          : undefined;
        const baseVersion = isBoardChange ? undefined
          : change.previousOp ? fromPredecessor : change.baseVersion;
        const baseRevision = isBoardChange && change.previousOp
          ? fromPredecessor
          : change.baseRevision;
        if (change.previousOp && fromPredecessor === undefined) break;
        if (isBoardChange && change.policy === 'protected' &&
          needsRefreshRef.current) {
          conflictedRef.current = true;
          setSyncWarning('The shared board advanced while your whole-board ' +
            'action was waiting. Download your local copy or reload to avoid data loss.');
          setSaveStatus('Board changed · action needed');
          break;
        }
        let result: Response;
        try {
          result = await fetch(`/api/sync/${encodeURIComponent(roomId)}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...change, baseVersion, baseRevision }),
          });
        } catch {
          setSaveStatus('Offline · local changes waiting');
          break;
        }
        if (result.status === 413) {
          conflictedRef.current = true;
          setSyncWarning('This board exceeds the cloud size limit. ' +
            'Download your local JSON to keep the artwork safe.');
          setSaveStatus('Board too large for cloud');
          break;
        }
        if (result.status === 409) {
          conflictedRef.current = true;
          setSyncWarning('A collaborator changed the same object first. ' +
            'Your local drawing is preserved; the cloud was not overwritten.');
          setSaveStatus('Collision · action needed');
          break;
        }
        if (!result.ok) {
          setSaveStatus('Waiting for cloud · changes kept locally');
          break;
        }
        const ack = await result.json() as {
          revision: number;
          duplicate?: boolean;
        };
        if (ack.duplicate || ack.revision < cloudRevisionRef.current ||
          ack.revision > cloudRevisionRef.current + 1) {
          needsRefreshRef.current = true;
        }
        cloudRevisionRef.current = Math.max(cloudRevisionRef.current, ack.revision);
        acknowledgedRef.current[change.opId] = ack.revision;
        if (change.id) {
          cloudVersionsRef.current[change.id] = Math.max(
            cloudVersionsRef.current[change.id] ?? -1,
            ack.revision,
          );
        }
        if (change.kind === 'clear' || change.kind === 'replace') {
          const state = change.kind === 'replace' ? change.state : null;
          cloudVersionsRef.current = Object.fromEntries(
            (Array.isArray(state?.objects) ? state.objects : []).map((object) => [
              (object as { id: string }).id, ack.revision,
            ]),
          );
        }
        queueRef.current.shift();
        savePending();
        // Broadcast only committed operations, never unverified local snapshots.
        publish({
          kind: change.kind,
          object: change.object,
          id: change.id,
          state: change.state,
          revision: ack.revision,
        });
      }
      if (queueRef.current.length === 0 && !conflictedRef.current) {
        // Old acknowledgement IDs are not needed after the local queue drains.
        acknowledgedRef.current = {};
        setSaveStatus('Cloud synced · object-level changes');
      }
    } finally {
      sendingRef.current = false;
    }
  }, [publish, roomId, savePending]);

  const queueCloud = useCallback((
    kind: RemoteOperation['kind'],
    object?: Obj,
    state?: Record<string, unknown>,
  ) => {
    const id = object ? ensureId(object) : undefined;
    const predecessor = id
      ? [...queueRef.current].reverse().find((entry) =>
        entry.id === id || (kind !== 'add' &&
          (entry.kind === 'clear' || entry.kind === 'replace')))
      : queueRef.current[queueRef.current.length - 1];
    const change: SyncChange & { previousOp?: string } = {
      opId: crypto.randomUUID(),
      actor: clientIdRef.current,
      kind,
      policy: syncPolicyRef.current,
      ...(id && { id }),
      ...(object && kind !== 'remove' && { object: serialize(object) as
        SyncChange['object'] }),
      ...(state && { state: state as SyncChange['state'] }),
      baseVersion: id ? gestureVersionsRef.current[id] ??
        cloudVersionsRef.current[id] ?? -1 : undefined,
      baseRevision: cloudRevisionRef.current,
      ...(predecessor && { previousOp: predecessor.opId }),
    };
    const last = queueRef.current[queueRef.current.length - 1];
    const mayCoalesce = !sendingRef.current && last && last.id === id &&
      (last.kind === 'add' || last.kind === 'modify') && kind === 'modify';
    if (mayCoalesce) {
      // Keep the original operation ID and expected revision; update its final shape.
      last.object = change.object;
    } else {
      queueRef.current.push(change);
    }
    if (id && kind !== 'remove' && !editingIdsRef.current.has(id)) {
      delete gestureVersionsRef.current[id];
    }
    savePending();
    if (flushTimerRef.current) clearTimeout(flushTimerRef.current);
    flushTimerRef.current = setTimeout(() => void flushCloud(), 450);
  }, [flushCloud, savePending]);

  const commit = useCallback((kind: RemoteOperation['kind'], obj?: Obj) => {
    const canvas = canvasRef.current;
    if (!canvas || silentRef.current) return;
    recordHistory(canvas);
    persist(canvas);
    if (cloudEnabledRef.current) {
      queueCloud(kind, obj);
    } else if (kind === 'add' || kind === 'modify') {
      if (obj) publish({ kind, object: serialize(obj) });
    } else if (kind === 'remove') {
      if (obj?.id) publish({ kind, id: obj.id });
    } else if (kind === 'clear') publish({ kind: 'clear' });
  }, [recordHistory, persist, publish, queueCloud]);

  const commitReplacement = useCallback((canvas: Canvas) => {
    const state = JSON.parse(snapshot(canvas)) as Record<string, unknown>;
    if (cloudEnabledRef.current) queueCloud('replace', undefined, state);
    else publish({ kind: 'replace', state });
  }, [queueCloud, publish]);

  const loadCloud = useCallback(async (force = false) => {
    if (!cloudEnabledRef.current || (conflictedRef.current && !force)) return;
    if (queueRef.current.length > 0 && !force) return;
    const result = await fetch(`/api/sync/${encodeURIComponent(roomId)}`, {
      cache: 'no-store',
      headers: force || needsRefreshRef.current ? {}
        : { 'If-None-Match': `\"room-${cloudRevisionRef.current}\"` },
    });
    if (result.status === 304) return;
    if (!result.ok) return;
    const latest = await result.json() as {
      revision: number;
      versions: Record<string, number>;
      policy?: SyncPolicy;
      state: Record<string, unknown>;
    };
    if (!force && latest.revision <= cloudRevisionRef.current &&
      !needsRefreshRef.current) return;
    // A user may start drawing while the GET was in flight.
    if (!force && (
      queueRef.current.length || conflictedRef.current ||
      Object.keys(gestureVersionsRef.current).length > 0
    )) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    silentRef.current = true;
    try {
      await canvas.loadFromJSON(latest.state);
      restorePaintCompositing(canvas);
      canvas.backgroundColor = 'transparent';
      rerouteAllRef.current?.();
      canvas.requestRenderAll();
      setSelectedCurveNodes(null);
      cloudRevisionRef.current = latest.revision;
      cloudVersionsRef.current = latest.versions;
      if (latest.policy === 'protected' || latest.policy === 'classic') {
        syncPolicyRef.current = latest.policy;
        setSyncPolicy(latest.policy);
      }
      needsRefreshRef.current = false;
      historyRef.current = { past: [snapshot(canvas)], future: [] };
      updateHistoryUI();
      refreshLayers(canvas);
      if (force) {
        queueRef.current = [];
        acknowledgedRef.current = {};
        savePending();
        conflictedRef.current = false;
        setSyncWarning('');
      }
      setSaveStatus('Cloud synced · object-level changes');
      persist(canvas);
    } finally {
      silentRef.current = false;
    }
  }, [roomId, persist, refreshLayers, updateHistoryUI, savePending]);

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

  const changeTool = useCallback((next: Tool) => {
    toolRef.current = next;
    setTool(next);
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.discardActiveObject();
    canvas.isDrawingMode = next === 'pen' && brushModeRef.current !== 'pressure';
    canvas.selection = next === 'select';
    canvas.skipTargetFind = next !== 'select';
    canvas.defaultCursor = next === 'hand' ? 'grab'
      : next === 'select' ? 'default'
      : next === 'eraser' ? 'cell' : 'crosshair';
    canvas.forEachObject((obj) => {
      const raster = isRasterLayer(obj as Obj);
      obj.selectable = next === 'select' && !raster;
      obj.evented = next === 'select' && !raster;
    });
    canvas.requestRenderAll();
    refreshLayers(canvas);
  }, [refreshLayers]);

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

  const duplicateSelected = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const selected = canvas.getActiveObjects() as Obj[];
    if (selected.length === 0) {
      notify('Select a mark, note, or image to duplicate.');
      return;
    }
    try {
      const clones = await Promise.all(selected.map((obj) => obj.clone(['id'])));
      canvas.discardActiveObject();
      clones.forEach((obj) => {
        const item = obj as Obj;
        item.id = crypto.randomUUID();
        item.set({
          left: (item.left || 0) + 25,
          top: (item.top || 0) + 25,
          visible: true,
        });
        canvas.add(item);
        item.setCoords();
      });
      if (clones.length === 1) canvas.setActiveObject(clones[0]);
      canvas.requestRenderAll();
      refreshLayers(canvas);
      notify(`${clones.length} copied piece${clones.length > 1 ? 's' : ''}.`);
    } catch {
      notify('Could not duplicate that selection.');
    }
  }, [notify, refreshLayers]);

  const removeSelected = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const selected = canvas.getActiveObjects() as Obj[];
    if (!selected.length) return;
    canvas.discardActiveObject();
    selected.forEach(obj => canvas.remove(obj));
    canvas.requestRenderAll();
    refreshLayers(canvas);
  }, [refreshLayers]);

  const clearBoard = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    silentRef.current = true;
    canvas.clear(); canvas.backgroundColor = 'transparent'; canvas.requestRenderAll();
    silentRef.current = false;
    commit('clear');
    setModal(null);
    refreshLayers(canvas);
    notify('The board has been cleared. You can undo this.');
  }, [commit, notify, refreshLayers]);

  const revokeInvitations = useCallback(async () => {
    if (!window.confirm('Revoke all guest editor links? Other people must be invited again.')) {
      return;
    }
    const response = await fetch(`/api/rooms/${encodeURIComponent(roomId)}/share`, {
      method: 'DELETE',
    });
    notify(response.ok
      ? 'All guest invitations revoked. Existing Realtime tokens expire soon.'
      : 'Could not revoke invitations. Only the room owner can do this.');
  }, [roomId, notify]);

  const backupNow = useCallback(async () => {
    if (!cloudEnabledRef.current || queueRef.current.length) {
      notify('Wait for pending edits to sync before backing up.');
      return;
    }
    setSaveStatus('Backing up to Supabase…');
    try {
      const result = await fetch(`/api/rooms/${encodeURIComponent(roomId)}/backup`, {
        method: 'POST',
      });
      if (!result.ok) throw new Error(`Backup returned ${result.status}`);
      const data = await result.json() as { revision: number };
      setSaveStatus(`Backed up · revision ${data.revision}`);
      notify('Durable Supabase backup created.');
    } catch {
      setSaveStatus('Redis synced · Supabase backup unavailable');
      notify('Backup failed. Redis edits remain intact; configure Supabase Storage.');
    }
  }, [roomId, notify]);

  const changeRoomPolicy = useCallback(async (policy: SyncPolicy) => {
    if (!cloudEnabledRef.current) {
      syncPolicyRef.current = policy;
      setSyncPolicy(policy);
      return;
    }
    const response = await fetch(`/api/rooms/${encodeURIComponent(roomId)}/policy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ policy }),
    });
    if (!response.ok) {
      notify('Only the owner can change the shared room policy.');
      return;
    }
    syncPolicyRef.current = policy;
    setSyncPolicy(policy);
    notify(`Room policy changed to ${policy}.`);
  }, [roomId, notify]);

  const moveBoardOnline = useCallback(async () => {
    if (cloudEnabledRef.current || movingOnline) return;
    const canvas = canvasRef.current;
    if (!canvas) {
      setShareMessage('Wait until the canvas is ready before moving it online.');
      return;
    }
    setMovingOnline(true);
    setShareMessage('Creating a secured cloud room…');
    try {
      // Keep the original local snapshot. A failed upload must not destroy art.
      persist(canvas);
      const state = JSON.parse(snapshot(canvas)) as Record<string, unknown>
        & { objects: unknown[] };
      const room = await createCloudRoom();
      const stored = saveOwnerAccess(room);
      setShareMessage('Uploading your artwork to Redis…');
      await uploadLocalDocument(room, state);
      const previous = getBoards().find((board) => board.id === roomId);
      try {
        const value = localStorage.getItem(`sketchtogether:canvas:${roomId}`);
        if (value) localStorage.setItem(`sketchtogether:canvas:${room.id}`, value);
        const paper = localStorage.getItem(`sketchtogether:paper:${roomId}`);
        if (paper) localStorage.setItem(`sketchtogether:paper:${room.id}`, paper);
      } catch {
        // Redis has acknowledged the artwork. Local quota cannot cancel the upload.
      }
      touchBoard(room.id, {
        title: title || previous?.title || 'Untitled board',
        template: previous?.template || 'blank',
        mode: 'cloud',
      });
      const link = `/room/${encodeURIComponent(room.id)}`;
      // The newly created HttpOnly cookie also authorizes the first load.
      if (!stored) {
        window.location.assign(`${link}#access=${encodeURIComponent(room.token)}`);
      } else {
        window.location.assign(link);
      }
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'Unknown error';
      setShareMessage(`Could not move online: ${reason}. Local artwork is still safe.`);
    } finally {
      setMovingOnline(false);
    }
  }, [movingOnline, persist, roomId, title]);

  const generateShareLink = useCallback(async () => {
    if (!cloudEnabledRef.current) {
      setShareMessage('This board exists only on your device. '
        + 'Choose Move to cloud first.');
      return;
    }
    setShareBusy(true);
    setShareMessage('');
    setShareUrl('');
    try {
      const url = await editorInviteUrl(roomId);
      setShareUrl(url);
      setShareMessage('Invitation ready. Only people with this link can edit.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      setShareMessage(`Could not generate invitation: ${message}`);
    } finally {
      setShareBusy(false);
    }
  }, [roomId]);

  const copyShareLink = useCallback(async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setShareMessage('Private invitation copied successfully.');
    } catch {
      setShareMessage('Clipboard blocked. Select the link above and copy manually.');
    }
  }, [shareUrl]);

  const exportBoard = useCallback((format: 'png' | 'svg' | 'json') => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const base = (title.trim() || 'sketchtogether-board')
      .replace(/[^a-zA-Z0-9_-]+/g, '-')
      .slice(0, 50);
    try {
      if (format === 'json') saveBlob(snapshot(canvas), 'application/json', `${base}.json`);
      if (format === 'svg' || format === 'png') {
        const oldBackground = canvas.backgroundColor;
        try {
          canvas.backgroundColor = '#fffdfa'; canvas.requestRenderAll();
          if (format === 'svg') saveBlob(canvas.toSVG(), 'image/svg+xml', `${base}.svg`);
          if (format === 'png') {
            const url = canvas.toDataURL({ format: 'png', multiplier: 2 });
            const link = document.createElement('a');
            link.href = url;
            link.download = `${base}.png`;
            link.click();
          }
        } finally { canvas.backgroundColor = oldBackground; canvas.requestRenderAll(); }
      }
      setMenuOpen(false); notify(`${format.toUpperCase()} downloaded.`);
    } catch { notify('Export failed. Try downloading the JSON backup instead.'); }
  }, [title, notify]);

  const importBoard = useCallback(async (file?: File) => {
    const canvas = canvasRef.current;
    if (!file || !canvas) return;
    if (file.size > 4_500_000) { notify('This board file is too large (max 4.5MB).'); return; }
    try {
      const incoming = JSON.parse(await file.text()) as Record<string, unknown>;
      if (!incoming || !Array.isArray(incoming.objects)) throw new Error('Invalid board JSON');
      silentRef.current = true;
      await canvas.loadFromJSON(incoming);
      restorePaintCompositing(canvas);
      canvas.backgroundColor = 'transparent';
      rerouteAllRef.current?.();
      canvas.requestRenderAll();
      changeTool(toolRef.current);
      silentRef.current = false;
      recordHistory(canvas);
      persist(canvas);
      commitReplacement(canvas);
      notify('Board imported.');
    } catch { notify('Could not open that board JSON file.'); }
    finally {
      silentRef.current = false;
      if (boardInputRef.current) boardInputRef.current.value = '';
    }
  }, [changeTool, recordHistory, persist, commitReplacement, notify]);

  const addSticker = useCallback(async (id: StickerId) => {
    const canvas = canvasRef.current;
    if (!canvas || !ready) return;

    try {
      // Same-origin vector assets become normal, movable Fabric images.
      const imageUrl = await stickerPngDataUrl(stickerUrl(id));
      const image = await FabricImage.fromURL(imageUrl);
      if (!canvasRef.current) return;

      image.scaleToWidth(120);
      (image as Obj & { stickerId?: string }).stickerId = id;
      const matrix = canvas.viewportTransform;
      const centerX = (canvas.width / 2 - matrix[4]) / matrix[0];
      const centerY = (canvas.height / 2 - matrix[5]) / matrix[3];
      image.set({
        left: centerX - image.getScaledWidth() / 2,
        top: centerY - image.getScaledHeight() / 2,
      });
      ensureId(image as Obj);
      canvas.add(image);
      changeTool('select');
      canvas.setActiveObject(image);
      canvas.requestRenderAll();
      notify('Sticker placed! Drag it, resize it, or give it a twist.');
    } catch {
      notify('Could not load that sticker. Try another one.');
    }
  }, [changeTool, notify, ready]);

  const uploadImage = useCallback(async (file?: File) => {
    const canvas = canvasRef.current;
    if (!file || !canvas) return;
    const supportedImageTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
    if (!supportedImageTypes.includes(file.type)) {
      notify('Choose a PNG, JPEG, WebP or GIF image.');
      return;
    }
    if (file.size > 1_500_000) {
      notify('Use an image under 1.5MB to keep the board lightweight.');
      return;
    }
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const optimizedUrl = await new Promise<string>((resolve) => {
        const preview = new Image();
        preview.onload = () => {
          try {
            const scale = Math.min(1, 1400 / Math.max(preview.naturalWidth, preview.naturalHeight));
            const surface = document.createElement('canvas');
            surface.width = Math.max(1, Math.round(preview.naturalWidth * scale));
            surface.height = Math.max(1, Math.round(preview.naturalHeight * scale));
            surface.getContext('2d')?.drawImage(preview, 0, 0, surface.width, surface.height);
            resolve(surface.toDataURL('image/webp', 0.82));
          } catch { resolve(dataUrl); }
        };
        preview.onerror = () => resolve(dataUrl);
        preview.src = dataUrl;
      });
      const image = await FabricImage.fromURL(optimizedUrl);
      if (!canvasRef.current) return;
      const factor = Math.min(1, 400 / Math.max(image.width || 400, image.height || 400));
      image.set({ left: 220, top: 150, scaleX: factor, scaleY: factor });
      ensureId(image as Obj); canvas.add(image); canvas.requestRenderAll();
      changeTool('select');
      canvas.setActiveObject(image);
      notify('Image added. Drag its corners to resize.');
    } catch { notify('This image could not be opened.'); }
    finally { if (imageInputRef.current) imageInputRef.current.value = ''; }
  }, [changeTool, notify]);

  useEffect(() => {
    mountedRef.current = true;
    if (
      !stageRef.current
      || !canvasElementRef.current
      || !rasterPreviewRef.current
      || !/^[a-zA-Z0-9_-]{8,32}$/.test(roomId)
    ) return;
    clientIdRef.current = `guest-${crypto.randomUUID().replaceAll('-', '').slice(0, 15)}`;
    try {
      const cached = localStorage.getItem(PENDING_PREFIX + roomId);
      if (cached) {
        const data = JSON.parse(cached);
        if (Array.isArray(data.queue)) {
          queueRef.current = data.queue;
          acknowledgedRef.current = data.acknowledged || {};
          needsRefreshRef.current = true;
        }
      }
    } catch { /* private browsing may disable persistent recovery */ }
    const stage = stageRef.current;
    const preview = rasterPreviewRef.current;
    preview.width = stage.clientWidth;
    preview.height = stage.clientHeight;
    const previewContext = preview.getContext('2d');
    const clearPaintPreview = () => {
      previewContext?.clearRect(0, 0, preview.width, preview.height);
    };
    const canvas = new Canvas(canvasElementRef.current, {
      width: stage.clientWidth, height: stage.clientHeight, backgroundColor: 'transparent',
      isDrawingMode: true, selection: false, skipTargetFind: true,
      preserveObjectStacking: true,
    });
    canvasRef.current = canvas;
    canvas.freeDrawingBrush = new PencilBrush(canvas);
    updateBrush(canvas);
    let disposed = false;

    let resizeObserver: ResizeObserver | null = null;

    const makeChange = (kind: RemoteOperation['kind'], obj?: Obj) => {
      if (!silentRef.current) commit(kind, obj);
    };

    const nodeForPoint = (point: XY): Obj | undefined => {
      return (canvas.getObjects() as Obj[]).slice().reverse().find((obj) => {
        if (obj.connector || obj.visible === false) return false;
        const box = obj.getBoundingRect();
        const pad = 18;
        return point.x >= box.left - pad && point.x <= box.left + box.width + pad
          && point.y >= box.top - pad && point.y <= box.top + box.height + pad;
      });
    };

    const centerOf = (object: Obj): XY => {
      const box = object.getBoundingRect();
      return { x: box.left + box.width / 2, y: box.top + box.height / 2 };
    };

    const pathFor = (meta: ConnectorMeta): string => {
      const objects = canvas.getObjects() as Obj[];
      const source = objects.find((obj) => obj.id === meta.fromId);
      const destination = objects.find((obj) => obj.id === meta.toId);
      const startTarget = destination ? centerOf(destination) : meta.to;
      const endTarget = source ? centerOf(source) : meta.from;
      const from = source ? edgeAnchor(source.getBoundingRect(), startTarget) : meta.from;
      const to = destination ? edgeAnchor(destination.getBoundingRect(), endTarget) : meta.to;
      return connectorPath(from, to, meta.route);
    };

    const replaceConnector = (current: Obj) => {
      if (!current.connector) return;
      const index = canvas.getObjects().indexOf(current);
      if (index < 0) return;
      const connection = new Path(pathFor(current.connector), {
        stroke: typeof current.stroke === 'string' ? current.stroke : '#292923',
        strokeWidth: current.strokeWidth || 3,
        fill: '',
        objectCaching: false,
        selectable: toolRef.current === 'select',
        evented: toolRef.current === 'select',
      }) as Obj;
      connection.id = ensureId(current);
      connection.connector = current.connector;
      const previousSilent = silentRef.current;
      silentRef.current = true;
      canvas.remove(current);
      canvas.insertAt(index, connection);
      silentRef.current = previousSilent;
    };

    const redrawAttached = (id: string) => {
      const affected = (canvas.getObjects() as Obj[]).filter((obj) =>
        obj.connector?.fromId === id || obj.connector?.toId === id);
      // Connector path is derived from endpoint IDs: don't create network writes
      // that would conflict when two people move different attached nodes.
      affected.forEach((item) => replaceConnector(item));
      if (affected.length) canvas.requestRenderAll();
    };

    const rerouteAll = () => {
      const connectors = (canvas.getObjects() as Obj[]).filter((obj) => obj.connector);
      connectors.forEach((item) => replaceConnector(item));
      if (connectors.length) canvas.requestRenderAll();
    };
    rerouteAllRef.current = rerouteAll;
    const onAdded = ({ target }: { target: FabricObject }) => {
      if (silentRef.current || !target) return;
      // Free drawing generates a path:created event; send only once.
      if (canvas.isDrawingMode && ['path', 'group'].includes(target.type)) return;
      ensureId(target as Obj); makeChange('add', target as Obj);
    };
    const onRemoved = ({ target }: { target: FabricObject }) => {
      if (!silentRef.current && target) {
        makeChange('remove', target as Obj);
        const id = (target as Obj).id;
        if (id) redrawAttached(id);
      }
    };
    canvas.on('object:added', onAdded);
    canvas.on('object:removed', onRemoved);
    let lastReroute = 0;
    canvas.on('object:moving', ({ target }) => {
      if (!target) return;
      const id = (target as Obj).id;
      if (id && gestureVersionsRef.current[id] === undefined) {
        gestureVersionsRef.current[id] = cloudVersionsRef.current[id] ?? -1;
      }
      if (Date.now() - lastReroute < 50) return;
      lastReroute = Date.now();
      if (id) redrawAttached(id);
    });
    canvas.on('object:scaling', ({ target }) => {
      if (!target) return;
      const id = (target as Obj).id;
      if (id && gestureVersionsRef.current[id] === undefined) {
        gestureVersionsRef.current[id] = cloudVersionsRef.current[id] ?? -1;
      }
    });
    canvas.on('object:rotating', ({ target }) => {
      if (!target) return;
      const id = (target as Obj).id;
      if (id && gestureVersionsRef.current[id] === undefined) {
        gestureVersionsRef.current[id] = cloudVersionsRef.current[id] ?? -1;
      }
    });
    canvas.on('text:editing:entered', ({ target }) => {
      const id = (target as Obj | undefined)?.id;
      if (id) editingIdsRef.current.add(id);
      if (id && gestureVersionsRef.current[id] === undefined) {
        gestureVersionsRef.current[id] = cloudVersionsRef.current[id] ?? -1;
      }
    });
    canvas.on('text:editing:exited', ({ target }) => {
      const id = (target as Obj | undefined)?.id;
      if (id) {
        editingIdsRef.current.delete(id);
        delete gestureVersionsRef.current[id];
      }
    });
    canvas.on('object:modified', ({ target }) => {
      if (!target) return;
      const curve = target as Obj;
      const vectorNodes = curve.vectorNodes;
      if (vectorNodes?.length === 3 && curve instanceof Path) {
        const matrix = curve.calcTransformMatrix();
        const nodes = vectorNodes.map((node) => {
          const position = util.transformPoint(new Point(
            node.x - curve.pathOffset.x,
            node.y - curve.pathOffset.y,
          ), matrix);
          return { x: position.x, y: position.y };
        });
        const replacement = curveObject(nodes, curve);
        const at = canvas.getObjects().indexOf(curve);
        if (at < 0) return;
        silentRef.current = true;
        try {
          canvas.discardActiveObject();
          canvas.remove(curve);
          canvas.insertAt(at, replacement);
          canvas.setActiveObject(replacement);
          canvas.requestRenderAll();
        } finally {
          silentRef.current = false;
        }
        setSelectedCurveNodes(nodes);
        rerouteAll();
        makeChange('modify', replacement);
        return;
      }
      if (target.type === 'activeselection') {
        canvas.getActiveObjects().forEach((obj) => {
          makeChange('modify', obj as Obj);
          if ((obj as Obj).id) redrawAttached((obj as Obj).id!);
        });
      }
      else makeChange('modify', target as Obj);
      const changed = (target as Obj).id;
      if (changed) {
        redrawAttached(changed);
        persist(canvas);
      }
    });
    canvas.on('text:changed', ({ target }) => { if (target) makeChange('modify', target as Obj); });
    const updateSelection = () => {
      refreshLayers(canvas);
      const selected = canvas.getActiveObject() as Obj | undefined;
      setSelectedCurveNodes(selected?.vectorNodes?.map((node) => ({ ...node })) || null);
      setSelectedCurveClosed(Boolean(selected?.curveClosed));
    };
    canvas.on('selection:created', updateSelection);
    canvas.on('selection:updated', updateSelection);
    canvas.on('selection:cleared', updateSelection);
    canvas.on('path:created', ({ path }) => {
      if (!path) return;
      ensureId(path as Obj);
      makeChange('add', path as Obj);
    });

    let drawingShape: Obj | null = null;
    let start: Point | null = null;
    let connectionPreview: Line | null = null;
    let connectionEnd: XY | null = null;
    let draggingPan = false;
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
    let lastPressureFrame = 0;
    let lastPosition = { x: 0, y: 0 };
    const pointer = (e: MouseEvent | PointerEvent | TouchEvent) => canvas.getScenePoint(e);
    const onDown = ({ e }: { e: MouseEvent | PointerEvent | TouchEvent }) => {
      const mode = toolRef.current;
      if (mode === 'hand') {
        draggingPan = true;
        lastPosition = { x: 'clientX' in e ? e.clientX : 0, y: 'clientY' in e ? e.clientY : 0 };
        canvas.defaultCursor = 'grabbing'; return;
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
        const position = pointer(e);
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
      start = pointer(e);
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
      if (liveRoomRef.current && now - cursorThrottleRef.current > 110 &&
        'clientX' in e) {
        cursorThrottleRef.current = now;
        const point = pointer(e);
        void liveRoomRef.current?.send('cursor:move', {
          sender: clientIdRef.current,
          x: point.x,
          y: point.y,
          name: displayNameRef.current,
        });
      }
      if (draggingPan && 'clientX' in e) {
        canvas.relativePan(new Point(e.clientX - lastPosition.x, e.clientY - lastPosition.y));
        lastPosition = { x: e.clientX, y: e.clientY };
        canvas.requestRenderAll();
        setViewportTick((previous) => previous + 1);
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
        const candidate = pointer(e);
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
      const p = pointer(e);
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
    canvas.on('mouse:down', onDown);
    canvas.on('mouse:move', onMove);
    canvas.on('mouse:up', onUp);

    function cursorColor(id: string) {
      let hash = 0; for (let i = 0; i < id.length; i++) hash = ((hash * 31) + id.charCodeAt(i)) | 0;
      return CURSOR_COLORS[Math.abs(hash) % CURSOR_COLORS.length];
    }
    async function applyRemote(event: RemoteOperation) {
      if (event.sender === clientIdRef.current || disposed) return;
      if (cloudEnabledRef.current) {
        // Broadcast is an untrusted notification, never the source of truth.
        // A collaborator can only change a cloud board through authorized Redis ops.
        if (!Number.isSafeInteger(event.revision) || event.revision! < 1) return;
        if (event.revision! <= cloudRevisionRef.current && !needsRefreshRef.current) {
          return;
        }
        needsRefreshRef.current = true;
        if (!remoteRefreshTimerRef.current) {
          remoteRefreshTimerRef.current = setTimeout(() => {
            remoteRefreshTimerRef.current = null;
            if (!disposed && queueRef.current.length === 0) void loadCloud();
          }, 300);
        }
        return;
      }
      silentRef.current = true;
      try {
        if (event.kind === 'clear') { canvas.clear(); canvas.backgroundColor = 'transparent'; }
        else if (event.kind === 'replace' && event.state && Array.isArray(event.state.objects)) {
          await canvas.loadFromJSON(event.state);
          restorePaintCompositing(canvas);
          canvas.backgroundColor = 'transparent';
          rerouteAll();
        } else if (event.kind === 'remove' && event.id) {
          const object = canvas.getObjects().find(o => (o as Obj).id === event.id);
          if (object) canvas.remove(object);
        } else if ((event.kind === 'add' || event.kind === 'modify') && event.object) {
          const id = typeof event.object.id === 'string' ? event.object.id : '';
          if (!id) return;
          const current = canvas.getObjects().find(o => (o as Obj).id === id);
          const position = current ? canvas.getObjects().indexOf(current)
            : canvas.getObjects().length;
          if (current) canvas.remove(current);
          const objects = await util.enlivenObjects<Obj>([event.object]);
          objects.forEach((obj) => {
            obj.id = id;
            if (isRasterLayer(obj)) {
              obj.set({
                globalCompositeOperation: obj.rasterLayer.blend,
                selectable: false,
                evented: false,
              });
            }
            canvas.insertAt(position, obj);
          });
          redrawAttached(id);
        }
        if (disposed) return;
        canvas.requestRenderAll();
        // Collaborative edits are checkpointed, but not appended to the local undo stack.
        historyRef.current = { past: [snapshot(canvas)], future: [] };
        updateHistoryUI();
        refreshLayers(canvas);
        persist(canvas);
        if (cloudEnabledRef.current) setSaveStatus('Cloud synced · object-level changes');
      } catch (error) { console.warn('Could not apply remote drawing event', error); }
      finally { silentRef.current = false; }
    }

    async function initialize() {
      silentRef.current = true;
      let storedState: Record<string, unknown> | null = null;
      try {
        const saved = localStorage.getItem(LOCAL_PREFIX + roomId);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed?.state && Array.isArray(parsed.state.objects)) {
            storedState = parsed.state;
          }
        }
      } catch { /* local storage disabled */ }
      try {
        const configResult = await fetch('/api/config', { cache: 'no-store' });
        const config = configResult.ok
          ? await configResult.json() as { realtime: boolean; persistence: boolean }
          : { realtime: false, persistence: false };
        const wantsLocal = new URLSearchParams(location.search).get('local') === '1';
        if (config.persistence && !wantsLocal) {
          const accessGranted = await enterRoom(roomId);
          if (!accessGranted) {
            setLocked(true);
            setSaveStatus('Private room · invitation needed');
            silentRef.current = false;
            return;
          }
          const result = await fetch(`/api/sync/${encodeURIComponent(roomId)}`, {
            cache: 'no-store',
          });
          if (result.ok) {
            const remote = await result.json();
            cloudEnabledRef.current = true;
            setCloudEnabled(true);
            touchBoard(roomId, { mode: 'cloud' });
            cloudRevisionRef.current = remote.revision;
            cloudVersionsRef.current = remote.versions || {};
            if (remote.policy === 'protected' || remote.policy === 'classic') {
              syncPolicyRef.current = remote.policy;
              setSyncPolicy(remote.policy);
            }
            // Never prefer a newer wall-clock timestamp over an authoritative revision.
            if ((remote.revision > 0 || remote.state?.objects?.length) &&
              queueRef.current.length === 0) {
              storedState = remote.state;
            }
          } else {
            setLocked(true);
            setSaveStatus('Private room · access not available');
            silentRef.current = false;
            return;
          }
        }
        if (storedState) {
          await canvas.loadFromJSON(storedState);
          restorePaintCompositing(canvas);
          canvas.backgroundColor = 'transparent';
          rerouteAll();
        } else {
          const query = new URLSearchParams(window.location.search);
          const template = validTemplate(query.get('template'));
          seedTemplate(canvas, template);
        }
        if (disposed) return;
        canvas.requestRenderAll();
        silentRef.current = false;
        historyRef.current = { past: [snapshot(canvas)], future: [] };
        updateHistoryUI();
        changeTool(toolRef.current);
        refreshLayers(canvas);
        setReady(true);
        setSaveStatus(cloudEnabledRef.current
          ? 'Redis cloud room ready · durable backups run separately'
          : 'Local board · saved on this device only');
        // New template needs to be persisted so visiting the room again preserves it.
        if (queueRef.current.length > 0 && cloudEnabledRef.current) {
          setSaveStatus('Recovering locally saved changes…');
          void flushCloud();
        } else if (!storedState) {
          persist(canvas);
          if (cloudEnabledRef.current) commitReplacement(canvas);
        } else if (cloudEnabledRef.current && cloudRevisionRef.current === 0) {
          // A pre-existing local board can initialize an empty cloud room once.
          commitReplacement(canvas);
        }

        if (config.realtime && cloudEnabledRef.current) {
          const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
          const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
          if (url && key) {
            setHasRealtime(true);
            const room = connectLiveRoom(
              roomId,
              clientIdRef.current,
              displayNameRef.current,
              {
                onConnected(active) {
                  if (disposed) return;
                  setConnected(active);
                  if (active) {
                    void flushCloud();
                    void loadCloud();
                  }
                },
                onBoard(payload) {
                  remoteQueueRef.current = remoteQueueRef.current
                    .then(() => applyRemote(payload as RemoteOperation))
                    .catch((error) => console.warn('Room event failed', error));
                },
                onCursor(payload) {
                  const point = payload as {
                    sender?: string;
                    x?: number;
                    y?: number;
                    name?: string;
                  };
                  if (disposed || !point || point.sender === clientIdRef.current ||
                    !point.sender || !Number.isFinite(point.x) ||
                    !Number.isFinite(point.y)) return;
                  setCursors((previous) => ({
                    ...previous,
                    [point.sender!]: {
                      x: point.x!,
                      y: point.y!,
                      name: point.name?.slice(0, 22) || `Guest ${point.sender!.slice(-4)}`,
                      color: cursorColor(point.sender!),
                      lastSeen: Date.now(),
                    },
                  }));
                },
                onReaction(payload) {
                  const event = payload as { sender?: string; emoji?: string };
                  if (!disposed && event?.sender !== clientIdRef.current && event?.emoji) {
                    showReaction(event.emoji);
                  }
                },
                onPeople(names) {
                  if (disposed) return;
                  setPeople(names);
                  setOnline(Math.max(1, names.length));
                },
              },
              url,
              key,
            );
            if (disposed) void room.close();
            else liveRoomRef.current = room;
          }
        }
      } catch (error) {
        console.error('Failed to open board', error);
        silentRef.current = false;
        setHasRealtime(false);
        setSaveStatus('Offline · browser storage only');
        setReady(true);
        refreshLayers(canvas);
        historyRef.current = { past: [snapshot(canvas)], future: [] };
        updateHistoryUI();
        notify('Online services unavailable. You can still draw locally.');
      }
    }
    void initialize();
    resizeObserver = new ResizeObserver(() => {
      if (disposed) return;
      preview.width = stage.clientWidth;
      preview.height = stage.clientHeight;
      setViewportTick((previous) => previous + 1);
      canvas.setDimensions({ width: stage.clientWidth, height: stage.clientHeight });
      canvas.requestRenderAll();
    });
    resizeObserver.observe(stage);
    const syncPoll = window.setInterval(() => {
      if (!disposed && cloudEnabledRef.current && !document.hidden) {
        if (queueRef.current.length) void flushCloud();
        else void loadCloud();
      }
    }, 8000);
    const prune = window.setInterval(() => setCursors(prev => {
      const fresh = Object.fromEntries(
        Object.entries(prev).filter(([, cursor]) => Date.now() - cursor.lastSeen < 5000),
      );
      return Object.keys(prev).length === Object.keys(fresh).length ? prev : fresh;
    }), 2500);
    const localBoard = getBoards().find(b => b.id === roomId);
    setTitle(localBoard?.title || 'Untitled board');
    // Boards appear in the recent list after authorization and successful load.

    return () => {
      disposed = true; mountedRef.current = false;
      clearInterval(prune);
      clearInterval(syncPoll);
      reactionTimersRef.current.forEach(clearTimeout);
      reactionTimersRef.current.clear();
      if (flushTimerRef.current) clearTimeout(flushTimerRef.current);
      if (remoteRefreshTimerRef.current) clearTimeout(remoteRefreshTimerRef.current);
      resizeObserver?.disconnect();
      void liveRoomRef.current?.close();
      liveRoomRef.current = null;
      canvasRef.current = null;
      rerouteAllRef.current = null;
      void canvas.dispose();
    };
  // Core canvas must be created only when the room id changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (target.closest('input,textarea,[contenteditable="true"]') || modal) return;
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
      if (key === '?' ) setModal('shortcuts');
      if (key === 'escape') {
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
  ]);

  const cursorToScreen = (c: Cursor) => {
    const transform = canvasRef.current?.viewportTransform;
    if (!transform) return { left: c.x, top: c.y };
    return {
      left: c.x * transform[0] + c.y * transform[2] + transform[4],
      top: c.x * transform[1] + c.y * transform[3] + transform[5],
    };
  };

  if (locked) {
    return (
      <main className="room-locked">
        <img src="/art/room/first-mark.svg" alt="" width="185" height="150" />
        <h1>This sketch is private.</h1>
        <p>Open a valid invitation link to draw here. Existing local drawings are untouched.</p>
        <a href="/">Return to the sketchbook</a>
      </main>
    );
  }

  return (
    <div className="studio">
      <header className="studio-header">
        <div className="studio-left">
          <a href="/" className="studio-logo" title="Go to the start page">
            <span>s.</span>
            <span>sketchtogether</span>
          </a>
          <img
            src="/art/room/room-spark.svg"
            className="room-header-illustration"
            alt=""
          />
          <div className="header-separator" />
          <div className="board-info">
            <input
              aria-label="Board name"
              className="board-name"
              value={title}
              maxLength={65}
              onChange={(event) => {
                setTitle(event.target.value);
                touchBoard(roomId, { title: event.target.value });
              }}
            />
            <span className="save-caption">
              <span
                className={`status-dot ${saveStatus.includes('Saving') ? 'unsaved' : ''}`}
              />
              {saveStatus}
            </span>
          </div>
        </div>

        <div className="studio-right">
          <button
            className={`icon-btn bordered palette-toggle ${panelOpen ? 'palette-open' : ''}`}
            title={panelOpen ? 'Hide the studio drawer' : 'Show the studio drawer'}
            aria-label={panelOpen ? 'Hide the studio drawer' : 'Show the studio drawer'}
            aria-pressed={panelOpen}
            onClick={() => setPanelOpen((current) => !current)}
          >
            <StudioIcon name="palette" size={18} />
          </button>
          <span
            className={`live-badge ${!connected ? 'offline' : ''}`}
            title={hasRealtime
              ? (connected ? 'Realtime connection active' : 'Realtime disconnected')
              : cloudEnabled ? 'Redis room active; Supabase live transport is offline'
                : 'This board exists on this device only'}
          >
            <span className="status-dot" />
            {connected ? `${online} online`
              : cloudEnabled ? (hasRealtime ? 'Realtime reconnecting' : 'Redis cloud')
                : 'Local-only board'}
          </span>
          <div className="room-sync-controls" role="group" aria-label="Collaboration policy">
            <button
              type="button"
              title="Protected: reject collisions on the same object (needs Upstash)."
              aria-pressed={syncPolicy === 'protected'}
              disabled={!cloudEnabled}
              onClick={() => {
                void changeRoomPolicy('protected');
              }}
            >
              Protected
            </button>
            <button
              type="button"
              title="Classic: the last accepted edit to an object takes precedence."
              aria-pressed={syncPolicy === 'classic' || !cloudEnabled}
              onClick={() => {
                void changeRoomPolicy('classic');
              }}
            >
              Classic
            </button>
          </div>
          <button
            className="room-presence-button"
            title={connected ? people.join(', ') : 'Edit your guest name'}
            onClick={() => setModal('profile')}
          >
            <span className="presence-inkdot">✳</span>
            <span className="presence-text">{displayName}</span>
          </button>
          <button
            title="Undo (Ctrl+Z)"
            className="icon-btn"
            disabled={!historyState.undo}
            onClick={() => void restoreHistory('undo')}
          >
            <StudioIcon name="undo" size={18} />
          </button>
          <button
            title="Redo (Ctrl+Shift+Z)"
            className="icon-btn"
            disabled={!historyState.redo}
            onClick={() => void restoreHistory('redo')}
          >
            <StudioIcon name="redo" size={18} />
          </button>
          <div className="room-reaction-actions" aria-label="Send a quick reaction">
            {REACTIONS.map((emoji) => (
              <button
                key={emoji}
                title={connected ? 'React to everyone' : 'React locally'}
                aria-label={`Send ${emoji} reaction`}
                onClick={() => sendReaction(emoji)}
              >
                {emoji}
              </button>
            ))}
          </div>
          <button
            className="studio-action"
            onClick={() => setModal('share')}
            title="Share board"
          >
            <StudioIcon name="share" size={17} />
            <span className="share-text">Share</span>
          </button>
          <button
            className="icon-btn bordered"
            title="More options"
            aria-label="More options"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((current) => !current)}
          >
            <StudioIcon name="dots" size={19} />
          </button>
        </div>

        {menuOpen && (
          <div className="file-menu" role="menu">
            <button role="menuitem" onClick={() => exportBoard('png')}>
              <StudioIcon name="download" size={17} /> Download PNG
            </button>
            <button role="menuitem" onClick={() => exportBoard('svg')}>
              <StudioIcon name="download" size={17} /> Download SVG
            </button>
            <button role="menuitem" onClick={() => exportBoard('json')}>
              <StudioIcon name="save" size={17} /> Download editable board
            </button>
            <button role="menuitem" onClick={() => void backupNow()}>
              <StudioIcon name="save" size={17} /> Back up to Supabase
            </button>
            <button role="menuitem" onClick={() => void revokeInvitations()}>
              <StudioIcon name="lock" size={17} /> Revoke editor invitations
            </button>
            <button
              role="menuitem"
              onClick={() => {
                setMenuOpen(false);
                boardInputRef.current?.click();
              }}
            >
              <StudioIcon name="upload" size={17} /> Import board JSON
            </button>
            <button
              role="menuitem"
              onClick={() => {
                fitToDrawing();
                setMenuOpen(false);
              }}
            >
              <StudioIcon name="fit" size={17} /> Fit artwork to view
            </button>
            <hr />
            <button
              role="menuitem"
              disabled={!cloudEnabled}
              onClick={() => {
                void changeRoomPolicy('protected');
                setMenuOpen(false);
              }}
            >
              <StudioIcon name="lock" size={17} /> Protected collaboration
            </button>
            <button
              role="menuitem"
              onClick={() => {
                void changeRoomPolicy('classic');
                setMenuOpen(false);
              }}
            >
              <StudioIcon name="users" size={17} /> Classic collaboration
            </button>
            <hr />
            <button
              role="menuitem"
              onClick={() => {
                setMenuOpen(false);
                setModal('profile');
              }}
            >
              <StudioIcon name="users" size={17} /> Your guest name
            </button>
            <button
              role="menuitem"
              onClick={() => {
                sendReaction('✨');
                setMenuOpen(false);
              }}
            >
              <StudioIcon name="spark" size={17} /> Send a sparkle
            </button>
            <button
              role="menuitem"
              onClick={() => {
                sendReaction('👏');
                setMenuOpen(false);
              }}
            >
              <StudioIcon name="spark" size={17} /> Send applause
            </button>
            <button
              role="menuitem"
              onClick={() => {
                setMenuOpen(false);
                setModal('shortcuts');
              }}
            >
              <StudioIcon name="keyboard" size={17} /> Shortcuts & help
            </button>
            <button
              role="menuitem"
              className="danger"
              onClick={() => {
                setMenuOpen(false);
                setModal('clear');
              }}
            >
              <StudioIcon name="trash" size={17} /> Clear board
            </button>
          </div>
        )}
      </header>

      <div className="studio-workspace">
        <div ref={stageRef} className={`canvas-stage paper-${paper}`}>
          <canvas ref={canvasElementRef} aria-label="Editable whiteboard canvas" />
          <canvas ref={rasterPreviewRef} className="raster-stroke-preview" aria-hidden="true" />
          {tool === 'select' && selectedCurveNodes && (
            <CurveHandles
              key={`${selectedCurveNodes.length}-${viewportTick}`}
              nodes={selectedCurveNodes}
              screen={selectedCurveNodes.map((node) => {
                const transform = canvasRef.current?.viewportTransform;
                const point = transform
                  ? util.transformPoint(new Point(node.x, node.y), transform)
                  : new Point(node.x, node.y);
                return { x: point.x, y: point.y };
              })}
              screenToWorld={(point) => {
                const transform = canvasRef.current?.viewportTransform;
                const result = transform
                  ? util.transformPoint(new Point(point.x, point.y),
                    util.invertTransform(transform))
                  : new Point(point.x, point.y);
                return { x: result.x, y: result.y };
              }}
              onCommit={replaceCurveNodes}
            />
          )}
          {ready && layers.length === 0 && (
            <div className="room-empty-hint" aria-hidden="true">
              <img src="/art/room/first-mark.svg" alt="" />
              <p>Your first mark goes here.</p>
              <span>Pick up a pencil, drop a note, or peel a sticker.</span>
            </div>
          )}
          <ReactionBursts bursts={bursts} />
          {Object.entries(cursors).map(([id, cursor]) => (
            <div
              key={id}
              className="cursor-overlay"
              style={{
                ...cursorToScreen(cursor),
                '--cursor': cursor.color,
              } as CSSProperties}
            >
              <span className="cursor-pointer" />
              <span className="cursor-label">{cursor.name}</span>
            </div>
          ))}
        </div>

        <RoomToolRail
          tool={tool}
          ready={ready}
          onTool={changeTool}
          onStickers={() => {
            setPanelTab('stickers');
            setPanelOpen(true);
          }}
          onImage={() => imageInputRef.current?.click()}
          onLayers={() => {
            setPanelTab('layers');
            setPanelOpen(true);
          }}
          onDelete={removeSelected}
        />

        <RoomDrawer
          open={panelOpen}
          tab={panelTab}
          onTab={setPanelTab}
          color={color}
          colors={COLORS}
          stroke={stroke}
          brushMode={brushMode}
          opacity={opacity}
          fill={fill}
          selectedCurveNodes={selectedCurveNodes}
          selectedCurveClosed={selectedCurveClosed}
          onCurveClosed={setCurveClosed}
          paintLayers={paintLayers}
          activePaintId={activePaintId}
          onAddPaintLayer={addPaintLayer}
          onSelectPaintLayer={selectPaintLayer}
          onPaintBlend={changePaintBlend}
          onRenamePaint={renamePaintLayer}
          onTogglePaint={togglePaintLayer}
          onDeletePaint={deletePaintLayer}
          onExportPaint={exportPaintLayer}
          onPaintTool={changeTool}
          onOpacity={changeOpacity}
          onFill={changeFill}
          onNode={updateCurveNode}
          paper={paper}
          connectorRoute={connectorRoute}
          onConnectorRoute={changeConnectorRoute}
          layers={layers}
          checkpoints={checkpoints}
          ready={ready}
          onBrush={changeBrushMode}
          onColor={changeColor}
          onStroke={changeStroke}
          onPaper={changePaper}
          onSticker={(id) => void addSticker(id)}
          onSelectLayer={focusLayer}
          onMoveLayer={moveLayer}
          onToggleLayer={toggleLayer}
          onDuplicate={() => void duplicateSelected()}
          onDelete={removeSelected}
          onSaveCheckpoint={createCheckpoint}
          onRestoreCheckpoint={(checkpoint) => void restoreCheckpoint(checkpoint)}
          onDeleteCheckpoint={deleteCheckpoint}
        />

        <div className="studio-bottom">
          <div className="room-bottom-info">
            <span className="tip-badge">
              {layers.length} pieces of an idea · keep going ✳
            </span>
          </div>
          <div className="zoom-controls">
            <button
              className="icon-btn"
              title="Zoom out"
              aria-label="Zoom out"
              onClick={() => zoomTo(zoom - 25)}
            >
              <StudioIcon name="minus" size={17} />
            </button>
            <span>{zoom}%</span>
            <button
              className="icon-btn"
              title="Zoom in"
              aria-label="Zoom in"
              onClick={() => zoomTo(zoom + 25)}
            >
              <StudioIcon name="plus" size={17} />
            </button>
            <button
              className="icon-btn fit-art-button"
              title="Fit artwork to view (Ctrl+0)"
              aria-label="Fit artwork to view"
              onClick={fitToDrawing}
            >
              <StudioIcon name="fit" size={17} />
            </button>
            <button
              className="icon-btn"
              title="Reset view"
              aria-label="Reset zoom and pan"
              onClick={resetView}
            >
              <StudioIcon name="fit" size={17} />
            </button>
          </div>
        </div>
        {syncWarning && (
          <div className="room-sync-alert" role="alert">
            <strong>Another pencil got there first.</strong>
            <p>{syncWarning}</p>
            <div>
              <button onClick={() => exportBoard('json')}>Download my local changes</button>
              <button onClick={() => void loadCloud(true)}>Load shared version</button>
            </div>
          </div>
        )}
        {toast && <div className="toast-msg" role="status">{toast}</div>}
      </div>

      <input
        ref={imageInputRef}
        className="upload-hidden"
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        aria-label="Upload image"
        onChange={(event: ChangeEvent<HTMLInputElement>) => {
          void uploadImage(event.target.files?.[0]);
        }}
      />
      <input
        ref={boardInputRef}
        className="upload-hidden"
        type="file"
        accept=".json,application/json"
        aria-label="Import board"
        onChange={(event: ChangeEvent<HTMLInputElement>) => {
          void importBoard(event.target.files?.[0]);
        }}
      />

      <RoomDialogs
        modal={modal}
        onClose={() => setModal(null)}
        onClear={clearBoard}
        onShare={() => void generateShareLink()}
        onCopyShare={() => void copyShareLink()}
        shareUrl={shareUrl}
        shareMessage={shareMessage}
        shareBusy={shareBusy}
        cloudEnabled={cloudEnabled}
        moveBusy={movingOnline}
        onMoveToCloud={() => void moveBoardOnline()}
        connected={connected}
        hasRealtime={hasRealtime}
        people={people}
        displayName={displayName}
        onDisplayName={setDisplayName}
        onSaveName={saveDisplayName}
      />
    </div>
  );
}
