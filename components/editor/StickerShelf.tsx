'use client';

import { useMemo, useState } from 'react';
import { STICKERS, stickerUrl, type StickerId } from '@/lib/stickers';
import { StudioIcon } from '@/components/StudioIcon';

type Props = {
  disabled?: boolean;
  onSelect: (id: StickerId) => void;
};

const CATEGORIES = ['All', 'Nature', 'Feelings', 'Characters', 'Objects', 'Notes'];

export function StickerShelf({ disabled, onSelect }: Props) {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [failed, setFailed] = useState<string[]>([]);
  const filtered = useMemo(() => STICKERS.filter((sticker) => (
    (category === 'All' || sticker.category === category) &&
    sticker.label.toLowerCase().includes(search.toLowerCase().trim())
  )), [search, category]);

  return (
    <div className="sticker-shelf">
      <p className="sticker-intro">
        Peel an illustrated character, little object, or note onto your canvas.
      </p>
      <label className="sticker-search">
        <StudioIcon name="search" size={16} />
        <span className="sr-only">Search illustrations</span>
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Find a little something…"
        />
      </label>
      <div className="sticker-categories" role="group" aria-label="Sticker themes">
        {CATEGORIES.map((name) => (
          <button
            key={name}
            type="button"
            aria-pressed={category === name}
            className={category === name ? 'active' : ''}
            onClick={() => setCategory(name)}
          >
            {name}
          </button>
        ))}
      </div>
      <div className="sticker-shelf-grid">
        {filtered.map((sticker) => (
          <button
            className="sticker-option"
            key={sticker.id}
            title={`Place ${sticker.label}`}
            aria-label={`Place ${sticker.label} sticker`}
            onClick={() => onSelect(sticker.id)}
            disabled={disabled || failed.includes(sticker.id)}
          >
            {failed.includes(sticker.id) ? (
              <StudioIcon name="sticker-sheet" size={35} />
            ) : (
              <img
                src={stickerUrl(sticker.id)}
                alt=""
                draggable={false}
                loading="lazy"
                onError={() => setFailed((previous) => [...previous, sticker.id])}
              />
            )}
            <span>{sticker.label}</span>
          </button>
        ))}
      </div>
      {filtered.length === 0 && <p className="panel-hint">No stickers match that search.</p>}
      <p className="sticker-tip">
        Every placed sticker is stored with your board and included in exports.
      </p>
    </div>
  );
}
