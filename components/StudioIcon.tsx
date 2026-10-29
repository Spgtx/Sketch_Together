import type { SVGProps, ReactNode } from 'react';

export type IconName =
  | 'arrow-right'
  | 'arrow-up-right'
  | 'pen'
  | 'eraser'
  | 'cursor'
  | 'hand'
  | 'rectangle'
  | 'ellipse'
  | 'line'
  | 'arrow'
  | 'connector'
  | 'text'
  | 'note'
  | 'image'
  | 'undo'
  | 'redo'
  | 'plus'
  | 'minus'
  | 'fit'
  | 'trash'
  | 'share'
  | 'download'
  | 'layers'
  | 'menu'
  | 'close'
  | 'grid'
  | 'check'
  | 'keyboard'
  | 'home'
  | 'upload'
  | 'users'
  | 'chevron'
  | 'dots'
  | 'edit'
  | 'link'
  | 'lock'
  | 'spark'
  | 'save'
  | 'copy'
  | 'search'
  | 'clock'
  | 'palette'
  | 'paint-bucket'
  | 'brush'
  | 'paint-pixels'
  | 'erase-pixels'
  | 'vector-pen'
  | 'node-edit'
  | 'bezier'
  | 'sticker-sheet'
  | 'paper-page'
  | 'vector-ops'
  | 'device-frame'
  | 'pieces';

type Props = SVGProps<SVGSVGElement> & {
  name: IconName;
  size?: number;
};

