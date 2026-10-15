'use client';

export type Checkpoint = {
  id: string;
  label: string;
  createdAt: number;
  state: Record<string, unknown>;
};

type Props = {
  checkpoints: Checkpoint[];
  disabled?: boolean;
  onCreate: () => void;
  onRestore: (checkpoint: Checkpoint) => void;
  onDelete: (id: string) => void;
};

export function CheckpointsPanel({
  checkpoints,
  disabled,
  onCreate,
  onRestore,
  onDelete,
}: Props) {
  return (
    <section className="room-checkpoints">
      <p className="sticker-intro">
        Take a snapshot before trying something wild. These copies stay on this device.
      </p>
      <button className="checkpoint-save" disabled={disabled} onClick={onCreate}>
        + Save this moment
      </button>
      {checkpoints.length === 0 ? (
        <div className="checkpoint-empty">
          <img src="/stickers/ink-friend.svg" alt="" />
          <span>No saved moments yet. Start with one!</span>
        </div>
      ) : (
        <ol className="checkpoint-list">
          {checkpoints.map((checkpoint) => (
            <li key={checkpoint.id}>
              <div>
                <strong>{checkpoint.label}</strong>
                <time dateTime={new Date(checkpoint.createdAt).toISOString()}>
                  {new Date(checkpoint.createdAt).toLocaleString()}
                </time>
              </div>
              <div className="checkpoint-actions">
                <button disabled={disabled} onClick={() => onRestore(checkpoint)}>
                  Restore
                </button>
                <button
                  disabled={disabled}
                  aria-label={`Delete ${checkpoint.label}`}
                  onClick={() => onDelete(checkpoint.id)}
                >
                  ×
                </button>
              </div>
            </li>
          ))}
        </ol>
      )}
      <p className="sticker-tip">
        Restoring a saved moment replaces the current board, including for collaborators
        when live syncing is on. Export JSON for a portable backup.
      </p>
    </section>
  );
}
