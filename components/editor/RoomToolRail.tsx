'use client';

import { StudioIcon, type IconName } from '@/components/StudioIcon';

export type RoomTool =
  | 'select'
  | 'hand'
  | 'pen'
  | 'eraser'
  | 'raster-paint'
  | 'raster-erase'
  | 'raster-fill'
  | 'curve'
  | 'rectangle'
  | 'ellipse'
  | 'line'
  | 'arrow'
  | 'connector'
  | 'text'
  | 'note';

export const ROOM_TOOLS: {
  name: RoomTool;
  icon: IconName;
  label: string;
  shortcut: string;
}[] = [
  { name: 'select', icon: 'cursor', label: 'Select / move', shortcut: 'V' },
  { name: 'hand', icon: 'hand', label: 'Pan around', shortcut: 'H' },
  { name: 'pen', icon: 'brush', label: 'Vector drawing brushes', shortcut: 'P' },
  { name: 'eraser', icon: 'eraser', label: 'Erase entire objects', shortcut: 'E' },
  { name: 'raster-paint', icon: 'paint-pixels', label: 'Paint pixels', shortcut: 'G' },
  { name: 'raster-erase', icon: 'erase-pixels', label: 'Erase pixels', shortcut: 'X' },
  { name: 'raster-fill', icon: 'paint-bucket', label: 'Fill pixels', shortcut: 'F' },
  { name: 'curve', icon: 'bezier', label: 'Draw a Bézier curve', shortcut: 'B' },
  { name: 'rectangle', icon: 'rectangle', label: 'Rectangle', shortcut: 'R' },
  { name: 'ellipse', icon: 'ellipse', label: 'Ellipse', shortcut: 'O' },
  { name: 'line', icon: 'line', label: 'Line', shortcut: 'L' },
  { name: 'arrow', icon: 'arrow', label: 'Arrow', shortcut: 'A' },
  { name: 'connector', icon: 'connector', label: 'Smart connector', shortcut: 'C' },
  { name: 'text', icon: 'text', label: 'Editable text', shortcut: 'T' },
  { name: 'note', icon: 'note', label: 'Sticky note', shortcut: 'N' },
];

type Props = {
  tool: RoomTool;
  ready: boolean;
  onTool: (tool: RoomTool) => void;
  onStickers: () => void;
  onImage: () => void;
  onLayers: () => void;
  onDelete: () => void;
};

export function RoomToolRail({
  tool,
  ready,
  onTool,
  onStickers,
  onImage,
  onLayers,
  onDelete,
}: Props) {
  return (
    <aside className="tool-rail" aria-label="Drawing tools">
      {ROOM_TOOLS.map((item, index) => (
        <div key={item.name} className="rail-slot">
          {index === 2 && <span className="rail-divider" aria-hidden="true" />}
          <button
            title={`${item.label} (${item.shortcut})`}
            aria-label={`${item.label} (${item.shortcut})`}
            aria-pressed={tool === item.name}
            className={`icon-btn ${tool === item.name ? 'selected' : ''}`}
            disabled={!ready}
            onClick={() => onTool(item.name)}
          >
            <StudioIcon name={item.icon} size={23} />
            <span className="rail-tooltip">{item.label}</span>
          </button>
        </div>
      ))}
      <span className="rail-divider" aria-hidden="true" />
      <button
        className="icon-btn sticker-tool"
        aria-label="Open sticker book"
        title="Open sticker book"
        disabled={!ready}
        onClick={onStickers}
      >
        <StudioIcon name="sticker-sheet" size={22} />
      </button>
      <button
        className="icon-btn"
        aria-label="Add an image"
        title="Add an image"
        disabled={!ready}
        onClick={onImage}
      >
        <StudioIcon name="image" size={20} />
      </button>
      <button
        className="icon-btn"
        aria-label="Open layers"
        title="Open layers"
        disabled={!ready}
        onClick={onLayers}
      >
        <StudioIcon name="layers" size={20} />
      </button>
      <button
        className="icon-btn"
        aria-label="Remove selected objects"
        title="Remove selected objects (Delete)"
        disabled={!ready}
        onClick={onDelete}
      >
        <StudioIcon name="trash" size={20} />
      </button>
    </aside>
  );
}
