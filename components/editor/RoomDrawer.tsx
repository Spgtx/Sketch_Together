'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { ResizeGrip } from '@/components/editor/ResizeGrip';

import { DrawerTabNavigator, type DrawerTab }
  from '@/components/editor/DrawerTabNavigator';
export type { DrawerTab } from '@/components/editor/DrawerTabNavigator';
import { TextControls, type TextStyle } from '@/components/editor/TextControls';
import { DeviceFrames, type DevicePreset } from '@/components/editor/DeviceFrames';
import { ComponentsPanel } from '@/components/editor/ComponentsPanel';
import type { ComponentMeta, LayoutSettings, SavedComponent }
  from '@/lib/prototype-layout';
import { VectorOperations } from '@/components/editor/VectorOperations';
import type { ShapeBoolean } from '@/lib/advanced-vector';
import { FillWorkshop, type GradientMode } from '@/components/editor/FillWorkshop';
import { ExportStudio, type ExportOptions } from '@/components/editor/ExportStudio';
import type { MeshColors } from '@/lib/mesh-fill';
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

export type BrushMode = ArtToolsProps['brush'];

type Props = {
  open: boolean;
  width: number;
  height: number;
  onResize: (width: number, height: number) => void;
  onWidth: (value: number) => void;
  onClose: () => void;
  selectedText: TextStyle | null;
  onTextStyle: (changes: Partial<TextStyle>) => void;
  gridSnap: boolean;
  objectSnap: boolean;
  onGridSnap: (value: boolean) => void;
  onObjectSnap: (value: boolean) => void;
  onGroup: () => void;
  onUngroup: () => void;
  onShapeBoolean: (operation: ShapeBoolean) => void;
  onPathAction: (action: 'division' | 'fracture' | 'cut' | 'combine' |
    'break' | 'flatten') => void;
  onOffset: (amount: number) => void;
  selectedNodeCount: number;
  onSplitNode: (index: number) => void;
  onDeleteNode: (index: number) => void;
  onCornerNode: (index: number) => void;
  onGradient: (mode: GradientMode, colors: [string, string], angle: number) => void;
  onMesh: (colors: MeshColors) => void;
  onExportAdvanced: (options: ExportOptions) => void;
  hasSelection: boolean;
  onDeviceFrame: (preset: DevicePreset) => void;
  components: SavedComponent[];
  selectedComponent: ComponentMeta | null;
  layoutSettings: LayoutSettings;
  onLayoutSettings: (settings: LayoutSettings) => void;
  onSaveComponent: () => void;
  onInsertComponent: (item: SavedComponent) => void;
  onAutoLayout: () => void;
  onDeleteComponent: (id: string) => void;
  groupMembers: { id: string; name: string; fill: string; visible: boolean }[];
  onMemberFill: (id: string, color: string) => void;
  onMemberVisibility: (id: string) => void;
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

export function RoomDrawer(props: Props) {
  const {
    open, tab, onTab, color, colors, stroke, brushMode, paper, layers, checkpoints,
    width, height, onResize, onWidth, onClose, selectedText, onTextStyle, gridSnap, objectSnap,
    onGridSnap, onObjectSnap, onGroup, onUngroup, onShapeBoolean, onDeviceFrame,
    onPathAction, onOffset, selectedNodeCount, onSplitNode, onDeleteNode,
    onCornerNode, onGradient, onMesh, onExportAdvanced, hasSelection,
    components, selectedComponent, layoutSettings, onLayoutSettings,
    onSaveComponent, onInsertComponent, onAutoLayout, onDeleteComponent,
    groupMembers, onMemberFill, onMemberVisibility,
    ready, onBrush, onColor, onStroke, onPaper, onSticker, onSelectLayer,
    onMoveLayer, onToggleLayer, onDuplicate, onDelete,
    onSaveCheckpoint, onRestoreCheckpoint, onDeleteCheckpoint,
    connectorRoute, onConnectorRoute,
    opacity, fill, selectedCurveNodes, onOpacity, onFill, onNode,
    selectedCurveClosed, onCurveClosed, paintLayers, activePaintId,
    onAddPaintLayer, onSelectPaintLayer, onPaintBlend, onPaintTool,
    onRenamePaint, onTogglePaint, onDeletePaint, onExportPaint,
  } = props;

  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrollEdges, setScrollEdges] = useState({ up: false, down: false });

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;

    function update() {
      if (!element) return;
      setScrollEdges({
        up: element.scrollTop > 2,
        down: element.scrollTop + element.clientHeight < element.scrollHeight - 2,
      });
    }

    const observer = new ResizeObserver(update);
    observer.observe(element);
    const content = element.lastElementChild;
    if (content) observer.observe(content);
    update();
    return () => observer.disconnect();
  }, [tab, width, height]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [tab]);

  function nudgeContent(direction: -1 | 1) {
    scrollRef.current?.scrollBy({ top: direction * 210, behavior: 'smooth' });
  }

  return (
    <aside
      className="right-panel scrapbook-properties"
      aria-label="Creative tools and board properties"
      style={{
        '--inspector-width': `${width}px`,
        '--inspector-height': `${height}px`,
      } as CSSProperties}
    >
      <div className="maker-scroll" ref={scrollRef}
        onScroll={() => {
          const element = scrollRef.current;
          if (!element) return;
          setScrollEdges({
            up: element.scrollTop > 2,
            down: element.scrollTop + element.clientHeight < element.scrollHeight - 2,
          });
        }}>
      <div className="property-head">
        {/*<span className="property-eyebrow">THE MAKER'S DESK / ✳</span>*/}
        <div className="panel-heading-row">
          <h2 className="panel-heading">Your little tools.</h2>
          <button type="button" className="panel-close" onClick={onClose}
            aria-label="Hide inspector" title="Hide inspector">×</button>
        </div>
        <img src="/art/room/room-underline.svg" alt="" className="room-drawer-mark" />
      </div>
      <DrawerTabNavigator value={tab} onChange={onTab} />
      {tab === 'text' && (
        <div className="property-tab-content" id="studio-panel-text"
          aria-labelledby="studio-tab-text" role="tabpanel">
          <TextControls value={selectedText} onChange={onTextStyle} />
        </div>
      )}
      {tab === 'vectors' && (
        <div className="property-tab-content" id="studio-panel-vectors"
          aria-labelledby="studio-tab-vectors" role="tabpanel">
          <VectorOperations onOperate={onShapeBoolean}
            onGroup={onGroup} onUngroup={onUngroup}
            gridSnap={gridSnap} objectSnap={objectSnap}
            onSnap={onGridSnap} onSnapObjects={onObjectSnap}
            onPathAction={onPathAction} onOffset={onOffset}
            selectedNodeCount={selectedNodeCount} onSplitNode={onSplitNode}
            onDeleteNode={onDeleteNode} onCornerNode={onCornerNode}
            groupMembers={groupMembers} onMemberFill={onMemberFill}
            onMemberVisibility={onMemberVisibility} />
        </div>
      )}
      {tab === 'fills' && (
        <div className="property-tab-content" id="studio-panel-fills"
          aria-labelledby="studio-tab-fills" role="tabpanel">
          <FillWorkshop onGradient={onGradient} onMesh={onMesh} />
        </div>
      )}
      {tab === 'export' && (
        <div className="property-tab-content" id="studio-panel-export"
          aria-labelledby="studio-tab-export" role="tabpanel">
          <ExportStudio onExport={onExportAdvanced} hasSelection={hasSelection} />
        </div>
      )}
      {tab === 'frames' && (
        <div className="property-tab-content" id="studio-panel-frames"
          aria-labelledby="studio-tab-frames" role="tabpanel">
          <DeviceFrames onAdd={onDeviceFrame} />
        </div>
      )}
      {tab === 'components' && (
        <div className="property-tab-content" id="studio-panel-components"
          aria-labelledby="studio-tab-components" role="tabpanel">
          <ComponentsPanel items={components} selected={selectedComponent}
            settings={layoutSettings} onSettings={onLayoutSettings}
            onCreate={onSaveComponent} onInsert={onInsertComponent}
            onLayout={onAutoLayout} onDelete={onDeleteComponent} />
        </div>
      )}
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
        <div id="studio-panel-paint" aria-labelledby="studio-tab-paint"
          role="tabpanel" className="property-tab-content">
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
        <div id="studio-panel-stickers" aria-labelledby="studio-tab-stickers"
          role="tabpanel" className="property-tab-content">
          <StickerShelf onSelect={onSticker} disabled={!ready} />
        </div>
      )}
      {tab === 'paper' && (
        <div id="studio-panel-paper" aria-labelledby="studio-tab-paper"
          role="tabpanel" className="property-tab-content">
          <PaperPicker value={paper} onChange={onPaper} />
        </div>
      )}
      {tab === 'saves' && (
        <div id="studio-panel-saves" aria-labelledby="studio-tab-saves"
          role="tabpanel" className="property-tab-content">
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
        <div id="studio-panel-layers" aria-labelledby="studio-tab-layers"
          role="tabpanel" className="property-tab-content">
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
      </div>
      <div className="maker-scroll-controls" aria-label="Scroll studio tool settings">
        <button type="button" onClick={() => nudgeContent(-1)}
          disabled={!scrollEdges.up} aria-label="Scroll tool settings up" title="Scroll up">
          ↑
        </button>
        {/*<span>SCROLL TO EXPLORE</span>*/}
        <button type="button" onClick={() => nudgeContent(1)}
          disabled={!scrollEdges.down} aria-label="Scroll tool settings down"
          title="Scroll down">
          ↓
        </button>
      </div>
      <ResizeGrip
        side="right"
        label="Resize maker's desk horizontally or vertically"
        width={width}
        height={height}
        onResize={onResize}
      />
    </aside>
  );
}
