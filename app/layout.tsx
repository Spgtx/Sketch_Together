import type { Metadata } from 'next';
import './styles/base/site-foundations-01.css';
import './styles/base/site-foundations-02.css';
import './styles/base/site-foundations-03.css';
import './styles/base/site-foundations-04.css';
import './styles/home/sketch-page-01.css';
import './styles/home/sketch-page-02.css';
import './styles/home/sketch-page-03.css';
import './styles/home/illustrated-scenes-01.css';
import './styles/home/illustrated-scenes-02.css';
import './styles/home/illustrated-scenes-03.css';
import './sketch-responsive.css';
import './editor-additions.css';
import './styles/room/studio-01.css';
import './styles/room/studio-02.css';
import './styles/room/studio-03.css';
import './styles/room/studio-04.css';
import './styles/room/studio-05.css';
import './styles/room/studio-06.css';
import './styles/room/studio-07.css';
import './studio-navigation.css';

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
