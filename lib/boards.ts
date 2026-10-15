export type Template = 'blank' | 'brainstorm' | 'flow' | 'retro';

export type BoardMeta = {
  id: string;
  title: string;
  template: Template;
  updatedAt: number;
  mode?: 'cloud' | 'local';
};

const INDEX_KEY = 'sketchtogether:boards:v1';
export const BOARD_EVENT = 'sketchtogether:board-updated';

export function getBoards(): BoardMeta[] {
  if (typeof window === 'undefined') return [];

  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(INDEX_KEY) || '[]');
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter((entry): entry is BoardMeta => (
        !!entry
        && typeof entry.id === 'string'
        && typeof entry.title === 'string'
        && typeof entry.updatedAt === 'number'
      ))
      .sort((a, b) => b.updatedAt - a.updatedAt);
  } catch {
    return [];
  }
}

export function touchBoard(id: string, overrides: Partial<BoardMeta> = {}) {
  if (typeof window === 'undefined') return;

  const existing = getBoards();
  const previous = existing.find((board) => board.id === id);
  const board: BoardMeta = {
    id,
    title: 'Untitled board',
    template: 'blank',
    ...previous,
    ...overrides,
    updatedAt: Date.now(),
  };

  try {
    const kept = existing.filter((entry) => entry.id !== id);
    localStorage.setItem(INDEX_KEY, JSON.stringify([board, ...kept].slice(0, 40)));
    window.dispatchEvent(new Event(BOARD_EVENT));
  } catch {
    // Drawing remains available if browser storage is disabled.
  }
}

export function deleteLocalBoard(id: string) {
  localStorage.removeItem(`sketchtogether:canvas:${id}`);
  localStorage.removeItem(`sketchtogether:paper:${id}`);
  const kept = getBoards().filter((board) => board.id !== id);
  localStorage.setItem(INDEX_KEY, JSON.stringify(kept));
  window.dispatchEvent(new Event(BOARD_EVENT));
}

export function createBoardId() {
  return crypto.randomUUID().replaceAll('-', '').slice(0, 16);
}

/** Create an independent, browser-local copy of the last saved board state. */
export function duplicateLocalBoard(board: BoardMeta): string | null {
  if (typeof window === 'undefined') return null;

  try {
    const snapshot = localStorage.getItem(`sketchtogether:canvas:${board.id}`);
    if (!snapshot) return null;

    const newId = createBoardId();
    localStorage.setItem(`sketchtogether:canvas:${newId}`, snapshot);
    const paper = localStorage.getItem(`sketchtogether:paper:${board.id}`);
    if (paper) localStorage.setItem(`sketchtogether:paper:${newId}`, paper);
    touchBoard(newId, {
      title: `${board.title} (copy)`,
      template: board.template,
      mode: 'local',
    });
    return newId;
  } catch {
    return null;
  }
}
