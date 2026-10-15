'use client';

import { StudioIcon } from '@/components/StudioIcon';

export type LayerItem = {
  id: string;
  label: string;
  kind: string;
  visible: boolean;
  selected: boolean;
};

type Props = {
  layers: LayerItem[];
  onSelect: (id: string) => void;
  onToggleVisibility: (id: string) => void;
  onMove: (id: string, direction: 'up' | 'down') => void;
  onDuplicate: () => void;
  onDelete: () => void;
  canEdit: boolean;
};

export function LayersPanel({
  layers,
  onSelect,
  onToggleVisibility,
  onMove,
  onDuplicate,
  onDelete,
  canEdit,
}: Props) {
  return (
    <section className="studio-layers" aria-label="Object layers">
      <p className="sticker-intro">
        Every mark has a place. Select, rearrange, or temporarily hide anything.
      </p>
      <div className="layers-summary">
        <strong>{layers.length} pieces</strong>
        <span>Top layers appear first</span>
      </div>
      {layers.length === 0 ? (
        <div className="layers-blank">
          <img src="/art/room/room-spark.svg" alt="" />
          <span>Nothing on this page yet. Make the first mark!</span>
        </div>
      ) : (
        <ol className="layers-list">
          {layers.map((layer, index) => (
            <li
              key={layer.id}
              className={layer.selected ? 'layer-row is-selected' : 'layer-row'}
            >
              <button
                className="layer-pick"
                onClick={() => onSelect(layer.id)}
                title={`Select ${layer.label}`}
                disabled={!canEdit}
              >
                <span className="layer-index">{String(index + 1).padStart(2, '0')}</span>
                <span className="layer-description">
                  <strong>{layer.label}</strong>
                  <small>{layer.kind}</small>
                </span>
              </button>
              <div className="layer-buttons">
                <button
                  title={layer.visible ? 'Hide layer' : 'Show layer'}
                  aria-label={layer.visible ? 'Hide layer' : 'Show layer'}
                  onClick={() => onToggleVisibility(layer.id)}
                  disabled={!canEdit}
                >
                  {layer.visible ? '◉' : '○'}
                </button>
                <button
                  title="Move layer up"
                  aria-label="Move layer up"
                  disabled={!canEdit || index === 0}
                  onClick={() => onMove(layer.id, 'up')}
                >
                  ↑
                </button>
                <button
                  title="Move layer down"
                  aria-label="Move layer down"
                  disabled={!canEdit || index === layers.length - 1}
                  onClick={() => onMove(layer.id, 'down')}
                >
                  ↓
                </button>
              </div>
            </li>
          ))}
        </ol>
      )}
      <div className="layer-actions">
        <button disabled={!canEdit} onClick={onDuplicate}>
          <StudioIcon name="copy" size={16} /> Duplicate selection
        </button>
        <button disabled={!canEdit} onClick={onDelete}>
          <StudioIcon name="trash" size={16} /> Delete
        </button>
      </div>
      <p className="sticker-tip">
        Visibility and layer order are saved with this board and shared when live.
      </p>
    </section>
  );
}
