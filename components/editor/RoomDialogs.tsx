'use client';

import type { FormEvent } from 'react';
import { StudioIcon } from '@/components/StudioIcon';
import { ROOM_TOOLS } from '@/components/editor/RoomToolRail';

export type RoomDialog = 'shortcuts' | 'clear' | 'share' | 'profile';

type Props = {
  modal: RoomDialog | null;
  onClose: () => void;
  onClear: () => void;
  onShare: () => void;
  onCopyShare: () => void;
  shareUrl: string;
  shareMessage: string;
  shareBusy: boolean;
  cloudEnabled: boolean;
  moveBusy: boolean;
  onMoveToCloud: () => void;
  connected: boolean;
  hasRealtime: boolean;
  people: string[];
  displayName: string;
  onDisplayName: (name: string) => void;
  onSaveName: (name: string) => void;
};

export function RoomDialogs(props: Props) {
  const {
    modal, onClose, onClear, onShare, onCopyShare, shareUrl,
    shareMessage, shareBusy, cloudEnabled, moveBusy, onMoveToCloud,
    connected, hasRealtime,
    people, displayName, onDisplayName, onSaveName,
  } = props;
  if (!modal) return null;

  const title = modal === 'shortcuts' ? 'Work a little faster.'
    : modal === 'clear' ? 'Clear this canvas?'
      : modal === 'profile' ? 'Your seat at the table.'
        : 'Share your space.';

  function saveName(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSaveName(displayName);
  }

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section className="modal" role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="icon-btn" aria-label="Close" onClick={onClose}>
            <StudioIcon name="close" size={18} />
          </button>
        </div>
        {modal === 'shortcuts' && (
          <>
            <p>A handful of shortcuts to keep your ideas flowing.</p>
            <div className="shortcut-grid">
              {ROOM_TOOLS.map((item) => (
                <div key={item.name}>
                  <span>{item.label}</span>
                  <kbd className="kbd">{item.shortcut}</kbd>
                </div>
              ))}
              <div><span>Undo</span><kbd className="kbd">Ctrl Z</kbd></div>
              <div><span>Redo</span><kbd className="kbd">Ctrl ⇧ Z</kbd></div>
              <div><span>Duplicate</span><kbd className="kbd">Ctrl D</kbd></div>
              <div><span>Fit artwork</span><kbd className="kbd">Ctrl 0</kbd></div>
              <div><span>Delete</span><kbd className="kbd">Delete</kbd></div>
            </div>
          </>
        )}
        {modal === 'clear' && (
          <>
            <p>
              This removes everything from the shared board. You can undo it
              immediately, but collaborators may continue editing.
            </p>
            <div className="modal-actions">
              <button className="studio-action" onClick={onClose}>Cancel</button>
              <button className="studio-action danger-solid" onClick={onClear}>
                Clear everything
              </button>
            </div>
          </>
        )}
        {modal === 'profile' && (
          <form className="room-profile-form" onSubmit={saveName}>
            <p>Pick a name for your cursor and the guest list.</p>
            <label htmlFor="guest-display-name">Display name</label>
            <input
              id="guest-display-name"
              value={displayName}
              maxLength={22}
              onChange={(event) => onDisplayName(event.target.value)}
            />
            {connected && people.length > 0 && (
              <p className="room-people">In this room: {people.join(', ')}</p>
            )}
            <button className="studio-action primary" type="submit">
              Save my name
            </button>
          </form>
        )}
        {modal === 'share' && (
          <>
            {!cloudEnabled ? (
              <>
                <p>
                  This page is stored in your browser, not in a shared room.
                  Move your artwork online to create a private Redis room.
                </p>
                <button
                  className="studio-action primary"
                  style={{ width: '100%', justifyContent: 'center' }}
                  type="button"
                  onClick={onMoveToCloud}
                  disabled={moveBusy}
                >
                  <StudioIcon name="share" size={17} />
                  {moveBusy ? 'Moving artwork online…' : 'Move this board to cloud'}
                </button>
                <p className="connection-note">
                  Your local copy remains available if cloud creation or upload fails.
                </p>
              </>
            ) : (
              <>
                <p>
                  This room is stored in Redis.{' '}
                  {hasRealtime
                    ? (connected
                      ? 'Live collaboration is connected.'
                      : 'Supabase live transport is reconnecting.')
                    : 'Supabase live transport is not configured;'
                      + ' other editors can still sync by polling.'}
                </p>
                <button
                  className="studio-action primary"
                  style={{ width: '100%', justifyContent: 'center' }}
                  type="button"
                  onClick={onShare}
                  disabled={shareBusy}
                >
                  <StudioIcon name="link" size={17} />
                  {shareBusy ? 'Generating invitation…' : 'Generate editor invitation'}
                </button>
                {shareUrl && (
                  <div className="room-share-result">
                    <label htmlFor="generated-room-link">Private room invitation</label>
                    <input
                      id="generated-room-link"
                      type="text"
                      readOnly
                      value={shareUrl}
                      onFocus={(event) => event.currentTarget.select()}
                      onClick={(event) => event.currentTarget.select()}
                    />
                    <button className="studio-action" type="button" onClick={onCopyShare}>
                      Copy invitation
                    </button>
                    <p>Select the link above to copy it manually if needed.</p>
                  </div>
                )}
                <p className="connection-note">
                  Anyone with an editor invitation can draw. Share with people you trust.
                </p>
              </>
            )}
            {shareMessage && <p role="status" className="connection-note">{shareMessage}</p>}
          </>
        )}
      </section>
    </div>
  );
}
