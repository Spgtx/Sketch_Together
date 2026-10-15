import { StudioIcon } from '@/components/StudioIcon';

type Props = {
  onStart: () => void;
  disabled: boolean;
};

export function ClosingScene({ onStart, disabled }: Props) {
  return (
    <section className="world-finale world-width" aria-labelledby="finale-title">
      <img className="world-finale-loop" src="/art/world/closing-squiggle.svg" alt="" />
      <img className="world-finale-star" src="/art/world/spark-star.svg" alt="" />
      <img className="world-finale-moth" src="/stickers/curious-moth.svg" alt="" />
      <div className="world-finale-copy">
        <span className="world-index">P.S. FROM YOUR NEW FAVORITE SKETCHBOOK</span>
        <h2 id="finale-title">It doesn&apos;t have<br />to be <em>perfect.</em></h2>
        <p>It just has to begin.</p>
        <button type="button" className="world-text-link world-finale-link"
          onClick={onStart} disabled={disabled}>
          Pick up a pencil <StudioIcon name="arrow-up-right" size={21} />
        </button>
      </div>
    </section>
  );
}
