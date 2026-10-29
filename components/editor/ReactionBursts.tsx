'use client';

export type ReactionBurst = {
  id: string;
  emoji: string;
};

export function ReactionBursts({ bursts }: { bursts: ReactionBurst[] }) {
  return (
    <div className="room-reactions" aria-live="off" aria-hidden="true">
      {bursts.map((burst) => (
        <span className="room-reaction" key={burst.id}>
          {burst.emoji}
        </span>
      ))}
    </div>
  );
}
