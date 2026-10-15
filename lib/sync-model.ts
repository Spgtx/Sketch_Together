/** The v3 cloud document is a collection of individually versioned Fabric objects. */
export type SyncPolicy = 'protected' | 'classic';
export type SyncKind = 'add' | 'modify' | 'remove' | 'clear' | 'replace';
export type CanvasObject = Record<string, unknown> & { id: string };
export type FabricState = Record<string, unknown> & { objects: CanvasObject[] };
export type SyncDocument = {
  revision: number;
  updatedAt: number;
  objects: Record<string, CanvasObject>;
  versions: Record<string, number>;
  seen: Record<string, number>;
  recent: string[];
  policy: SyncPolicy;
};
export type SyncChange = {
  opId: string;
  actor: string;
  policy: SyncPolicy;
  kind: SyncKind;
  id?: string;
  object?: CanvasObject;
  state?: FabricState;
  baseVersion?: number;
  baseRevision?: number;
};

export function freshDocument(): SyncDocument {
  return {
    revision: 0,
    updatedAt: 0,
    objects: {},
    versions: {},
    seen: {},
    recent: [],
    policy: 'protected',
  };
}

export function fromFabricState(state: FabricState): SyncDocument {
  const document = freshDocument();
  state.objects.forEach((object, index) => {
    // Pre-v3 template objects did not always have IDs.
    const id = typeof object.id === 'string' && object.id
      ? object.id
      : `legacy-${index}`;
    document.objects[id] = { ...object, id };
    document.versions[id] = 0;
  });
  return document;
}

export function toFabricState(document: SyncDocument): FabricState {
  return {
    version: '6.9.0',
    objects: Object.values(document.objects),
  };
}

/** Reject remote asset URLs and pathological nested objects in shared Fabric JSON. */
export function safeCanvasData(value: unknown, depth = 0): boolean {
  if (depth > 12) return false;
  if (typeof value === 'string') return value.length <= 4_000_000;
  if (value === null || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (Array.isArray(value)) {
    return value.length <= 2000 && value.every((item) => safeCanvasData(item, depth + 1));
  }
  if (!value || typeof value !== 'object') return false;
  const entries = Object.entries(value);
  if (entries.length > 120) return false;
  return entries.every(([key, item]) => {
    if (key.length > 80) return false;
    if (key === 'src' || key === 'href' || key === 'xlink:href') {
      return typeof item === 'string' &&
        /^data:image\/(png|jpeg|webp|gif);base64,[a-zA-Z0-9+/=]+$/.test(item);
    }
    if (key === 'url' && typeof item === 'string') {
      return !/^(https?:|javascript:|file:)/i.test(item);
    }
    return safeCanvasData(item, depth + 1);
  });
}

export function validChange(raw: unknown): raw is SyncChange {
  if (!raw || typeof raw !== 'object') return false;
  const op = raw as Partial<SyncChange>;
  if (!['protected', 'classic'].includes(op.policy || '')) return false;
  if (!['add', 'modify', 'remove', 'clear', 'replace'].includes(op.kind || '')) {
    return false;
  }
  if (!op.opId || !/^[a-zA-Z0-9_-]{8,80}$/.test(op.opId)) return false;
  if (!op.actor || !/^[a-zA-Z0-9_-]{8,80}$/.test(op.actor)) return false;
  if (op.kind === 'replace') {
    return Boolean(op.state && Array.isArray(op.state.objects) &&
      op.state.objects.length <= 1500 &&
      op.state.objects.every((obj) => obj && typeof obj.id === 'string' &&
        /^[A-Za-z0-9_-]{1,80}$/.test(obj.id) && safeCanvasData(obj)));
  }
  if (op.kind === 'clear') return true;
  if (!op.id || !/^[a-zA-Z0-9_-]{1,80}$/.test(op.id)) return false;
  if (op.kind === 'remove') return true;
  return Boolean(op.object && op.object.id === op.id &&
    typeof op.object.type === 'string' && op.object.type.length < 32 &&
    safeCanvasData(op.object));
}

/** Pure reference implementation for tests; production writes are atomic in Redis Lua. */
export function applyChange(
  document: SyncDocument,
  change: SyncChange,
): { document: SyncDocument; accepted: boolean; duplicate?: boolean } {
  if (document.seen[change.opId] !== undefined) {
    return { document, accepted: true, duplicate: true };
  }
  const next = structuredClone(document);
  const boardChange = change.kind === 'replace' || change.kind === 'clear';
  const currentVersion = change.id ? next.versions[change.id] ?? -1 : -1;
  if (next.policy !== 'classic') {
    if (boardChange && change.baseRevision !== next.revision) {
      return { document, accepted: false };
    }
    if (!boardChange && change.baseVersion !== currentVersion) {
      return { document, accepted: false };
    }
  }
  next.revision += 1;
  next.updatedAt = Date.now();
  if (change.kind === 'clear' || change.kind === 'replace') {
    const newObjects = change.kind === 'replace' ? change.state!.objects : [];
    for (const id of Object.keys(next.objects)) next.versions[id] = next.revision;
    next.objects = {};
    for (const item of newObjects) {
      next.objects[item.id] = item;
      next.versions[item.id] = next.revision;
    }
  } else if (change.id) {
    if (change.kind === 'remove') delete next.objects[change.id];
    else next.objects[change.id] = change.object!;
    next.versions[change.id] = next.revision;
  }
  next.seen[change.opId] = next.revision;
  next.recent.push(change.opId);
  if (next.recent.length > 160) {
    const discarded = next.recent.shift()!;
    delete next.seen[discarded];
  }
  return { document: next, accepted: true };
}
