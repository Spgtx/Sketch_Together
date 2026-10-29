'use client';

import { useState } from 'react';

export type ImageFormat = 'png' | 'jpeg' | 'webp' | 'svg' | 'json';
export type ExportOptions = {
  format: ImageFormat;
  multiplier: number;
  transparent: boolean;
  selectionOnly: boolean;
};

export function ExportStudio({ onExport, hasSelection }: {
  onExport: (options: ExportOptions) => void;
  hasSelection: boolean;
}) {
  const [format, setFormat] = useState<ImageFormat>('png');
  const [multiplier, setMultiplier] = useState(2);
  const [transparent, setTransparent] = useState(false);
  const [selectionOnly, setSelectionOnly] = useState(false);
  return (
    <div className="export-studio">
      <h3>Take your artwork home.</h3>
      <p className="panel-hint">Download the board, selected objects or an editable backup.</p>
      <label>File format
        <select value={format} onChange={(event) =>
          setFormat(event.target.value as ImageFormat)}>
          <option value="png">PNG · lossless image</option>
          <option value="jpeg">JPEG · smaller photograph-style image</option>
          <option value="webp">WebP · compact artwork</option>
          <option value="svg">SVG · scalable vectors</option>
          <option value="json">JSON · editable board backup</option>
        </select>
      </label>
      {format !== 'json' && format !== 'svg' && (
        <label>Resolution
          <select value={multiplier} onChange={(event) =>
            setMultiplier(Number(event.target.value))}>
            <option value={1}>1× · original size</option>
            <option value={2}>2× · high resolution</option>
            <option value={3}>3× · extra detail</option>
            <option value={4}>4× · print-sized</option>
          </select>
        </label>
      )}
      {format !== 'json' && format !== 'jpeg' && (
        <label className="export-checkbox">
          <input type="checkbox" checked={transparent}
            onChange={(event) => setTransparent(event.target.checked)} />
          Transparent background
        </label>
      )}
      {format !== 'json' && (
        <label className="export-checkbox">
          <input type="checkbox" checked={selectionOnly}
            disabled={!hasSelection}
            onChange={(event) => setSelectionOnly(event.target.checked)} />
          Export only selected objects
        </label>
      )}
      <button className="component-primary" onClick={() => onExport({
        format, multiplier, transparent, selectionOnly,
      })}>Download {format.toUpperCase()}</button>
    </div>
  );
}
