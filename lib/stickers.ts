/** Original, self-hosted illustrations. Every sticker is inserted as an editable image. */
export const STICKERS = [
  { id: 'flower', label: 'Daisy', category: 'Nature' },
  { id: 'sun', label: 'Sunny day', category: 'Nature' },
  { id: 'cloud', label: 'Daydream', category: 'Nature' },
  { id: 'heart', label: 'Big love', category: 'Feelings' },
  { id: 'smile', label: 'Happy face', category: 'Feelings' },
  { id: 'spark', label: 'Bright idea', category: 'Feelings' },
  { id: 'arrow', label: 'Look here', category: 'Notes' },
  { id: 'tape', label: 'Washi tape', category: 'Notes' },
  { id: 'ink-friend', label: 'Ink friend', category: 'Characters' },
  { id: 'curious-moth', label: 'Curious moth', category: 'Characters' },
  { id: 'snail-mail', label: 'Snail mail', category: 'Characters' },
  { id: 'pencil-rocket', label: 'Pencil rocket', category: 'Objects' },
  { id: 'paper-plane', label: 'Paper plane', category: 'Objects' },
  { id: 'comet', label: 'Comet', category: 'Objects' },
  { id: 'flower-stack', label: 'Flower stack', category: 'Nature' },
  { id: 'planet-pop', label: 'Planet pop', category: 'Nature' },
  { id: 'paint-octopus', label: 'Paint octopus', category: 'Characters' },
  { id: 'brush-fox', label: 'Brush fox', category: 'Characters' },
  { id: 'idea-jellyfish', label: 'Idea jellyfish', category: 'Characters' },
  { id: 'doodle-bird', label: 'Doodle bird', category: 'Nature' },
] as const;

export type StickerId = (typeof STICKERS)[number]['id'];

export function stickerUrl(id: StickerId): string {
  return `/stickers/${id}.svg`;
}
