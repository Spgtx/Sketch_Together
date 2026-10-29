'use client';
import type { Tool, Cursor } from './room-model';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { type LiveRoom } from '@/lib/realtime/supabase-room';
import { Canvas } from 'fabric';
import { DEFAULT_LAYOUT, isSavedComponent, type SavedComponent, type ComponentMeta, type LayoutSettings } from '@/lib/prototype-layout';
import type { TextStyle } from '@/components/editor/TextControls';
import { type PenNode } from '@/lib/advanced-vector';
import type { PaintLayerItem } from '@/components/editor/RasterToolsPanel';
import type { LayerItem } from '@/components/editor/LayersPanel';
import { type ReactionBurst } from '@/components/editor/ReactionBursts';
import { isPaperStyle, type PaperStyle } from '@/components/editor/PaperPicker';
import { type DrawerTab } from '@/components/editor/RoomDrawer';
import { type RoomDialog } from '@/components/editor/RoomDialogs';
import type { Checkpoint } from '@/components/editor/CheckpointsPanel';
import type { SyncChange, SyncPolicy } from '@/lib/sync-model';
import { type BrushPreset, type CurveNode } from '@/lib/art-strokes';
import { type ConnectorRoute } from '@/lib/connector-geometry';
import { COLORS } from './room-model';
export function useRoomBase() {
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
  
  const memberVersionsRef = useRef<Record<string, number>>({});
  
  const structureVersionsRef = useRef<Record<string, number>>({});
  
  const gestureVersionsRef = useRef<Record<string, number>>({});
  
  const editingIdsRef = useRef<Set<string>>(new Set());
  
  const rerouteAllRef = useRef<(() => void) | null>(null);
  
  const finishPenRef = useRef<(() => void) | null>(null);
  
  const cancelPenRef = useRef<(() => void) | null>(null);
  
  const gridSnapRef = useRef(false);
  
  const objectSnapRef = useRef(false);
  
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
  
  const [railOpen, setRailOpen] = useState(true);
  
  const [railSize, setRailSize] = useState(44);
  
  const [panelWidth, setPanelWidth] = useState(306);
  
  const [panelHeight, setPanelHeight] = useState(560);
  
  const [railHeight, setRailHeight] = useState(520);
  
  const [railWidth, setRailWidth] = useState(62);
  
  const [components, setComponents] = useState<SavedComponent[]>([]);
  
  const [layoutSettings, setLayoutSettings] = useState<LayoutSettings>(DEFAULT_LAYOUT);
  
  const [selectedComponent, setSelectedComponent] = useState<ComponentMeta | null>(null);
  
  const [groupMembers, setGroupMembers] = useState<Array<{
      id: string; name: string; fill: string; visible: boolean;
    }>>([]);
  
  const [gridSnap, setGridSnap] = useState(false);
  
  const [objectSnap, setObjectSnap] = useState(false);
  
  const [selectedPenNodes, setSelectedPenNodes] = useState<PenNode[] | null>(null);
  
  const [selectedText, setSelectedText] = useState<TextStyle | null>(null);
  
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
      try {
        const stored: unknown = JSON.parse(localStorage.getItem('sketch:components') || '[]');
        if (Array.isArray(stored)) setComponents(stored.filter(isSavedComponent).slice(0, 40));
      } catch { /* unavailable on some browsers */ }
    }, []);
  
  useEffect(() => {
      // On small screens the canvas should be visible before the tool drawer.
      if (window.matchMedia('(max-width: 650px)').matches) {
        setPanelOpen(false);
      }
    }, []);
  
  useEffect(() => {
      try {
        const prefs = JSON.parse(localStorage.getItem('sketch:editor-layout') || '{}');
        if (typeof prefs.panelOpen === 'boolean') setPanelOpen(prefs.panelOpen);
        if (typeof prefs.railOpen === 'boolean') setRailOpen(prefs.railOpen);
        if (Number.isFinite(prefs.panelWidth)) {
          setPanelWidth(Math.max(230, Math.min(490, prefs.panelWidth)));
        }
        if (Number.isFinite(prefs.panelHeight)) {
          setPanelHeight(Math.max(260, Math.min(800, prefs.panelHeight)));
        }
        if (Number.isFinite(prefs.railHeight)) {
          setRailHeight(Math.max(180, Math.min(820, prefs.railHeight)));
        }
        if (Number.isFinite(prefs.railWidth)) {
          setRailWidth(Math.max(54, Math.min(112, prefs.railWidth)));
        }
        if (Number.isFinite(prefs.railSize)) {
          setRailSize(Math.max(34, Math.min(62, prefs.railSize)));
        }
      } catch { /* use defaults */ }
    }, []);
  
  useEffect(() => {
      try {
        localStorage.setItem('sketch:editor-layout', JSON.stringify({
          panelOpen, railOpen, panelWidth, panelHeight,
          railSize, railHeight, railWidth,
        }));
      } catch { /* private browsing may disable storage */ }
    }, [panelOpen, railOpen, panelWidth, panelHeight,
      railSize, railHeight, railWidth]);
  
  useEffect(() => { gridSnapRef.current = gridSnap; }, [gridSnap]);
  
  useEffect(() => { objectSnapRef.current = objectSnap; }, [objectSnap]);
  
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
  return {
    params,
    roomId,
    stageRef,
    canvasElementRef,
    rasterPreviewRef,
    activePaintIdRef,
    canvasRef,
    imageInputRef,
    boardInputRef,
    liveRoomRef,
    clientIdRef,
    toolRef,
    connectorRouteRef,
    cloudEnabledRef,
    syncPolicyRef,
    cloudRevisionRef,
    cloudVersionsRef,
    memberVersionsRef,
    structureVersionsRef,
    gestureVersionsRef,
    editingIdsRef,
    rerouteAllRef,
    finishPenRef,
    cancelPenRef,
    gridSnapRef,
    objectSnapRef,
    queueRef,
    acknowledgedRef,
    sendingRef,
    conflictedRef,
    needsRefreshRef,
    colorRef,
    strokeRef,
    brushModeRef,
    opacityRef,
    fillRef,
    displayNameRef,
    reactionTimersRef,
    silentRef,
    mountedRef,
    flushTimerRef,
    historyRef,
    cursorThrottleRef,
    remoteQueueRef,
    remoteRefreshTimerRef,
    tool,
    setTool,
    connectorRoute,
    setConnectorRoute,
    syncPolicy,
    setSyncPolicy,
    cloudEnabled,
    setCloudEnabled,
    locked,
    setLocked,
    syncWarning,
    setSyncWarning,
    color,
    setColor,
    stroke,
    setStroke,
    paper,
    setPaper,
    panelTab,
    setPanelTab,
    brushMode,
    setBrushMode,
    opacity,
    setOpacity,
    fill,
    setFill,
    selectedCurveNodes,
    setSelectedCurveNodes,
    selectedCurveClosed,
    setSelectedCurveClosed,
    paintLayers,
    setPaintLayers,
    activePaintId,
    setActivePaintId,
    viewportTick,
    setViewportTick,
    layers,
    setLayers,
    checkpoints,
    setCheckpoints,
    displayName,
    setDisplayName,
    people,
    setPeople,
    bursts,
    setBursts,
    panelOpen,
    setPanelOpen,
    railOpen,
    setRailOpen,
    railSize,
    setRailSize,
    panelWidth,
    setPanelWidth,
    panelHeight,
    setPanelHeight,
    railHeight,
    setRailHeight,
    railWidth,
    setRailWidth,
    components,
    setComponents,
    layoutSettings,
    setLayoutSettings,
    selectedComponent,
    setSelectedComponent,
    groupMembers,
    setGroupMembers,
    gridSnap,
    setGridSnap,
    objectSnap,
    setObjectSnap,
    selectedPenNodes,
    setSelectedPenNodes,
    selectedText,
    setSelectedText,
    title,
    setTitle,
    connected,
    setConnected,
    online,
    setOnline,
    hasRealtime,
    setHasRealtime,
    ready,
    setReady,
    saveStatus,
    setSaveStatus,
    zoom,
    setZoom,
    historyState,
    setHistoryState,
    cursors,
    setCursors,
    toast,
    setToast,
    modal,
    setModal,
    shareUrl,
    setShareUrl,
    shareMessage,
    setShareMessage,
    shareBusy,
    setShareBusy,
    movingOnline,
    setMovingOnline,
    menuOpen,
    setMenuOpen,
    notify,
  };
}
