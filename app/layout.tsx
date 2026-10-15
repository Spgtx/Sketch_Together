import type { Metadata } from 'next';
import './globals.css';
import './sketchpage.css';
import './sketch-scenes.css';
import './sketch-responsive.css';
import './editor-additions.css';
import './room-studio.css';

export const metadata: Metadata = {
  title: 'SketchTogether — Make a little noise with your ideas',
  description: 'A shared sketchbook for half-formed ideas, happy accidents, '
    + 'and the people who make them. Draw, think, and create together.',
  icons: { icon: '/art/favicon.svg' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
