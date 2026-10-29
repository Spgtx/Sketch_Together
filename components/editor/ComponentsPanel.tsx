'use client';

import type { ComponentMeta, LayoutSettings, SavedComponent } from '@/lib/prototype-layout';

type Props = {
  items: SavedComponent[];
  selected: ComponentMeta | null;
  settings: LayoutSettings;
  onSettings: (settings: LayoutSettings) => void;
  onCreate: () => void;
  onInsert: (item: SavedComponent) => void;
  onLayout: () => void;
  onDelete: (id: string) => void;
};

export function ComponentsPanel({
  items, selected, settings, onSettings, onCreate, onInsert, onLayout, onDelete,
}: Props) {
  return (
    <div className="components-panel">
      <img src="/art/room/component-stamp.svg" alt="" className="component-illustration" />
      <p className="panel-hint">
        Build a reusable piece from selected objects. Place independent copies into any board.
      </p>
      <button className="component-primary" type="button" onClick={onCreate}>
        ✳ Save selection as a component
      </button>
      <div className="component-shelf">
        {items.length === 0 && <p className="panel-hint">Your component shelf is empty.</p>}
        {items.map((item) => (
          <div className="component-shelf-row" key={item.id}>
            <button type="button" onClick={() => onInsert(item)} title="Place an instance">
              <span className="component-glyph">◇</span>
              <span>{item.name}<small>Place on canvas</small></span>
            </button>
            <button type="button" onClick={() => onDelete(item.id)}
              aria-label={`Remove ${item.name} from shelf`} title="Remove from shelf">×</button>
          </div>
        ))}
      </div>
      <div className="panel-divider" />
      <h3 className="component-subtitle">Auto-layout</h3>
      <p className="panel-hint">
        Arrange objects with repeatable spacing inside a group or new selection.
      </p>
      <label className="component-field">Direction
        <select value={settings.direction} onChange={(event) => onSettings({
          ...settings,
          direction: event.target.value as LayoutSettings['direction'],
        })}>
          <option value="vertical">↓ Vertical</option>
          <option value="horizontal">→ Horizontal</option>
        </select>
      </label>
      <div className="component-numeric-fields">
        <label className="component-field">Gap
          <input type="number" min="0" max="160" value={settings.gap}
            onChange={(event) => onSettings({
              ...settings, gap: Number(event.target.value),
            })} />
        </label>
        <label className="component-field">Padding
          <input type="number" min="0" max="160" value={settings.padding}
            onChange={(event) => onSettings({
              ...settings, padding: Number(event.target.value),
            })} />
        </label>
      </div>
      <button type="button" className="component-primary secondary" onClick={onLayout}>
        Apply layout to selection
      </button>
      {selected && (
        <p className="panel-hint">
          Selected {selected.kind}: <strong>{selected.name}</strong>
        </p>
      )}
      <p className="panel-hint">
        Current instances are editable copies. Master-linked overrides and interactive
        prototype transitions will be added separately.
      </p>
    </div>
  );
}
