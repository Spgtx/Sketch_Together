import { StudioIcon } from '@/components/StudioIcon';

type Props = {
  onStart: () => void;
  disabled: boolean;
};

export function HeroScene({ onStart, disabled }: Props) {
  return (
    <section className="world-hero world-width" aria-labelledby="hero-title">
      <div className="world-hero-copy">
        <p className="world-eyebrow">
          {/*<span className="world-eyebrow-dot" />
          AN OPEN INVITATION TO MAKE STUFF*/}
        </p>
        <h1 id="hero-title">
          The world<br />
          needs more<br />
          <em>scribbles.</em>
        </h1>
        <p className="world-hero-description">
          A shared sketchbook for half-formed ideas, happy accidents,
          and the people who make them.
        </p>
        <div className="world-hero-actions">
          <button
            className="world-ink-button"
            type="button"
            onClick={onStart}
            disabled={disabled}
          >
            Start drawing <StudioIcon name="arrow-up-right" size={19} />
          </button>
          <a className="world-hero-secondary" href="#make-a-mark">
            Or scribble right here <span aria-hidden="true">↘</span>
          </a>
        </div>
        <span className="world-hero-microcopy">
          No account needed to start a local board.
        </span>
      </div>
      <div className="world-hero-art" aria-hidden="true">
        <svg className="world-hero-orbit" viewBox="0 0 590 580">
          <path d="M49 295 C-8 84 181 12 309 61S624 224 498 410"
            fill="none" stroke="#EAC9B4" strokeWidth="3" strokeDasharray="3 13" />
          <path d="M87 112 Q150 48 230 84" fill="none" stroke="#E7A687"
            strokeWidth="12" strokeLinecap="round" opacity=".45" />
          <path d="M482 437 Q537 424 554 467" fill="none" stroke="#2F8E74"
            strokeWidth="5" strokeLinecap="round" />
        </svg>
        <img className="world-hero-character" src="/art/world/hero-companion.svg" alt="" />
        <img className="world-hero-star" src="/art/world/spark-star.svg" alt="" />
        <img className="world-hero-comet" src="/stickers/comet.svg" alt="" />
        <div className="world-hero-handwritten">meet your new<br />idea buddy ↗</div>
        <svg className="world-hero-swoosh" viewBox="0 0 230 77" aria-hidden="true">
          <path d="M6 9 Q104 3 138 37 T221 45m-16-11 16 11-17 8"
            fill="none" stroke="#242722" strokeWidth="2.5"
            strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <a href="#make-a-mark" className="world-scroll-cue">
        <span>KEEP GOING, IT GETS MESSIER</span>
        <svg viewBox="0 0 40 43" aria-hidden="true">
          <path d="M21 3Q2 23 22 35m-11-8 11 9 9-11" fill="none"
            stroke="currentColor" strokeWidth="2.7" strokeLinecap="round" />
        </svg>
      </a>
    </section>
  );
}
