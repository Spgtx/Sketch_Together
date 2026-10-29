import type { Metadata } from 'next';

/** Room URLs are private workspaces and must not be indexed. */
export const metadata: Metadata = {
  title: 'Private drawing room',
  robots: { index: false, follow: false, nocache: true },
};

export default function RoomLayout({ children }: { children: React.ReactNode }) {
  return children;
}
