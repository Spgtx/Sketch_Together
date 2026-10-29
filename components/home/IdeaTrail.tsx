import { StudioIcon } from '@/components/StudioIcon';

type Props = {
  onStart: () => void;
  disabled: boolean;
};

export function IdeaTrail({ onStart, disabled }: Props) {
  return (
    <section className="world-stories world-width" id="ideas" aria-labelledby="story-title">
      <div className="world-story-intro">
        {/*<span className="world-index">02 / NO RULES, JUST POSSIBILITIES</span>*/}
        <h2 id="story-title">Ideas grow <span>wild</span> here.</h2>
        <p>Neither should your imagination fit inside a box.</p>
      </div>
      <div className="world-story world-story-first">
        <div className="world-story-illustration world-story-illustration-sprout">
          <img src="/art/world/idea-sprout.svg" alt="A hand-drawn sprout growing from a scribble" />
          <svg viewBox="0 0 210 90" aria-hidden="true">
            <path d="M4 60Q64-2 115 40T206 32m-17-8 17 8-17 12"
              stroke="#D87E5E" fill="none" strokeWidth="5" strokeLinecap="round" />
          </svg>
        </div>
        <div className="world-story-copy">
          {/*<span className="world-index">A / MAKE AN IDEA</span>*/}
          <h3>Draw it before<br />it makes sense.</h3>
          <p>Real pens, notes, shapes, stamps, and all the space your brain needs.</p>
          <a className="world-text-link" href="#templates">
            Borrow a starting point <StudioIcon name="arrow-up-right" size={17} />
          </a>
        </div>
      </div>
      <div className="world-story world-story-second">
        <div className="world-story-copy">
          {/*<span className="world-index">B / INVITE ANOTHER BRAIN</span>*/}
          <h3>Two pencils.<br />More possibilities.</h3>
          <p>
            Share a board link, sketch together, and see your ideas change as you go.
            Live cursors and shared drawing work when your room has collaboration enabled.
          </p>
          <button className="world-text-link" type="button"
            onClick={onStart} disabled={disabled}>
            Make a shared space <StudioIcon name="arrow-up-right" size={17} />
          </button>
        </div>
        <div className="world-story-illustration world-story-illustration-buddies">
          <img src="/art/world/brush-buddies.svg" alt="Two little hand-drawn pencil friends" />
          <span>better together!</span>
        </div>
      </div>
    </section>
  );
}
