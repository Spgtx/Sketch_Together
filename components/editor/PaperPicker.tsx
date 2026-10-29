export type PaperStyle = 'dots' | 'grid' | 'ruled' | 'plain' | 'chalk';

const PAPERS: { id: PaperStyle; name: string; description: string }[] = [
  { id: 'dots', name: 'Dot journal', description: 'A subtle guide' },
  { id: 'grid', name: 'Graph paper', description: 'Keep it aligned' },
  { id: 'ruled', name: 'Notebook', description: 'Room for notes' },
  { id: 'plain', name: 'Blank', description: 'Nothing in the way' },
  { id: 'chalk', name: 'Chalkboard', description: 'Something different' },
];

export function isPaperStyle(value: string | null): value is PaperStyle {
  return PAPERS.some((paper) => paper.id === value);
}

type Props = {
  value: PaperStyle;
  onChange: (paper: PaperStyle) => void;
};

export function PaperPicker({ value, onChange }: Props) {
  return (
    <div className="paper-picker">
      <p className="sticker-intro">
        Pick the paper that helps you think. Paper styles are a local display
        preference, not part of exported artwork.
      </p>
      {PAPERS.map((paper) => (
        <button
          key={paper.id}
          className={`paper-option ${value === paper.id ? 'is-active' : ''}`}
          onClick={() => onChange(paper.id)}
          aria-pressed={value === paper.id}
        >
          <span className={`paper-sample paper-${paper.id}`} aria-hidden="true" />
          <span className="paper-option-text">
            <strong>{paper.name}</strong>
            <small>{paper.description}</small>
          </span>
          <span className="paper-option-check" aria-hidden="true">
            {value === paper.id ? '✓' : ''}
          </span>
        </button>
      ))}
    </div>
  );
}
