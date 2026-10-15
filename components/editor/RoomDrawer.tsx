'use client';

import { StudioIcon } from '@/components/StudioIcon';
import { RasterToolsPanel, type PaintLayerItem } from '@/components/editor/RasterToolsPanel';
import type { BlendMode } from '@/lib/raster-paint';
import { LayersPanel, type LayerItem } from '@/components/editor/LayersPanel';
import { PaperPicker, type PaperStyle } from '@/components/editor/PaperPicker';
import { StickerShelf } from '@/components/editor/StickerShelf';
import { CheckpointsPanel, type Checkpoint } from '@/components/editor/CheckpointsPanel';
import { ConnectorPicker } from '@/components/editor/ConnectorPicker';
import type { ConnectorRoute } from '@/lib/connector-geometry';
import type { StickerId } from '@/lib/stickers';
import {
  ArtToolsPanel,
  type ArtToolsProps,
} from '@/components/editor/ArtToolsPanel';

export type DrawerTab = 'ink' | 'paint' | 'stickers' | 'paper' | 'layers' | 'saves';
export type BrushMode = ArtToolsProps['brush'];

type Props = {
  open: boolean;
  tab: DrawerTab;
  onTab: (tab: DrawerTab) => void;
  color: string;
  colors: string[];
  stroke: number;
  brushMode: BrushMode;
  opacity: ArtToolsProps['opacity'];
  fill: ArtToolsProps['fill'];
  selectedCurveNodes: ArtToolsProps['nodes'];
  selectedCurveClosed: boolean;
  onCurveClosed: (closed: boolean) => void;
  paintLayers: PaintLayerItem[];
  activePaintId: string | null;
  onAddPaintLayer: () => void;
  onSelectPaintLayer: (id: string) => void;
  onPaintBlend: (blend: BlendMode) => void;
  onRenamePaint: (name: string) => void;
  onTogglePaint: () => void;
  onDeletePaint: () => void;
  onExportPaint: () => void;
  onPaintTool: (tool: 'raster-paint' | 'raster-erase' | 'raster-fill') => void;
  onOpacity: ArtToolsProps['onOpacity'];
  onFill: ArtToolsProps['onFill'];
  onNode: ArtToolsProps['onNode'];
  paper: PaperStyle;
  connectorRoute: ConnectorRoute;
  onConnectorRoute: (route: ConnectorRoute) => void;
  layers: LayerItem[];
  checkpoints: Checkpoint[];
  ready: boolean;
  onBrush: (mode: BrushMode) => void;
  onColor: (color: string) => void;
  onStroke: (width: number) => void;
  onPaper: (paper: PaperStyle) => void;
  onSticker: (id: StickerId) => void;
  onSelectLayer: (id: string) => void;
  onMoveLayer: (id: string, direction: 'up' | 'down') => void;
  onToggleLayer: (id: string) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onSaveCheckpoint: () => void;
  onRestoreCheckpoint: (checkpoint: Checkpoint) => void;
  onDeleteCheckpoint: (id: string) => void;
};

const TABS: { id: DrawerTab; label: string }[] = [
  { id: 'ink', label: 'Art' },
  { id: 'paint', label: 'Paint' },
  { id: 'stickers', label: 'Stickers' },
  { id: 'paper', label: 'Paper' },
  { id: 'layers', label: 'Layers' },
  { id: 'saves', label: 'Saves' },
];

