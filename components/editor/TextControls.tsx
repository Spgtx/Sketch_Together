'use client';

export type TextStyle = {
  fontFamily: string;
  fontSize: number;
  fontWeight: string | number;
  fontStyle: string;
  underline: boolean;
  textAlign: string;
  charSpacing: number;
  lineHeight: number;
  fill: string;
};

type Props = {
  value: TextStyle | null;
  onChange: (changes: Partial<TextStyle>) => void;
};

const FONTS = ['Arial', 'Georgia', 'Courier New', 'Trebuchet MS', 'Verdana'];
const ALIGNS = ['left', 'center', 'right', 'justify'];

export function TextControls({ value, onChange }: Props) {
  if (!value) {
    return <p className="panel-hint">Select a text object to customize it.</p>;
  }
  return (
    <section className="text-inspector" aria-label="Text formatting">
      <label>Font
        <select
          value={value.fontFamily}
          onChange={(event) => onChange({ fontFamily: event.target.value })}
        >
          {FONTS.map((font) => <option key={font} value={font}>{font}</option>)}
        </select>
      </label>
      <div className="text-inspector-grid">
        <label>Size
          <input type="number" min="6" max="300" value={value.fontSize}
            onChange={(event) => onChange({ fontSize: Number(event.target.value) })} />
        </label>
        <label>Color
          <input type="color" value={value.fill.startsWith('#') ? value.fill : '#292923'}
            onChange={(event) => onChange({ fill: event.target.value })} />
        </label>
        <label>Letter spacing
          <input type="number" min="-300" max="1000" step="10"
            value={value.charSpacing}
            onChange={(event) => onChange({ charSpacing: Number(event.target.value) })} />
        </label>
        <label>Line height
          <input type="number" min="0.7" max="4" step="0.1"
            value={value.lineHeight}
            onChange={(event) => onChange({ lineHeight: Number(event.target.value) })} />
        </label>
      </div>
      <div className="text-inspector-actions">
        <button className={value.fontWeight === 'bold' ? 'active' : ''}
          onClick={() => onChange({ fontWeight: value.fontWeight === 'bold'
            ? 'normal' : 'bold' })} title="Bold">B</button>
        <button className={value.fontStyle === 'italic' ? 'active' : ''}
          onClick={() => onChange({ fontStyle: value.fontStyle === 'italic'
            ? 'normal' : 'italic' })} title="Italic"><i>I</i></button>
        <button className={value.underline ? 'active' : ''}
          onClick={() => onChange({ underline: !value.underline })}
          title="Underline"><u>U</u></button>
      </div>
      <div className="text-inspector-actions">
        {ALIGNS.map((align) => (
          <button key={align} className={value.textAlign === align ? 'active' : ''}
            onClick={() => onChange({ textAlign: align })}>
            {align}
          </button>
        ))}
      </div>
      <p className="panel-hint">Double-click text to edit its content on the canvas.</p>
    </section>
  );
}
