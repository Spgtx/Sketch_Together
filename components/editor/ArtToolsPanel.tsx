'use client';

import {
  BRUSH_PRESETS,
  type BrushPreset,
  type CurveNode,
} from '@/lib/art-strokes';

export type ArtToolsProps = {
  brush: BrushPreset;
  opacity: number;
  fill: string;
  nodes: CurveNode[] | null;
  curveClosed: boolean;
  onCurveClosed: (closed: boolean) => void;
  onBrush: (brush: BrushPreset) => void;
  onOpacity: (opacity: number) => void;
  onFill: (fill: string) => void;
  onNode: (index: number, axis: 'x' | 'y', value: number) => void;
};

const ILLUSTRATION_FILLS = [
  '#f5ca68', '#e99c86', '#a9d9c3', '#b8c9e6', '#d9bdea', '#282923',
];

export function ArtToolsPanel(props: ArtToolsProps) {
  const {
    brush, opacity, fill, nodes, curveClosed, onCurveClosed,
    onBrush, onOpacity, onFill, onNode,
  } = props;

  return (
    <div className="art-tools" aria-label="Illustration studio controls">
      <p className="art-tools-intro">
        Real brushes, editable paths, and room-safe strokes. Pick a mark, then draw.
      </p>
      <div className="art-brush-grid" role="group" aria-label="Brush presets">
        {BRUSH_PRESETS.map((preset) => (
          <button
            key={preset.id}
            className={`art-brush ${brush === preset.id ? 'active' : ''}`}
            aria-pressed={brush === preset.id}
            onClick={() => onBrush(preset.id)}
          >
            <svg viewBox="0 0 96 27" aria-hidden="true" className={`brush-mark ${preset.id}`}>
              <path
                d="M 7 19 C 24 3 42 27 58 13 S 79 11 88 7"
                fill="none"
                stroke="currentColor"
                strokeWidth={preset.id === 'marker' ? 9 : preset.id === 'spray' ? 5 : 3}
                strokeLinecap="round"
                strokeDasharray={preset.id === 'spray' ? '1 7' : undefined}
                opacity={preset.id === 'marker' ? 0.4 : 1}
              />
            </svg>
            <strong>{preset.label}</strong>
            <small>{preset.caption}</small>
          </button>
        ))}
      </div>
      <label htmlFor="art-opacity" className="panel-label">Ink opacity</label>
      <div className="art-value-row">
        <input
          id="art-opacity"
          type="range"
          min="5"
          max="100"
          value={Math.round(opacity * 100)}
          onChange={(event) => onOpacity(Number(event.target.value) / 100)}
        />
        <output>{Math.round(opacity * 100)}%</output>
      </div>
      <label htmlFor="art-fill" className="panel-label">Shape fill</label>
      <div className="art-fill-row">
        <input
          id="art-fill"
          type="color"
          value={fill === 'transparent' ? '#ffffff' : fill}
          onChange={(event) => onFill(event.target.value)}
          aria-label="Fill selected shape"
        />
        <button
          onClick={() => onFill('transparent')}
          aria-pressed={fill === 'transparent'}
        >
          No fill
        </button>
        <span>Selection only</span>
      </div>
      <div className="illustration-fill-presets" aria-label="Quick fill colors">
        {ILLUSTRATION_FILLS.map((swatch) => (
          <button
            key={swatch}
            type="button"
            aria-label={`Fill with ${swatch}`}
            aria-pressed={fill === swatch}
            onClick={() => onFill(swatch)}
            style={{ backgroundColor: swatch }}
          />
        ))}
      </div>
      <p className="panel-hint">
        Object eraser removes objects. Paint tab has a true pixel eraser. For a Bézier curve,
        choose the curve tool and click its start, handle, and end points.
      </p>
      {nodes && (
        <section className="art-node-editor" aria-label="Selected curve points">
          <label className="curve-close-toggle">
            <input
              type="checkbox"
              checked={curveClosed}
              onChange={(event) => onCurveClosed(event.target.checked)}
            />
            Close and fill this curve
          </label>
          <h3>Curve points</h3>
          <p>Adjust each point without flattening the vector.</p>
          {nodes.map((node, index) => (
            <div className="art-node-row" key={index}>
              <strong>{['Start', 'Handle', 'End'][index]}</strong>
              {(['x', 'y'] as const).map((axis) => (
                <label key={axis}>
                  {axis.toUpperCase()}
                  <input
                    type="number"
                    step="1"
                    value={Math.round(node[axis])}
                    onChange={(event) => onNode(index, axis, Number(event.target.value))}
                  />
                </label>
              ))}
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
