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

import { indexable, siteOrigin } from '@/lib/seo-config';

const description =
  'Draw, paint, edit vector paths, prototype screens, and collaborate on a shared canvas. '
  + 'SKTO Studio is a playful online sketchbook and creative design workspace.';

export const metadata: Metadata = {
  metadataBase: siteOrigin ? new URL(siteOrigin) : undefined,
  title: {
    default: 'SKTO Studio — Draw, Design & Create Together',
    template: '%s | SKTO Studio',
  },
  description,
  applicationName: 'SKTO Studio',
  keywords: [
    'collaborative drawing',
    'online sketchbook',
    'vector editor',
    'whiteboard',
    'digital painting',
    'design prototyping',
    'realtime collaboration',
  ],
  alternates: indexable ? { canonical: '/' } : undefined,
  robots: {
    index: indexable,
    follow: indexable,
    googleBot: {
      index: indexable,
      follow: indexable,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  openGraph: {
    title: 'SKTO Studio — Make Something Together',
    description,
    siteName: 'SKTO Studio',
    type: 'website',
    locale: 'en_US',
    url: indexable && siteOrigin ? siteOrigin : undefined,
    images: siteOrigin ? [
      {
        url: '/skto-social.png',
        width: 1200,
        height: 630,
        alt: 'SKTO Studio — a creative place to draw and design together',
      },
    ] : undefined,
  },
  twitter: {
    card: 'summary_large_image',
    title: 'SKTO Studio — Draw, Design & Create Together',
    description,
    images: siteOrigin ? ['/skto-social.png'] : undefined,
  },
  icons: { icon: '/art/skto-favicon.svg' },
  verification: {
    google: process.env.GOOGLE_SITE_VERIFICATION || undefined,
    yandex: process.env.YANDEX_SITE_VERIFICATION || undefined,
    other: process.env.BING_SITE_VERIFICATION
      ? { 'msvalidate.01': process.env.BING_SITE_VERIFICATION }
      : undefined,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
