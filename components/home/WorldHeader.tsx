import { StudioIcon } from '@/components/StudioIcon';

type Props = {
  onStart: () => void;
  disabled: boolean;
};

export function WorldHeader({ onStart, disabled }: Props) {
  return (
    <header className="world-header world-width">
      <a href="#top" className="world-logo" aria-label="SketchTogether, back to top">
        <svg viewBox="0 0 58 44" className="world-logo-mark" aria-hidden="true">
          <path
            d="M5 26C8 9 19 9 22 23s9 11 12-3S49 9 53 26"
            fill="none" stroke="currentColor" strokeWidth="6" strokeLinecap="round"
          />
          <path d="m44 34 5 4" stroke="#E76D52" strokeWidth="6" strokeLinecap="round" />
        </svg>
        <span>sketch<span className="world-logo-accent">together</span><i>✳</i></span>
      </a>
      <nav className="world-nav" aria-label="Explore the sketchpage">
        <a href="#make-a-mark">Try a scribble</a>
        <a href="#ideas">Explore</a>
        <a href="#your-pages">Your pages</a>
      </nav>
      <button className="world-nav-button" type="button" onClick={onStart} disabled={disabled}>
        Open studio <StudioIcon name="arrow-up-right" size={17} />
      </button>
    </header>
  );
}
