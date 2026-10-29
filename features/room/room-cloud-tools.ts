'use client';
import type { Obj } from './room-model';
import { useCallback } from 'react';
import { editorInviteUrl } from '@/lib/room-links';
import { createCloudRoom, saveOwnerAccess, uploadLocalDocument } from '@/lib/cloud-room-client';
import { stickerPngDataUrl } from '@/lib/sticker-render';
import { FabricImage } from 'fabric';
import { getBoards, touchBoard } from '@/lib/boards';
import { stickerUrl, type StickerId } from '@/lib/stickers';
import type { SyncPolicy } from '@/lib/sync-model';
import { ensureId, snapshot, restorePaintCompositing, saveBlob } from './room-model';
import type { useRoomBase } from './room-base';
import type { useRoomSync } from './room-sync';
import type { useRoomDrawing } from './room-drawing';
export function useRoomCloudTools(scope: ReturnType<typeof import('./room-base').useRoomBase> &
  ReturnType<typeof import('./room-sync').useRoomSync> &
  ReturnType<typeof import('./room-drawing').useRoomDrawing> &
  ReturnType<typeof import('./room-canvas-tools').useRoomCanvasTools> &
  ReturnType<typeof import('./room-vector-tools').useRoomVectorTools>) {
  const {
    canvasRef,
    notify,
    refreshLayers,
    silentRef,
    commit,
    setModal,
    roomId,
    cloudEnabledRef,
    queueRef,
    setSaveStatus,
    syncPolicyRef,
    setSyncPolicy,
    movingOnline,
    setShareMessage,
    setMovingOnline,
    persist,
    paper,
    title,
    setShareBusy,
    setShareUrl,
    shareUrl,
    setMenuOpen,
    rerouteAllRef,
    changeTool,
    toolRef,
    recordHistory,
    commitReplacement,
    boardInputRef,
    ready,
    imageInputRef,
  } = scope;
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
  return {
    duplicateSelected,
    removeSelected,
    clearBoard,
    revokeInvitations,
    backupNow,
    changeRoomPolicy,
    moveBoardOnline,
    generateShareLink,
    copyShareLink,
    exportBoard,
    importBoard,
    addSticker,
    uploadImage,
  };
}
