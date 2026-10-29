'use client';
import { RoomToolRail } from '@/components/editor/RoomToolRail';
import { RoomDrawer } from '@/components/editor/RoomDrawer';
import { COLORS } from './room-model';
import type { RoomViewProps } from './room-view-types';

export function RoomPanelDock(scope: RoomViewProps) {
  const {
    canvasRef,
    title,
    panelOpen,
    setPanelOpen,
    setRailOpen,
    railOpen,
    setPanelTab,
    paper,
    tool,
    selectedCurveNodes,
    selectedPenNodes,
    ready,
    layers,
    changeTool,
    imageInputRef,
    removeSelected,
    railSize,
    railWidth,
    railHeight,
    setRailWidth,
    setRailHeight,
    panelWidth,
    panelHeight,
    setPanelWidth,
    setPanelHeight,
    panelTab,
    color,
    stroke,
    brushMode,
    opacity,
    fill,
    selectedCurveClosed,
    setCurveClosed,
    paintLayers,
    activePaintId,
    addPaintLayer,
    selectPaintLayer,
    changePaintBlend,
    renamePaintLayer,
    togglePaintLayer,
    deletePaintLayer,
    exportPaintLayer,
    changeOpacity,
    changeFill,
    updateCurveNode,
    selectedText,
    updateSelectedText,
    gridSnap,
    objectSnap,
    setGridSnap,
    setObjectSnap,
    groupSelected,
    ungroupSelected,
    applyShapeBoolean,
    pathWorkshopAction,
    offsetSelected,
    splitSelectedNode,
    deleteSelectedNode,
    cornerSelectedNode,
    applyShapeGradient,
    applyMeshFill,
    advancedExport,
    addDeviceFrame,
    components,
    selectedComponent,
    layoutSettings,
    setLayoutSettings,
    saveComponent,
    insertComponent,
    autoLayoutSelected,
    deleteComponent,
    groupMembers,
    modifyGroupMember,
    connectorRoute,
    changeConnectorRoute,
    checkpoints,
    changeBrushMode,
    changeColor,
    changeStroke,
    changePaper,
    addSticker,
    focusLayer,
    moveLayer,
    toggleLayer,
    duplicateSelected,
    createCheckpoint,
    restoreCheckpoint,
    deleteCheckpoint,
  } = scope;
  return (
    <>
    {railOpen && <RoomToolRail
                tool={tool}
                ready={ready}
                onTool={changeTool}
                onStickers={() => {
                  setPanelTab('stickers');
                  setPanelOpen(true);
                }}
                onImage={() => imageInputRef.current?.click()}
                onLayers={() => {
                  setPanelTab('layers');
                  setPanelOpen(true);
                }}
                onDelete={removeSelected}
                size={railSize}
                width={railWidth}
                height={railHeight}
                onResize={(width, height) => {
                  setRailWidth(width);
                  setRailHeight(height);
                }}
              />}
      
              {panelOpen && <RoomDrawer
                open={panelOpen}
                width={panelWidth}
                height={panelHeight}
                onResize={(width, height) => {
                  setPanelWidth(width);
                  setPanelHeight(height);
                }}
                onWidth={setPanelWidth}
                onClose={() => setPanelOpen(false)}
                tab={panelTab}
                onTab={setPanelTab}
                color={color}
                colors={COLORS}
                stroke={stroke}
                brushMode={brushMode}
                opacity={opacity}
                fill={fill}
                selectedCurveNodes={selectedCurveNodes}
                selectedCurveClosed={selectedCurveClosed}
                onCurveClosed={setCurveClosed}
                paintLayers={paintLayers}
                activePaintId={activePaintId}
                onAddPaintLayer={addPaintLayer}
                onSelectPaintLayer={selectPaintLayer}
                onPaintBlend={changePaintBlend}
                onRenamePaint={renamePaintLayer}
                onTogglePaint={togglePaintLayer}
                onDeletePaint={deletePaintLayer}
                onExportPaint={exportPaintLayer}
                onPaintTool={changeTool}
                onOpacity={changeOpacity}
                onFill={changeFill}
                onNode={updateCurveNode}
                selectedText={selectedText}
                onTextStyle={updateSelectedText}
                gridSnap={gridSnap}
                objectSnap={objectSnap}
                onGridSnap={setGridSnap}
                onObjectSnap={setObjectSnap}
                onGroup={groupSelected}
                onUngroup={ungroupSelected}
                onShapeBoolean={applyShapeBoolean}
                onPathAction={(action) => void pathWorkshopAction(action)}
                onOffset={offsetSelected}
                selectedNodeCount={selectedPenNodes?.length || 0}
                onSplitNode={splitSelectedNode}
                onDeleteNode={deleteSelectedNode}
                onCornerNode={cornerSelectedNode}
                onGradient={applyShapeGradient}
                onMesh={(colors) => void applyMeshFill(colors)}
                onExportAdvanced={advancedExport}
                hasSelection={Boolean(selectedPenNodes || selectedCurveNodes || selectedText ||
                  canvasRef.current?.getActiveObjects().length)}
                onDeviceFrame={addDeviceFrame}
                components={components}
                selectedComponent={selectedComponent}
                layoutSettings={layoutSettings}
                onLayoutSettings={setLayoutSettings}
                onSaveComponent={saveComponent}
                onInsertComponent={(item) => void insertComponent(item)}
                onAutoLayout={autoLayoutSelected}
                onDeleteComponent={deleteComponent}
                groupMembers={groupMembers}
                onMemberFill={(id, color) => modifyGroupMember(id, { fill: color })}
                onMemberVisibility={(id) => {
                  const current = groupMembers.find((member) => member.id === id);
                  if (current) modifyGroupMember(id, { visible: !current.visible });
                }}
                paper={paper}
                connectorRoute={connectorRoute}
                onConnectorRoute={changeConnectorRoute}
                layers={layers}
                checkpoints={checkpoints}
                ready={ready}
                onBrush={changeBrushMode}
                onColor={changeColor}
                onStroke={changeStroke}
                onPaper={changePaper}
                onSticker={(id) => void addSticker(id)}
                onSelectLayer={focusLayer}
                onMoveLayer={moveLayer}
                onToggleLayer={toggleLayer}
                onDuplicate={() => void duplicateSelected()}
                onDelete={removeSelected}
                onSaveCheckpoint={createCheckpoint}
                onRestoreCheckpoint={(checkpoint) => void restoreCheckpoint(checkpoint)}
                onDeleteCheckpoint={deleteCheckpoint}
              />}
      
              {!railOpen && (
                <button type="button" className="dock-handle dock-left"
                  onClick={() => setRailOpen(true)} title="Show drawing tools">
                  ✎ Tools
                </button>
              )}
              {!panelOpen && (
                <button type="button" className="dock-handle dock-right"
                  onClick={() => setPanelOpen(true)} title="Show maker's desk">
                  Desk ✳
                </button>
              )}
    </>
  );
}
