'use client';

import { useMemo, useState } from 'react';
import { StudioIcon } from '@/components/StudioIcon';
import type { BoardMeta, Template } from '@/lib/boards';

const COVER_ART: Record<Template, string> = {
  blank: '/art/world/template-blank.svg',
  brainstorm: '/art/world/template-brainstorm.svg',
  flow: '/art/world/template-flow.svg',
  retro: '/art/world/template-retro.svg',
};

type Props = {
  boards: BoardMeta[];
  feedback: string;
  inviteUrl: string;
  onOpen: (id: string) => void;
  onDuplicate: (board: BoardMeta) => void;
  onCopy: (id: string) => void;
  onRemove: (board: BoardMeta) => void;
  onCreate: () => void;
};

export function BoardDrawer({
  boards,
  feedback,
  inviteUrl,
  onOpen,
  onDuplicate,
  onCopy,
  onRemove,
  onCreate,
}: Props) {
  const [search, setSearch] = useState('');
  const visible = useMemo(
    () => boards.filter((board) =>
      `${board.title} ${board.template}`.toLowerCase().includes(search.toLowerCase()),
    ),
    [boards, search],
  );

  return (
    <section className="world-library world-width" id="your-pages"
      aria-labelledby="library-title">
      <div className="world-library-head">
        <div>
          <span className="world-index">04 / THE UNFINISHED COLLECTION</span>
          <h2 id="library-title">Keep your <em>happy accidents.</em></h2>
          <p>Find the idea you left halfway through. Pick up your pencil again.</p>
        </div>
        {boards.length > 0 && (
          <label className="world-library-search">
            <StudioIcon name="search" size={17} />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Find a page..."
              aria-label="Find a saved board"
            />
          </label>
        )}
      </div>
      {boards.length === 0 ? (
        <div className="world-empty-library">
          <img src="/art/world/inkling.svg" alt="A blue scribble creature waving hello" />
          <div>
            <span className="world-hand-note">nothing on the shelf... yet!</span>
            <h3>Your next good idea<br />could live here.</h3>
            <p>Local boards will appear here whenever you make one.</p>
            <button className="world-text-link" type="button" onClick={onCreate}>
              Make the first one <StudioIcon name="arrow-up-right" size={18} />
            </button>
          </div>
        </div>
      ) : (
        <div className="world-boards">
          {visible.slice(0, 12).map((board, index) => (
            <article className={`world-board world-board-${index % 4}`} key={board.id}>
              <button type="button" className="world-board-open"
                onClick={() => onOpen(board.id)}>
                <span className="world-board-art" aria-hidden="true">
                  <img src={COVER_ART[board.template] ?? COVER_ART.blank} alt="" />
                </span>
                <span className="world-board-label">{board.template} / LOCAL BOARD</span>
                <strong>{board.title}</strong>
                <span className="world-board-date">
                  {new Date(board.updatedAt).toLocaleDateString(undefined, {
                    month: 'short', day: 'numeric', year: 'numeric',
                  })}
                  <StudioIcon name="arrow-up-right" size={17} />
                </span>
              </button>
              <div className="world-board-utilities" aria-label={`Actions for ${board.title}`}>
                <button type="button" onClick={() => onCopy(board.id)}
                  aria-label={`Copy link to ${board.title}`} title="Copy link">
                  <StudioIcon name="link" size={15} />
                </button>
                <button type="button" onClick={() => onDuplicate(board)}
                  aria-label={`Duplicate ${board.title}`} title="Duplicate">
                  <StudioIcon name="copy" size={15} />
                </button>
                <button type="button" onClick={() => onRemove(board)}
                  aria-label={`Remove ${board.title} from this device`} title="Remove">
                  <StudioIcon name="trash" size={15} />
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
      {boards.length > 0 && visible.length === 0 && (
        <p className="world-library-noresults">No local pages match “{search}”.</p>
      )}
      {feedback && <p className="world-library-feedback" role="status">{feedback}</p>}
      {inviteUrl && (
        <label className="world-invite-result" htmlFor="world-invite-link">
          Private room invitation (editor access)
          <input
            id="world-invite-link"
            type="text"
            readOnly
            value={inviteUrl}
            onFocus={(event) => event.currentTarget.select()}
            onClick={(event) => event.currentTarget.select()}
          />
          <small>Select the address to copy it manually if clipboard access is blocked.</small>
        </label>
      )}
      <p className="world-library-fineprint">
        This shelf is saved in your browser. The artwork on each cover represents
        its template; it is not a preview of your drawing. Removing a local copy
        does not delete a separately saved cloud version.
      </p>
    </section>
  );
}
