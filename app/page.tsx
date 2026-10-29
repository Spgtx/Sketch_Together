'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { BoardDrawer } from '@/components/home/BoardDrawer';
import { ClosingScene } from '@/components/home/ClosingScene';
import { HeroScene } from '@/components/home/HeroScene';
import { IdeaTrail } from '@/components/home/IdeaTrail';
import { SketchPlayground } from '@/components/home/SketchPlayground';
import { TemplateShelf } from '@/components/home/TemplateShelf';
import { WorldHeader } from '@/components/home/WorldHeader';
import { accessKey, editorInviteUrl } from '@/lib/room-links';
import { createCloudRoom, saveOwnerAccess } from '@/lib/cloud-room-client';
import {
  BOARD_EVENT,
  createBoardId,
  deleteLocalBoard,
  duplicateLocalBoard,
  getBoards,
  touchBoard,
  type BoardMeta,
  type Template,
} from '@/lib/boards';

const TITLES: Record<Template, string> = {
  blank: 'Untitled page',
  brainstorm: 'Big messy ideas',
  flow: 'The plan, sort of',
  retro: 'What we learned',
};

export default function HomePage() {
  const router = useRouter();
  const [boards, setBoards] = useState<BoardMeta[]>([]);
  const [creating, setCreating] = useState(false);
  const [localFallback, setLocalFallback] = useState<Template | null>(null);
  const [feedback, setFeedback] = useState('');
  const [inviteUrl, setInviteUrl] = useState('');

  useEffect(() => {
    const reload = () => setBoards(getBoards());
    reload();
    window.addEventListener(BOARD_EVENT, reload);
    window.addEventListener('storage', reload);
    return () => {
      window.removeEventListener(BOARD_EVENT, reload);
      window.removeEventListener('storage', reload);
    };
  }, []);

  function makeLocalBoard(template: Template) {
    const id = createBoardId();
    touchBoard(id, { title: TITLES[template], template, mode: 'local' });
    setLocalFallback(null);
    setFeedback('Created a local-only board. Use Share → Move to cloud when ready.');
    router.push(`/room/${id}?template=${template}&local=1`);
  }

  async function makeBoard(template: Template = 'blank') {
    if (creating) return;
    setCreating(true);
    setLocalFallback(null);
    setFeedback('');
    try {
      const room = await createCloudRoom();
      const saved = saveOwnerAccess(room);
      touchBoard(room.id, {
        title: TITLES[template],
        template,
        mode: 'cloud',
      });
      if (!saved) {
        // Creation set an HttpOnly session cookie; warn about recovery limits.
        setFeedback('Cloud room created, but browser storage is blocked. '
          + 'Keep this browser session open until you can save the owner access token.');
      }
      router.push(`/room/${room.id}?template=${template}`);
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'Unknown error';
      setFeedback(`Online room not created: ${reason}`);
      setLocalFallback(template);
      // Do not silently redirect to local mode without telling the user.
    } finally {
      setCreating(false);
    }
  }

  async function copyLink(id: string) {
    setInviteUrl('');
    if (getBoards().find((board) => board.id === id)?.mode === 'local') {
      setFeedback('This board is local-only. Open it and choose Share → '
        + 'Move this board to cloud before generating an invitation.');
      return;
    }
    try {
      const link = await editorInviteUrl(id);
      setInviteUrl(link);
      try {
        await navigator.clipboard.writeText(link);
        setFeedback('Private invitation copied. The link is also shown below.');
      } catch {
        setFeedback('Clipboard access blocked. Copy the private invitation below.');
      }
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'Unknown error';
      setFeedback(`Could not generate a room invitation: ${reason}`);
    }
  }

  async function openBoard(id: string) {
    const board = getBoards().find((item) => item.id === id);
    if (board?.mode === 'local') {
      router.push(`/room/${id}?local=1`);
      return;
    }
    if (localStorage.getItem(accessKey(id))) {
      router.push(`/room/${id}`);
      return;
    }
    try {
      const response = await fetch(`/api/sync/${encodeURIComponent(id)}`);
      if (response.ok) {
        router.push(`/room/${id}`);
        return;
      }
    } catch { /* Check locally available artwork next. */ }
    if (localStorage.getItem(`sketchtogether:canvas:${id}`)) {
      setFeedback('This board has no active cloud access. '
        + 'You can open your local copy and move it online.');
      router.push(`/room/${id}?local=1`);
      return;
    }
    setFeedback('This cloud board needs a valid invitation.');
  }

  async function duplicate(board: BoardMeta) {
    const id = duplicateLocalBoard(board);
    if (!id) {
      setFeedback('Open that board once before making a local copy.');
      return;
    }
    await openBoard(id);
  }

  function remove(board: BoardMeta) {
    if (!window.confirm(`Remove “${board.title}” from this browser?`)) return;
    deleteLocalBoard(board.id);
    setBoards(getBoards());
    setFeedback('Removed from this device.');
  }

  return (
    <main className="world" id="top">
      <div className="world-paper-grain" aria-hidden="true" />
      <svg className="world-follow-line" viewBox="0 0 180 2000"
        preserveAspectRatio="none" aria-hidden="true">
        <path d="M45 15C152 106 20 224 91 366S176 603 99 722 5 916 84 1070"
          fill="none" stroke="#EBA68A" strokeWidth="21" strokeLinecap="round"
          opacity=".5" />
        <path d="M45 15C152 106 20 224 91 366S176 603 99 722 5 916 84 1070"
          fill="none" stroke="#D36B50" strokeWidth="2.5" strokeLinecap="round"
          strokeDasharray="2 13" />
        <path d="M84 1070C175 1201 16 1414 96 1534S192 1840 84 1980"
          fill="none" stroke="#EBA68A" strokeWidth="21" strokeLinecap="round"
          opacity=".5" />
        <path d="M84 1070C175 1201 16 1414 96 1534S192 1840 84 1980"
          fill="none" stroke="#D36B50" strokeWidth="2.5" strokeLinecap="round"
          strokeDasharray="2 13" />
      </svg>
      <WorldHeader onStart={() => makeBoard()} disabled={creating} />
      <HeroScene onStart={() => makeBoard()} disabled={creating} />
      {localFallback !== null && (
        <div className="world-cloud-error world-width" role="alert">
          <p>{feedback}</p>
          <button type="button" onClick={() => makeLocalBoard(localFallback)}>
            Continue with a local-only board instead
          </button>
          <button type="button" onClick={() => void makeBoard(localFallback)}>
            Retry cloud creation
          </button>
        </div>
      )}
      <SketchPlayground />
      <IdeaTrail onStart={() => makeBoard()} disabled={creating} />
      <TemplateShelf onCreate={makeBoard} disabled={creating} />
      <BoardDrawer
        boards={boards}
        feedback={feedback}
        inviteUrl={inviteUrl}
        onOpen={(id) => void openBoard(id)}
        onDuplicate={(board) => void duplicate(board)}
        onCopy={(id) => void copyLink(id)}
        onRemove={remove}
        onCreate={() => makeBoard()}
      />
      <ClosingScene onStart={() => makeBoard()} disabled={creating} />
      <footer className="world-footer world-width">
        <a href="#top" className="world-footer-brand">sketch<span>together</span> ✳</a>
        <span>Made for beautifully unfinished ideas.</span>
        <a href="#top">Back to the beginning ↑</a>
      </footer>
    </main>
  );
}
