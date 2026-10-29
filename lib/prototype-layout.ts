/** Serializable reusable component metadata and deterministic 1D auto layout. */
export type LayoutDirection = 'horizontal' | 'vertical';
export type LayoutSettings = {
  direction: LayoutDirection;
  gap: number;
  padding: number;
};
export type LayoutItem = { width: number; height: number };
export type LayoutPosition = { x: number; y: number };
export type LayoutResult = {
  width: number;
  height: number;
  positions: LayoutPosition[];
};
export type ComponentMeta = {
  id: string;
  name: string;
  kind: 'master' | 'instance';
  layout?: LayoutSettings;
};
export type SavedComponent = {
  id: string;
  name: string;
  data: Record<string, unknown>;
};
export const DEFAULT_LAYOUT: LayoutSettings = {
  direction: 'vertical', gap: 12, padding: 18,
};

export function normalizeLayout(raw: Partial<LayoutSettings>): LayoutSettings {
  return {
    direction: raw.direction === 'horizontal' ? 'horizontal' : 'vertical',
    gap: Math.max(0, Math.min(160, Number(raw.gap) || 0)),
    padding: Math.max(0, Math.min(160, Number(raw.padding) || 0)),
  };
}

export function computeAutoLayout(
  items: LayoutItem[],
  input: LayoutSettings,
): LayoutResult {
  const settings = normalizeLayout(input);
  const horizontal = settings.direction === 'horizontal';
  const safe = items.map((item) => ({
    width: Math.max(1, Number.isFinite(item.width) ? item.width : 1),
    height: Math.max(1, Number.isFinite(item.height) ? item.height : 1),
  }));
  const main = safe.reduce((total, item) =>
    total + (horizontal ? item.width : item.height), 0) +
    settings.gap * Math.max(0, safe.length - 1);
  const cross = Math.max(0, ...safe.map((item) =>
    horizontal ? item.height : item.width));
  let cursor = settings.padding;
  const positions = safe.map((item) => {
    const x = horizontal ? cursor : settings.padding + (cross - item.width) / 2;
    const y = horizontal ? settings.padding + (cross - item.height) / 2 : cursor;
    cursor += (horizontal ? item.width : item.height) + settings.gap;
    return { x, y };
  });
  return {
    width: (horizontal ? main : cross) + 2 * settings.padding,
    height: (horizontal ? cross : main) + 2 * settings.padding,
    positions,
  };
}

export function isSavedComponent(input: unknown): input is SavedComponent {
  if (!input || typeof input !== 'object') return false;
  const item = input as Partial<SavedComponent>;
  return typeof item.id === 'string' && /^[a-f\d-]{8,80}$/i.test(item.id) &&
    typeof item.name === 'string' && item.name.length <= 60 &&
    Boolean(item.data && typeof item.data === 'object') &&
    (item.data as { type?: string }).type === 'group';
}
