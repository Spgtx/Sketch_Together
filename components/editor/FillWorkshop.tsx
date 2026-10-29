'use client';

import { useState } from 'react';
import type { MeshColors } from '@/lib/mesh-fill';

export type GradientMode = 'linear' | 'radial';

export function FillWorkshop({ onGradient, onMesh }: {
  onGradient: (mode: GradientMode, colors: [string, string], angle: number) => void;
  onMesh: (colors: MeshColors) => void;
}) {
  const [colors, setColors] = useState<MeshColors>([
    '#f0c470', '#e9787b', '#74bdb5', '#6c84c8',
  ]);
  const [angle, setAngle] = useState(0);
  const [mode, setMode] = useState<GradientMode>('linear');

  return (
    <div className="fill-workshop">
      <img src="/art/studio/brush-workshop.svg" alt="" className="fill-doodle" />
      <h3>Color laboratory</h3>
      <p className="panel-hint">Choose two colors for shape gradients, or four for mesh art.</p>
      <div className="mesh-stops">
        {colors.map((color, index) => (
          <label key={index}>
            <span>{['Top left', 'Top right', 'Bottom left', 'Bottom right'][index]}</span>
            <input type="color" aria-label={`Mesh color ${index + 1}`} value={color}
              onChange={(event) => setColors((previous) => {
                const next = [...previous] as MeshColors;
                next[index] = event.target.value;
                return next;
              })} />
          </label>
        ))}
      </div>
      <div className="mesh-preview" role="img" aria-label="Preview of your four mesh colors"
        style={{ background: `linear-gradient(${90 + angle}deg, ${colors[0]},
          ${colors[1]}, ${colors[3]}, ${colors[2]})` }} />
      <label className="fill-field">Gradient type
        <select value={mode} onChange={(event) =>
          setMode(event.target.value as GradientMode)}>
          <option value="linear">Linear</option>
          <option value="radial">Radial</option>
        </select>
      </label>
      <label className="fill-field">Angle · {angle}°
        <input type="range" min="0" max="360" value={angle}
          onChange={(event) => setAngle(Number(event.target.value))} />
      </label>
      <button className="component-primary" onClick={() =>
        onGradient(mode, [colors[0], colors[1]], angle)}>
        Fill selected shape
      </button>
      <button className="component-primary secondary" onClick={() => onMesh(colors)}>
        Add editable mesh artwork
      </button>
      <p className="panel-hint">Mesh artwork uses a high-resolution, four-corner color surface.
        Select it and apply new corners to update its colors.</p>
    </div>
  );
}
