'use client';
import { installRoomGestures } from './room-pointer-gestures';
import type { Obj, RemoteOperation } from './room-model';
import { useEffect } from 'react';
import { connectLiveRoom } from '@/lib/realtime/supabase-room';
import { enterRoom } from '@/lib/room-links';
import { Canvas, PencilBrush, Path, Group, Textbox, FabricObject, Point, util } from 'fabric';
import { snapPosition, type VectorPoint } from '@/lib/advanced-vector';

import { getBoards, touchBoard } from '@/lib/boards';
import { seedTemplate } from '@/lib/templates';

import { connectorPath, edgeAnchor, type ConnectorMeta, type XY } from '@/lib/connector-geometry';
import { isRasterLayer, CURSOR_COLORS, LOCAL_PREFIX, PENDING_PREFIX, validTemplate, ensureId, snapshot, curveObject, penObject, restorePaintCompositing } from './room-model';
import type { useRoomBase } from './room-base';
import type { useRoomSocial } from './room-social';
import type { useRoomSync } from './room-sync';
import type { useRoomDrawing } from './room-drawing';
export function useRoomCanvasLifecycle(scope: ReturnType<typeof import('./room-base').useRoomBase> &
  ReturnType<typeof import('./room-social').useRoomSocial> &
  ReturnType<typeof import('./room-sync').useRoomSync> &
  ReturnType<typeof import('./room-drawing').useRoomDrawing> &
  ReturnType<typeof import('./room-canvas-tools').useRoomCanvasTools> &
  ReturnType<typeof import('./room-vector-tools').useRoomVectorTools> &
  ReturnType<typeof import('./room-cloud-tools').useRoomCloudTools> &
  ReturnType<typeof import('./room-checkpoints').useRoomCheckpoints>) {
  const {
    mountedRef,
    stageRef,
    canvasElementRef,
    rasterPreviewRef,
    roomId,
    clientIdRef,
    queueRef,
    acknowledgedRef,
    needsRefreshRef,
    canvasRef,
    updateBrush,
    silentRef,
    commit,
    toolRef,
    rerouteAllRef,
    gestureVersionsRef,
    cloudVersionsRef,
    editingIdsRef,
    gridSnapRef,
    setSelectedCurveNodes,
    setSelectedPenNodes,
    persist,
    refreshLayers,
    setSelectedComponent,
    setGroupMembers,
    setSelectedCurveClosed,
    setSelectedText,
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
    cloudEnabledRef,
    cloudRevisionRef,
    remoteRefreshTimerRef,
    loadCloud,
    historyRef,
    updateHistoryUI,
    setSaveStatus,
    setLocked,
    setCloudEnabled,
    memberVersionsRef,
    structureVersionsRef,
    syncPolicyRef,
    setSyncPolicy,
    setReady,
    flushCloud,
    commitReplacement,
    setHasRealtime,
    setConnected,
    remoteQueueRef,
    setCursors,
    showReaction,
    setPeople,
    setOnline,
    setTitle,
    reactionTimersRef,
    flushTimerRef,
  } = scope;
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
        if (target) makeChange('modify', target as Obj);
        if (id) {
          editingIdsRef.current.delete(id);
          delete gestureVersionsRef.current[id];
        }
      });
      canvas.on('object:modified', ({ target }) => {
        if (!target) return;
        if (gridSnapRef.current && target.type !== 'activeselection') {
          const p = snapPosition({ x: target.left, y: target.top }, true, 20);
          target.set({ left: p.x, top: p.y });
          target.setCoords();
        }
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
        if (curve.penNodes?.length && curve instanceof Path) {
          const matrix = curve.calcTransformMatrix();
          const transformNode = (node: VectorPoint): VectorPoint => {
            const result = util.transformPoint(new Point(
              node.x - curve.pathOffset.x,
              node.y - curve.pathOffset.y,
            ), matrix);
            return { x: result.x, y: result.y };
          };
          const nodes = curve.penNodes.map((node) => ({
            ...transformNode(node),
            ...(node.incoming && { incoming: transformNode(node.incoming) }),
            ...(node.outgoing && { outgoing: transformNode(node.outgoing) }),
          }));
          const replacement = penObject(nodes, curve, curve.penClosed);
          const index = canvas.getObjects().indexOf(curve);
          if (index < 0) return;
          silentRef.current = true;
          try {
            canvas.discardActiveObject();
            canvas.remove(curve);
            canvas.insertAt(index, replacement);
            canvas.setActiveObject(replacement);
            canvas.requestRenderAll();
          } finally { silentRef.current = false; }
          setSelectedPenNodes(nodes);
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
      // Avoid broadcasting a complete text object for every keystroke.
      canvas.on('text:changed', () => canvas.requestRenderAll());
      const updateSelection = () => {
        refreshLayers(canvas);
        const selected = canvas.getActiveObject() as Obj | undefined;
        setSelectedComponent(selected?.component || null);
        const group = selected instanceof Group && selected.type !== 'activeselection'
          ? selected : null;
        setGroupMembers(group ? group.getObjects().map((object, index) => {
          const child = object as Obj;
          if (!child.id) (group as Obj)._requiresMemberMigration = true;
          return { id: ensureId(child), name: `${index + 1} · ${child.type}`,
            fill: typeof child.fill === 'string' && /^#[\da-f]{6}$/i.test(child.fill)
              ? child.fill : '#333333', visible: child.visible !== false };
        }) : []);
        setSelectedCurveNodes(selected?.vectorNodes?.map((node) => ({ ...node })) || null);
        setSelectedCurveClosed(Boolean(selected?.curveClosed));
        setSelectedPenNodes(selected?.penNodes?.map((node) => ({ ...node })) || null);
        if (selected instanceof Textbox) {
          setSelectedText({
            fontFamily: selected.fontFamily,
            fontSize: selected.fontSize,
            fontWeight: selected.fontWeight,
            fontStyle: selected.fontStyle,
            underline: Boolean(selected.underline),
            textAlign: selected.textAlign,
            charSpacing: selected.charSpacing,
            lineHeight: selected.lineHeight,
            fill: typeof selected.fill === 'string' ? selected.fill : '#292923',
          });
        } else { setSelectedText(null); }
      };
      canvas.on('selection:created', updateSelection);
      canvas.on('selection:updated', updateSelection);
      canvas.on('selection:cleared', updateSelection);
      canvas.on('path:created', ({ path }) => {
        if (!path) return;
        ensureId(path as Obj);
        makeChange('add', path as Obj);
      });
  
      const { upperCanvas, blockMiddle, stopAutoScroll, onWheel, moveMiddle, endMiddle } = installRoomGestures({
      ...scope, canvas, makeChange, clearPaintPreview, previewContext, nodeForPoint, pathFor,
    });
  
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
              memberVersionsRef.current = remote.memberVersions || {};
              structureVersionsRef.current = remote.structureVersions || remote.versions || {};
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
        finishPenRef.current = null;
        cancelPenRef.current = null;
        upperCanvas.removeEventListener('mousedown', blockMiddle);
        upperCanvas.removeEventListener('auxclick', stopAutoScroll);
        upperCanvas.removeEventListener('wheel', onWheel);
        window.removeEventListener('mousemove', moveMiddle);
        window.removeEventListener('mouseup', endMiddle);
        void liveRoomRef.current?.close();
        liveRoomRef.current = null;
        canvasRef.current = null;
        rerouteAllRef.current = null;
        void canvas.dispose();
      };
    // Core canvas must be created only when the room id changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [roomId]);

}
