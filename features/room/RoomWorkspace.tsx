'use client';
import { type ChangeEvent } from 'react';

import { StudioIcon } from '@/components/StudioIcon';

import { RoomDialogs } from '@/components/editor/RoomDialogs';
import type { RoomViewProps } from './room-view-types';
import { RoomHeader } from './RoomHeader';
import { RoomCanvasStage } from './RoomCanvasStage';
import { RoomPanelDock } from './RoomPanelDock';

export function RoomWorkspace(scope: RoomViewProps) {
  const {
    locked,
    title,
    connected,
    hasRealtime,
    cloudEnabled,
    people,
    setModal,
    displayName,
    exportBoard,
    boardInputRef,
    fitToDrawing,
    layers,
    imageInputRef,
    zoomTo,
    zoom,
    resetView,
    syncWarning,
    loadCloud,
    toast,
    uploadImage,
    importBoard,
    modal,
    clearBoard,
    generateShareLink,
    copyShareLink,
    shareUrl,
    shareMessage,
    shareBusy,
    movingOnline,
    moveBoardOnline,
    setDisplayName,
    saveDisplayName,
  } = scope;
  
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
        <RoomHeader {...scope} />
  
        <div className="studio-workspace">
          <RoomCanvasStage {...scope} />
  
          <RoomPanelDock {...scope} /><div className="studio-bottom">
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