/** Custom, self-hosted SVG icon family. Add new glyphs here. */
const ICON_PATHS: Record<IconName, ReactNode> = {
  'paper-page': (
    <>
      <path d="M5 3h14v18H5Z" />
      <path d="M8 7h8M8 11h8M8 15h4" strokeDasharray="2 2" />
      <path d="M12 3v18" opacity=".35" />
    </>
  ),
  'vector-ops': (
    <>
      <path d="M3 18 9 5l6 12 6-10" />
      <rect x="1.5" y="16.5" width="3" height="3" fill="#fff" />
      <circle cx="9" cy="5" r="2" fill="#efcb78" />
      <rect x="13.5" y="15.5" width="3" height="3" fill="#fff" />
      <circle cx="21" cy="7" r="2" fill="#fff" />
    </>
  ),
  'device-frame': (
    <>
      <rect x="2" y="5" width="14" height="11" rx="1" />
      <path d="M5 19h10M8 16v3M19 4h3v17h-6V4h3Z" />
      <circle cx="19" cy="18" r=".7" fill="currentColor" />
    </>
  ),
  'pieces': (
    <>
      <path d="M4 4h7v4c1.5-1.5 4-1 4 1s-2.5 2.5-4 1v4H4V4Z" />
      <path d="M11 14v-4c1.5 1.5 4 1 4-1s-2.5-2.5-4-1V4h9v16h-9v-2" />
      <path d="M4 14h7v4c1.5-1.5 4-1 4 1s-2.5 2.5-4 1H4v-6Z" />
    </>
  ),
  'arrow-right': (
    <path d="M4 12h15M13 6l6 6-6 6" />
  ),
  'arrow-up-right': (
    <path d="M5 19 19 5M9 5h10v10" />
  ),
  'paint-bucket': (
    <>
      <path d="m4 12 9-9 9 9-9 9-9-9Z" />
      <path d="m9 7 8 8M3 20c0-2 2-4 4-4M19 19c1-2 2-3 3-3" />
      <path d="M4 17h16" />
    </>
  ),
  'brush': (
    <>
      <path d="m7 16 8-12 4 2-7 12-5-2Z" />
      <path d="M7 16c-3-.5-4 2-4 4 0 2 2 2 4 1 2-.9 3-2.8 0-5Z" />
      <path d="m13 7 4 2" />
    </>
  ),
  'paint-pixels': (
    <>
      <path d="M3 3h5v5H3zM9 3h5v5H9zM3 9h5v5H3z" fill="currentColor" />
      <path
        d="m15 15 5-8 2 2-5 8-4 4-1-3 3-3Z"
      />
      <path d="M5 20h5M9 15h3" />
    </>
  ),
  'erase-pixels': (
    <>
      <path d="M5 14 13 4l8 6-8 10H9L5 17a2 2 0 0 1 0-3Z" />
      <path d="M9 9 17 16M3 20h5" />
      <path d="M2 3h3v3H2zM7 3h2M2 8v2" strokeWidth="1.9" />
    </>
  ),
  'vector-pen': (
    <>
      <path d="M4 19 9 11l4 4 7-10" />
      <rect x="2" y="17" width="4" height="4" />
      <rect x="18" y="3" width="4" height="4" />
      <circle cx="9" cy="11" r="1.5" fill="currentColor" />
      <path d="m12 16 3 3" strokeDasharray="1.5 2" />
    </>
  ),
  'node-edit': (
    <>
      <path d="M4 19C11 2 15 22 21 5M4 19l9-9 8-5" />
      <rect x="2" y="17" width="4" height="4" fill="#fff" />
      <circle cx="13" cy="10" r="2.5" fill="#f7d176" />
      <rect x="19" y="3" width="4" height="4" fill="#fff" />
    </>
  ),
  'bezier': (
    <>
      <path d="M3 18Q12-5 21 18" strokeWidth="1.8" />
      <path d="M3 18 12 4l9 14" opacity=".4" strokeDasharray="2 2" />
      <rect x="1.5" y="16.5" width="3.5" height="3.5" fill="#fff" />
      <rect x="19" y="16.5" width="3.5" height="3.5" fill="#fff" />
      <circle cx="12" cy="4" r="2.5" fill="#f5d779" />
    </>
  ),
  'sticker-sheet': (
    <>
      <path d="M4 2h16v14l-5 6H4V2Z" />
      <path
        d="M15 22v-6h5M12 5l1.3 3.1 3.7.4-2.8 2.3.9 3.4-3.1-1.8-3 1.8.8-3.4L7 8.5l3.7-.4L12 5Z"
      />
    </>
  ),
  'pen': (
    <>
      <path d="m5 18 2-6L16.5 2.5a2.1 2.1 0 0 1 3 3L10 15l-5 3Z" />
      <path d="m7 12 5 5M4 21h15" />
    </>
  ),
  'eraser': (
    <>
      <path d="m4 15 9-11 8 6-9 11H8L4 17a2 2 0 0 1 0-2Z" />
      <path d="M9 10 17 17M13 21h9" />
      <path d="m3 7 2-1M18 3l1 2" />
    </>
  ),
  'cursor': (
    <path d="m5 3 14 9-7.5 1.1-3 7.2L5 3Z" />
  ),
  'hand': (
    <path
      d={[
        'M8 13V5a1.5 1.5 0 0 1 3 0v6-8a1.5 1.5 0 0 1 3 0v8-6a1.5 1.5 0 0 1 3',
        '0v7-4a1.5 1.5 0 0 1 3 0v7c0 4-2.2 6-6 6h-2.5c-2 0-3.4-.8-4.8-2.7L3.8',
        '15a1.5 1.5 0 0 1 2.3-1.9L8 15',
      ].join(' ')}
      />
  ),
  'rectangle': (
    <rect x="4" y="5" width="16" height="14" rx="1" />
  ),
  'ellipse': (
    <ellipse cx="12" cy="12" rx="9" ry="7" />
  ),
  'line': (
    <>
      <path d="M4 19 20 5" />
      <circle cx="4" cy="19" r="1.3" />
      <circle cx="20" cy="5" r="1.3" />
    </>
  ),
  'connector': (
    <>
      <rect x="2" y="3" width="7" height="6" rx="1" />
      <rect x="15" y="15" width="7" height="6" rx="1" />
      <path d="M9 6h5q4 0 4 4v5m-3-3 3 3 3-3" />
    </>
  ),
  'arrow': (
    <path d="m4 19 15-14m-8 0h8v8" />
  ),
  'text': (
    <path d="M4 6h16M12 6v13M8 19h8M4 6v3m16-3v3" />
  ),
  'note': (
    <>
      <path d="M4 3h16v12l-6 6H4z" />
      <path d="M14 21v-6h6M7.5 8h9M7.5 12h6" />
    </>
  ),
  'image': (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <circle cx="8" cy="9" r="1.5" />
      <path d="m4 17 5-5 3.5 3 3-4L21 17" />
    </>
  ),
  'undo': (
    <path d="M9 6 4 11l5 5M4 11h10a6 6 0 0 1 0 12" />
  ),
  'redo': (
    <path d="m15 6 5 5-5 5m5-5H10a6 6 0 0 0 0 12" />
  ),
  'plus': (
    <path d="M12 4v16M4 12h16" />
  ),
  'minus': (
    <path d="M4 12h16" />
  ),
  'fit': (
    <path d="M9 4H4v5m11-5h5v5M4 15v5h5m11-5v5h-5" />
  ),
  'trash': (
    <path d="M4 7h16M8 7V4h8v3m2 0-1 14H7L6 7M10 11v6m4-6v6" />
  ),
  'share': (
    <path d="M12 15V3m-5 5 5-5 5 5M5 13v7h14v-7" />
  ),
  'download': (
    <path d="M12 3v12m-5-5 5 5 5-5M5 16v5h14v-5" />
  ),
  'layers': (
    <path d="m12 3 9 5-9 5-9-5 9-5Zm-9 10 9 5 9-5m-18 5 9 5 9-5" />
  ),
  'menu': (
    <path d="M4 7h16M4 12h16M4 17h16" />
  ),
  'close': (
    <path d="M5 5 19 19M19 5 5 19" />
  ),
  'grid': (
    <>
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" />
    </>
  ),
  'check': (
    <path d="m4 12 5 5L20 6" />
  ),
  'keyboard': (
    <>
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <path d="M6 9h1m3 0h1m3 0h1m3 0h1M6 13h1m3 0h1m3 0h1m3 0h1M8 16h8" />
    </>
  ),
  'home': (
    <>
      <path d="m3 11 9-8 9 8v10H3V11Z" />
      <path d="M9 21v-7h6v7" />
    </>
  ),
  'upload': (
    <path d="M12 17V3m-5 5 5-5 5 5M4 17v4h16v-4" />
  ),
  'users': (
    <>
      <circle cx="9" cy="8" r="3" />
      <path d="M3 20v-2c0-3 2.5-5 6-5s6 2 6 5v2H3ZM16 5a3 3 0 0 1 0 6m2 3c2 1 3 2.5 3 5v1h-3" />
    </>
  ),
  'chevron': (
    <path d="m6 9 6 6 6-6" />
  ),
  'dots': (
    <>
      <circle cx="5" cy="12" r="1" />
      <circle cx="12" cy="12" r="1" />
      <circle cx="19" cy="12" r="1" />
    </>
  ),
  'edit': (
    <>
      <path d="m4 16-1 5 5-1L20 8a2.1 2.1 0 0 0-4-4L4 16Z" />
      <path d="m13 7 4 4" />
    </>
  ),
  'link': (
    <path d="M10 7h-3a5 5 0 0 0 0 10h3m4-10h3a5 5 0 0 1 0 10h-3M8 12h8" />
  ),
  'lock': (
    <>
      <rect x="4" y="10" width="16" height="12" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </>
  ),
  'spark': (
    <path d="M12 2 14 9l7 3-7 2-2 8-2-8-7-2 7-3 2-7Z" />
  ),
  'save': (
    <path d="M4 3h14l3 3v15H3V3h1Zm3 0v7h10V3M7 21v-8h10v8" />
  ),
  'copy': (
    <>
      <rect x="8" y="8" width="12" height="12" rx="2"/>
      <path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/>
    </>
  ),
  'search': (
    <>
      <circle cx="10.5" cy="10.5" r="6.5"/>
      <path d="m16 16 5 5"/>
    </>
  ),
  'clock': (
    <>
      <circle cx="12" cy="12" r="9"/>
      <path d="M12 7v5l3.5 2"/>
    </>
  ),
  'palette': (
    <>
      <path
        d={[
          'M12 3C6.5 3 3 6.7 3 12.2 3 17.8 7 21 12.1 21c1.7 0 2.2-1 2.2-2.1',
          '0-.9-.5-1.5-.5-2.5 0-1.1.9-1.6 1.8-1.6H18c2.2 0 3-1.6 3-3.6C21 6.8',
          '17.3 3 12 3Z',
        ].join(' ')}
        />
      <circle cx="7.5" cy="11" r="1"/>
      <circle cx="10.2" cy="7.3" r="1"/>
      <circle cx="15.3" cy="7.6" r="1"/>
    </>
  ),
};

export function StudioIcon({ name, size = 20, ...props }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.65"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {ICON_PATHS[name]}
    </svg>
  );
}
