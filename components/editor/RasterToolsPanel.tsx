'use client';

import { StudioIcon } from '@/components/StudioIcon';

import {
  BLEND_MODES,
  MAX_PAINT_LAYERS,
  PAINT_HEIGHT,
  PAINT_WIDTH,
  type BlendMode,
} from '@/lib/raster-paint';

export type PaintLayerItem = {
  id: string;
  name: string;
  blend: BlendMode;
  visible: boolean;
};

type Props = {
  layers: PaintLayerItem[];
  activeId: string | null;
  color: string;
  stroke: number;
  opacity: number;
  onAdd: () => void;
  onSelect: (id: string) => void;
  onBlend: (blend: BlendMode) => void;
  onRename: (name: string) => void;
  onToggle: () => void;
  onDelete: () => void;
  onExport: () => void;
  onTool: (tool: 'raster-paint' | 'raster-erase' | 'raster-fill') => void;
  onColor: (color: string) => void;
  onStroke: (width: number) => void;
  onOpacity: (opacity: number) => void;
};

export function RasterToolsPanel(props: Props) {
  const active = props.layers.find((layer) => layer.id === props.activeId);
  return (
    <section className="raster-studio" aria-label="Raster painting studio">
      <img src="/art/studio/paint-friends.svg" alt="" className="raster-illustration" />
      <p className="panel-hint">
        Paint onto transparent pixels. Erasing affects just the chosen paint layer,
        not the notes and vector drawings above it.
      </p>
      <button
        className="raster-add"
        disabled={props.layers.length >= MAX_PAINT_LAYERS}
        onClick={props.onAdd}
      >
        + New transparent paint layer
      </button>
      <p className="panel-hint">
        Up to {MAX_PAINT_LAYERS} layers, each {PAINT_WIDTH} × {PAINT_HEIGHT} pixels.
      </p>
      <div className="raster-layer-list">
        {props.layers.map((layer) => (
          <button
            key={layer.id}
            className={props.activeId === layer.id ? 'selected' : ''}
            onClick={() => props.onSelect(layer.id)}
          >
            <span className="raster-layer-icon">▧</span>
            <span>{layer.name}</span>
            <small>{layer.visible ? layer.blend : 'hidden'}</small>
          </button>
        ))}
      </div>
      {active ? (
        <>
          <div className="raster-layer-actions">
            <button onClick={() => {
              const name = window.prompt('Name this paint layer', active.name);
              if (name?.trim()) props.onRename(name.trim().slice(0, 40));
            }}>Rename layer</button>
            <button onClick={props.onToggle}>
              {active.visible ? 'Hide layer' : 'Show layer'}
            </button>
            <button onClick={props.onExport}>Save layer PNG</button>
            <button className="raster-delete" onClick={props.onDelete}>Delete layer</button>
          </div>
          <label className="panel-label" htmlFor="raster-blend">Layer blend mode</label>
          <select
            id="raster-blend"
            value={active.blend}
            onChange={(event) => props.onBlend(event.target.value as BlendMode)}
          >
            {BLEND_MODES.map((item) => (
              <option key={item.value} value={item.value}>{item.label}</option>
            ))}
          </select>
          <div className="raster-actions">
            <button onClick={() => props.onTool('raster-paint')}>
              <StudioIcon name="paint-pixels" size={19} /> Pixel brush
            </button>
            <button onClick={() => props.onTool('raster-erase')}>
              <StudioIcon name="erase-pixels" size={19} /> Pixel eraser
            </button>
            <button onClick={() => props.onTool('raster-fill')}>
              <StudioIcon name="paint-bucket" size={19} /> Color fill bucket
            </button>
          </div>
          <label className="panel-label" htmlFor="raster-color">Paint color</label>
          <input
            id="raster-color"
            type="color"
            value={props.color}
            onChange={(event) => props.onColor(event.target.value)}
          />
          <label className="panel-label" htmlFor="raster-width">Brush size</label>
          <input
            id="raster-width"
            type="range"
            min="1"
            max="80"
            value={props.stroke}
            onChange={(event) => props.onStroke(Number(event.target.value))}
          />
          <output>{props.stroke} px</output>
          <label className="panel-label" htmlFor="raster-opacity">Paint opacity</label>
          <input
            id="raster-opacity"
            type="range"
            min="5"
            max="100"
            value={Math.round(props.opacity * 100)}
            onChange={(event) => props.onOpacity(Number(event.target.value) / 100)}
          />
          <output>{Math.round(props.opacity * 100)}%</output>
        </>
      ) : (
        <p className="panel-hint">Create a paint layer to start drawing on pixels.</p>
      )}
      <p className="panel-hint">
        In Protected rooms, simultaneous edits to the same paint layer are rejected,
        not merged. Use separate layers for different collaborators.
      </p>
    </section>
  );
}