export function RoomDrawer(props: Props) {
  const {
    open, tab, onTab, color, colors, stroke, brushMode, paper, layers, checkpoints,
    ready, onBrush, onColor, onStroke, onPaper, onSticker, onSelectLayer,
    onMoveLayer, onToggleLayer, onDuplicate, onDelete,
    onSaveCheckpoint, onRestoreCheckpoint, onDeleteCheckpoint,
    connectorRoute, onConnectorRoute,
    opacity, fill, selectedCurveNodes, onOpacity, onFill, onNode,
    selectedCurveClosed, onCurveClosed, paintLayers, activePaintId,
    onAddPaintLayer, onSelectPaintLayer, onPaintBlend, onPaintTool,
    onRenamePaint, onTogglePaint, onDeletePaint, onExportPaint,
  } = props;

  return (
    <aside
      className={`right-panel scrapbook-properties ${open ? '' : 'panel-closed'}`}
      aria-label="Creative tools and board properties"
    >
      <div className="property-head">
        <span className="property-eyebrow">THE MAKER'S DESK / ✳</span>
        <h2 className="panel-heading">Your little tools.</h2>
        <img src="/art/room/room-underline.svg" alt="" className="room-drawer-mark" />
      </div>
      <div className="property-tabs" role="tablist" aria-label="Creative tools">
        {TABS.map((item) => (
          <button
            key={item.id}
            id={`studio-tab-${item.id}`}
            role="tab"
            aria-selected={tab === item.id}
            aria-controls={`studio-panel-${item.id}`}
            className={tab === item.id ? 'active' : ''}
            onClick={() => onTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>
      {tab === 'ink' && (
        <div
          id="studio-panel-ink"
          aria-labelledby="studio-tab-ink"
          className="property-tab-content"
          role="tabpanel"
        >
          <img
            src="/art/studio/brush-workshop.svg"
            alt=""
            className="art-workshop-illustration"
          />
          <ArtToolsPanel
            brush={brushMode}
            opacity={opacity}
            fill={fill}
            nodes={selectedCurveNodes}
            curveClosed={selectedCurveClosed}
            onCurveClosed={onCurveClosed}
            onBrush={onBrush}
            onOpacity={onOpacity}
            onFill={onFill}
            onNode={onNode}
          />
          <span className="panel-label">Your colors</span>
          <div className="color-grid">
            {colors.map((swatch) => (
              <button
                key={swatch}
                className={`color-swatch ${color === swatch ? 'active' : ''}`}
                style={{ background: swatch }}
                onClick={() => onColor(swatch)}
                title={`Ink color ${swatch}`}
                aria-label={`Choose ink color ${swatch}`}
                aria-pressed={color === swatch}
              />
            ))}
            <label className="color-swatch custom" title="Custom color">
              <input
                aria-label="Pick custom ink color"
                type="color"
                value={color}
                onChange={(event) => onColor(event.target.value)}
              />
            </label>
          </div>
          <span className="panel-label">Pen thickness</span>
          <input
            className="range"
            type="range"
            min="1"
            max="20"
            value={stroke}
            onChange={(event) => onStroke(Number(event.target.value))}
            aria-label="Stroke width"
          />
          <div className="stroke-row">
            <span>Fine line</span>
            <strong>{stroke}px</strong>
            <span>Bold mark</span>
          </div>
          <div className="panel-divider" />
          <span className="panel-label">Smart connections</span>
          <ConnectorPicker route={connectorRoute} onChange={onConnectorRoute} />
          <p className="panel-hint">
            Double-click text to edit. Select a shape to move, recolor, or resize it.
          </p>
        </div>
      )}
      {tab === 'paint' && (
        <div id="studio-panel-paint" role="tabpanel" className="property-tab-content">
          <RasterToolsPanel
            layers={paintLayers}
            activeId={activePaintId}
            color={color}
            stroke={stroke}
            opacity={opacity}
            onAdd={onAddPaintLayer}
            onSelect={onSelectPaintLayer}
            onBlend={onPaintBlend}
            onRename={onRenamePaint}
            onToggle={onTogglePaint}
            onDelete={onDeletePaint}
            onExport={onExportPaint}
            onTool={onPaintTool}
            onColor={onColor}
            onStroke={onStroke}
            onOpacity={onOpacity}
          />
        </div>
      )}
      {tab === 'stickers' && (
        <div id="studio-panel-stickers" role="tabpanel" className="property-tab-content">
          <StickerShelf onSelect={onSticker} disabled={!ready} />
        </div>
      )}
      {tab === 'paper' && (
        <div id="studio-panel-paper" role="tabpanel" className="property-tab-content">
          <PaperPicker value={paper} onChange={onPaper} />
        </div>
      )}
      {tab === 'saves' && (
        <div id="studio-panel-saves" role="tabpanel" className="property-tab-content">
          <CheckpointsPanel
            checkpoints={checkpoints}
            disabled={!ready}
            onCreate={onSaveCheckpoint}
            onRestore={onRestoreCheckpoint}
            onDelete={onDeleteCheckpoint}
          />
        </div>
      )}
      {tab === 'layers' && (
        <div id="studio-panel-layers" role="tabpanel" className="property-tab-content">
          <LayersPanel
            layers={layers}
            onSelect={onSelectLayer}
            onToggleVisibility={onToggleLayer}
            onMove={onMoveLayer}
            onDuplicate={onDuplicate}
            onDelete={onDelete}
            canEdit={ready}
          />
        </div>
      )}
    </aside>
  );
}
