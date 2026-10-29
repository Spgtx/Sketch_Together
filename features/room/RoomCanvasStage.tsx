'use client';
import type { CSSProperties } from 'react';
import type { Cursor } from './room-model';
import { Point, util } from 'fabric';
import { CurveHandles } from '@/components/editor/CurveHandles';
import { PenHandles } from '@/components/editor/PenHandles';
import { ReactionBursts } from '@/components/editor/ReactionBursts';
import type { RoomViewProps } from './room-view-types';

export function RoomCanvasStage(scope: RoomViewProps) {
  const {
    canvasRef,
    stageRef,
    paper,
    canvasElementRef,
    rasterPreviewRef,
    tool,
    selectedCurveNodes,
    viewportTick,
    replaceCurveNodes,
    selectedPenNodes,
    replacePenNodes,
    ready,
    layers,
    bursts,
    cursors,
  } = scope;
  const cursorToScreen = (c: Cursor) => {
        const transform = canvasRef.current?.viewportTransform;
        if (!transform) return { left: c.x, top: c.y };
        return {
          left: c.x * transform[0] + c.y * transform[2] + transform[4],
          top: c.x * transform[1] + c.y * transform[3] + transform[5],
        };
      };
  return (
    <div ref={stageRef} className={`canvas-stage paper-${paper}`}>
                <canvas ref={canvasElementRef} aria-label="Editable whiteboard canvas" />
                <canvas ref={rasterPreviewRef} className="raster-stroke-preview" aria-hidden="true" />
                {(tool === 'select' || tool === 'node') && selectedCurveNodes && (
                  <CurveHandles
                    key={`${selectedCurveNodes.length}-${viewportTick}`}
                    nodes={selectedCurveNodes}
                    screen={selectedCurveNodes.map((node) => {
                      const transform = canvasRef.current?.viewportTransform;
                      const point = transform
                        ? util.transformPoint(new Point(node.x, node.y), transform)
                        : new Point(node.x, node.y);
                      return { x: point.x, y: point.y };
                    })}
                    screenToWorld={(point) => {
                      const transform = canvasRef.current?.viewportTransform;
                      const result = transform
                        ? util.transformPoint(new Point(point.x, point.y),
                          util.invertTransform(transform))
                        : new Point(point.x, point.y);
                      return { x: result.x, y: result.y };
                    }}
                    onCommit={replaceCurveNodes}
                  />
                )}
                {(tool === 'select' || tool === 'node') && selectedPenNodes && (
                  <PenHandles
                    nodes={selectedPenNodes}
                    toScreen={(point) => {
                      const transform = canvasRef.current?.viewportTransform;
                      const result = transform
                        ? util.transformPoint(new Point(point.x, point.y), transform)
                        : new Point(point.x, point.y);
                      return { x: result.x, y: result.y };
                    }}
                    toWorld={(point) => {
                      const transform = canvasRef.current?.viewportTransform;
                      const result = transform
                        ? util.transformPoint(new Point(point.x, point.y),
                          util.invertTransform(transform))
                        : new Point(point.x, point.y);
                      return { x: result.x, y: result.y };
                    }}
                    onCommit={replacePenNodes}
                  />
                )}
                {ready && layers.length === 0 && (
                  <div className="room-empty-hint" aria-hidden="true">
                    <img src="/art/room/first-mark.svg" alt="" />
                    <p>Your first mark goes here.</p>
                    <span>Pick up a pencil, drop a note, or peel a sticker.</span>
                  </div>
                )}
                <ReactionBursts bursts={bursts} />
                {Object.entries(cursors).map(([id, cursor]) => (
                  <div
                    key={id}
                    className="cursor-overlay"
                    style={{
                      ...cursorToScreen(cursor),
                      '--cursor': cursor.color,
                    } as CSSProperties}
                  >
                    <span className="cursor-pointer" />
                    <span className="cursor-label">{cursor.name}</span>
                  </div>
                ))}
              </div>
  );
}
