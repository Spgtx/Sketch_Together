'use client';
import { StudioIcon } from '@/components/StudioIcon';
import { touchBoard } from '@/lib/boards';
import { REACTIONS } from './room-model';
import type { RoomViewProps } from './room-view-types';

export function RoomHeader(scope: RoomViewProps) {
  const {
    title,
    setTitle,
    roomId,
    saveStatus,
    panelOpen,
    setPanelOpen,
    connected,
    hasRealtime,
    cloudEnabled,
    online,
    setRailOpen,
    railOpen,
    syncPolicy,
    changeRoomPolicy,
    people,
    setModal,
    displayName,
    historyState,
    restoreHistory,
    sendReaction,
    menuOpen,
    setMenuOpen,
    setPanelTab,
    exportBoard,
    backupNow,
    revokeInvitations,
    boardInputRef,
    fitToDrawing,
  } = scope;
  return (
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
                <button className="icon-btn bordered" type="button"
                  onClick={() => setRailOpen((open) => !open)}
                  title={railOpen ? 'Hide drawing tools' : 'Show drawing tools'}>
                  <StudioIcon name="brush" size={18} />
                </button>
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
                  <button role="menuitem" onClick={() => {
                    setPanelTab('export');
                    setPanelOpen(true);
                    setMenuOpen(false);
                  }}>
                    <StudioIcon name="download" size={17} /> Export options…
                  </button>
                  <button role="menuitem" onClick={() => exportBoard('png')}>
                    <StudioIcon name="download" size={17} /> Download PNG
                  </button>
                  <button role="menuitem" onClick={() => exportBoard('svg')}>
                    <StudioIcon name="download" size={17} /> Download SVG
                  </button>
                  <button role="menuitem" onClick={() => exportBoard('json')}>
                    <StudioIcon name="save" size={17} /> Download editable board
                  </button>
                  {/*<button role="menuitem" onClick={() => void backupNow()}>
                    <StudioIcon name="save" size={17} /> Back up online
                  </button>*/}
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
  );
}
