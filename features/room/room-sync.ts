'use client';
import type { Obj, RemoteOperation } from './room-model';
import { useCallback } from 'react';
import { Canvas, PencilBrush, SprayBrush, Textbox } from 'fabric';
import { touchBoard } from '@/lib/boards';
import type { SyncChange, SyncPolicy } from '@/lib/sync-model';
import { hexWithOpacity } from '@/lib/art-strokes';
import { isRasterLayer, MAX_HISTORY, LOCAL_PREFIX, PENDING_PREFIX, ensureId, snapshot, serialize, restorePaintCompositing } from './room-model';
import type { useRoomBase } from './room-base';
export function useRoomSync(scope: ReturnType<typeof import('./room-base').useRoomBase>) {
  const {
    setHistoryState,
    historyRef,
    setPaintLayers,
    activePaintIdRef,
    setActivePaintId,
    setLayers,
    brushModeRef,
    opacity,
    opacityRef,
    colorRef,
    strokeRef,
    roomId,
    setSaveStatus,
    notify,
    cloudEnabledRef,
    conflictedRef,
    liveRoomRef,
    clientIdRef,
    setConnected,
    queueRef,
    acknowledgedRef,
    sendingRef,
    needsRefreshRef,
    setSyncWarning,
    cloudRevisionRef,
    memberVersionsRef,
    structureVersionsRef,
    cloudVersionsRef,
    syncPolicyRef,
    gestureVersionsRef,
    editingIdsRef,
    flushTimerRef,
    canvasRef,
    silentRef,
    rerouteAllRef,
    setSelectedCurveNodes,
    setSyncPolicy,
  } = scope;
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
            : change.kind === 'modify-member' ? change.baseVersion
              : change.previousOp ? fromPredecessor : change.baseVersion;
          const baseMemberVersion = change.kind === 'modify-member' &&
            change.previousOp ? fromPredecessor : change.baseMemberVersion;
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
              body: JSON.stringify({
                ...change, baseVersion, baseMemberVersion, baseRevision,
              }),
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
          if (change.kind === 'modify-member' && change.id && change.memberId) {
            memberVersionsRef.current[`${change.id}:${change.memberId}`] = ack.revision;
          } else if (change.id) {
            structureVersionsRef.current[change.id] = ack.revision;
          }
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
  
  const commitMember = useCallback((group: Obj, member: Obj) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      recordHistory(canvas);
      persist(canvas);
      if (!cloudEnabledRef.current) {
        publish({ kind: 'modify', object: serialize(group) });
        return;
      }
      const groupId = ensureId(group);
      const memberId = ensureId(member);
      const predecessor = [...queueRef.current].reverse().find((change) =>
        change.id === groupId && change.memberId === memberId);
      const change: SyncChange & { previousOp?: string } = {
        opId: crypto.randomUUID(), actor: clientIdRef.current,
        kind: 'modify-member', policy: syncPolicyRef.current,
        id: groupId, memberId, member: serialize(member) as SyncChange['member'],
        baseVersion: structureVersionsRef.current[groupId] ??
          cloudVersionsRef.current[groupId] ?? -1,
        baseMemberVersion: memberVersionsRef.current[`${groupId}:${memberId}`] ?? -1,
        ...(predecessor && { previousOp: predecessor.opId }),
      };
      const last = queueRef.current[queueRef.current.length - 1];
      if (!sendingRef.current && last?.kind === 'modify-member' &&
        last.id === groupId && last.memberId === memberId) {
        last.member = change.member;
      } else {
        queueRef.current.push(change);
      }
      savePending();
      if (flushTimerRef.current) clearTimeout(flushTimerRef.current);
      flushTimerRef.current = setTimeout(() => void flushCloud(), 450);
    }, [flushCloud, persist, publish, recordHistory, savePending]);
  
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
        memberVersions?: Record<string, number>;
        structureVersions?: Record<string, number>;
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
        memberVersionsRef.current = latest.memberVersions || {};
        structureVersionsRef.current = latest.structureVersions || latest.versions;
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
  return {
    updateHistoryUI,
    refreshLayers,
    updateBrush,
    recordHistory,
    persist,
    publish,
    savePending,
    flushCloud,
    queueCloud,
    commitMember,
    commit,
    commitReplacement,
    loadCloud,
  };
}
