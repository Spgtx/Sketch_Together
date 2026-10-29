'use client';
import { useState } from 'react';
import type { ShapeBoolean } from '@/lib/advanced-vector';

const OPERATIONS: { id: ShapeBoolean; name: string; caption: string }[] = [
  { id: 'union', name: 'Union', caption: 'Combine two shapes' },
  { id: 'difference', name: 'Difference', caption: 'Subtract the top shape' },
  { id: 'intersection', name: 'Intersect', caption: 'Keep their shared area' },
  { id: 'exclusion', name: 'Exclude', caption: 'Remove the overlap' },
];

export function VectorOperations({ onOperate, onGroup, onUngroup, onSnap,
  gridSnap, objectSnap, onSnapObjects, groupMembers,
  onMemberFill, onMemberVisibility, onPathAction,
  onOffset, selectedNodeCount, onSplitNode, onDeleteNode,
  onCornerNode }: {
  onOperate: (operation: ShapeBoolean) => void;
  onGroup: () => void;
  onUngroup: () => void;
  onPathAction: (action: 'division' | 'fracture' | 'cut' | 'combine' |
    'break' | 'flatten') => void;
  onOffset: (amount: number) => void;
  selectedNodeCount: number;
  onSplitNode: (index: number) => void;
  onDeleteNode: (index: number) => void;
  onCornerNode: (index: number) => void;
  gridSnap: boolean;
  objectSnap: boolean;
  onSnap: (value: boolean) => void;
  onSnapObjects: (value: boolean) => void;
  groupMembers: { id: string; name: string; fill: string; visible: boolean }[];
  onMemberFill: (id: string, color: string) => void;
  onMemberVisibility: (id: string) => void;
}) {
  const [offset, setOffset] = useState(12);
  const [nodeIndex, setNodeIndex] = useState(1);
  const selectedIndex = Math.min(Math.max(0, nodeIndex), selectedNodeCount - 1);
  return (
    <div className="vector-operations">
      <div className="vector-action-pair">
        <button onClick={onGroup}>Group · Ctrl+G</button>
        <button onClick={onUngroup}>Ungroup · Ctrl+Shift+G</button>
      </div>
      <label><input type="checkbox" checked={gridSnap}
        onChange={(event) => onSnap(event.target.checked)} /> Snap to 20px grid</label>
      <label><input type="checkbox" checked={objectSnap}
        onChange={(event) => onSnapObjects(event.target.checked)} /> Snap to objects</label>
      {groupMembers.length > 0 && (
        <div className="group-member-inspector">
          <h3>Inside this group</h3>
          <p className="panel-hint">
            Edit members separately. Protected rooms detect conflicts per member.
          </p>
          {groupMembers.map((member) => (
            <div className="group-member-row" key={member.id}>
              <span title={member.name}>{member.name}</span>
              <label title={`Fill for ${member.name}`}>
                <input type="color" value={member.fill} aria-label={`Fill ${member.name}`}
                  onChange={(event) => onMemberFill(member.id, event.target.value)} />
              </label>
              <button type="button" onClick={() => onMemberVisibility(member.id)}>
                {member.visible ? 'Hide' : 'Show'}
              </button>
            </div>
          ))}
        </div>
      )}
      {selectedNodeCount > 0 && (
        <section className="vector-node-actions">
          <h3>Edit path nodes</h3>
          <label>Node index ({selectedNodeCount} total)
            <input type="number" min={0} max={selectedNodeCount - 1}
              value={selectedIndex} onChange={(event) =>
                setNodeIndex(Number(event.target.value))} />
          </label>
          <div className="vector-action-pair">
            <button onClick={() => onCornerNode(selectedIndex)}>Corner / smooth</button>
            <button onClick={() => onSplitNode(selectedIndex)}>Split here</button>
            <button onClick={() => onDeleteNode(selectedIndex)}>Remove node</button>
          </div>
        </section>
      )}
      <h3>Path workshop</h3>
      <p className="panel-hint">Choose two shapes for cuts or divisions.
        Open paths support node splitting; shape divisions create separate objects.</p>
      <div className="vector-action-list">
        {([
          ['division', 'Division', 'Divide the lower shape at overlaps'],
          ['fracture', 'Fracture', 'Create all overlapping pieces'],
          ['cut', 'Cut path', 'Split an open line at crossings'],
          ['combine', 'Combine', 'Make one compound vector path'],
          ['break', 'Break apart', 'Separate compound subpaths'],
          ['flatten', 'Flatten', 'Rasterize selection into one image'],
        ] as const).map(([id, name, caption]) => (
          <button key={id} onClick={() => onPathAction(id)}>
            <strong>{name}</strong><small>{caption}</small>
          </button>
        ))}
      </div>
      <h3>Inset / Outset / Dynamic offset</h3>
      <p className="panel-hint">Polygonal offsets are approximations. Complex concave
        shapes may need manual node cleanup.</p>
      <label>Offset distance · {offset}px
        <input type="range" min="1" max="80" value={offset}
          onChange={(event) => setOffset(Number(event.target.value))} />
      </label>
      <div className="vector-action-pair">
        <button onClick={() => onOffset(-offset)}>Inset</button>
        <button onClick={() => onOffset(offset)}>Outset</button>
        <button onClick={() => onOffset(offset)}>Apply offset</button>
      </div>
      <h3>Shape operations</h3>
      <p className="panel-hint">Select exactly two closed vector shapes. Curves are flattened into
        fine segments; open paths and raster objects stay unchanged.</p>
      <div className="vector-action-list">
        {OPERATIONS.map((operation) => (
          <button key={operation.id} onClick={() => onOperate(operation.id)}>
            <strong>{operation.name}</strong><small>{operation.caption}</small>
          </button>
        ))}
      </div>
    </div>
  );
}
