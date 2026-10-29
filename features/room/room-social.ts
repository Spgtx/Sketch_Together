'use client';
import { useCallback } from 'react';
import { REACTIONS } from './room-model';
import type { useRoomBase } from './room-base';
export function useRoomSocial(scope: ReturnType<typeof import('./room-base').useRoomBase>) {
  const {
    setDisplayName,
    displayNameRef,
    liveRoomRef,
    notify,
    setModal,
    setBursts,
    reactionTimersRef,
    connected,
    clientIdRef,
  } = scope;
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
  return { saveDisplayName, showReaction, sendReaction };
}
