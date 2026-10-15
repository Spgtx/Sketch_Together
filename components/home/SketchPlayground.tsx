import { SketchPad } from '@/components/home/SketchPad';

export function SketchPlayground() {
  return (
    <section className="world-doodle world-width" id="make-a-mark" aria-labelledby="doodle-title">
      <div className="world-doodle-heading">
        <div>
          <span className="world-index">01 / FIRST, A LITTLE MESS</span>
          <h2 id="doodle-title">Leave your <em>mark.</em></h2>
          <p>Scribble, stamp something silly, change the ink. This bit really works.</p>
        </div>
        <img src="/art/world/idea-sprout.svg" alt="" className="world-doodle-sprout" />
      </div>
      <div className="world-pad-scene">
        <svg className="world-pad-outline" viewBox="0 0 1000 380"
          preserveAspectRatio="none" aria-hidden="true">
          <path
            d="M26 14Q269 7 475 20T968 17Q986 31 985 67L989 330Q970 369 930 360"
            fill="none" stroke="#B9B4A4" strokeWidth="2.5"
            strokeDasharray="4 11" strokeLinecap="round"
          />
          <path
            d="M923 361Q645 372 418 359T34 366Q9 356 14 322L8 63Q9 26 26 14"
            fill="none" stroke="#B9B4A4" strokeWidth="2.5"
            strokeDasharray="4 11" strokeLinecap="round"
          />
        </svg>
        <span className="world-pad-whisper" aria-hidden="true">your doodle goes here ↝</span>
        <div className="world-pad-decoration" aria-hidden="true">
          <img src="/art/world/spark-star.svg" alt="" />
        </div>
        <SketchPad />
      </div>
      <p className="world-pad-footnote">Just experimenting? Good. That&apos;s the whole idea.</p>
    </section>
  );
}
