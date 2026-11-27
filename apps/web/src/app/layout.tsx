import type { Metadata, Viewport } from 'next';
import {
  ColorSchemeScript,
  MantineProvider,
  createTheme,
  mantineHtmlProps,
} from '@mantine/core';
import './globals.css';

const theme = createTheme({
  fontFamily: 'var(--font-sans), -apple-system, BlinkMacSystemFont, sans-serif',
  fontFamilyMonospace: 'var(--font-mono), monospace',
  primaryColor: 'spruce',
  colors: {
    spruce: [
      '#f0fdfa',
      '#ccfbf1',
      '#99f6e4',
      '#5eead4',
      '#2dd4bf',
      '#14b8a6',
      '#115e59',
      '#0d4743',
      '#093633',
      '#042220',
    ],
    // Saved alternate presets
    crimson: [
      '#fff1f3',
      '#fde0e4',
      '#fbc0c9',
      '#f794a3',
      '#f0657b',
      '#dc3553',
      '#a51c30',
      '#821625',
      '#68111e',
      '#4d0c16',
    ],
    // Saved alternate preset: switch primaryColor to 'vermilion' + add data-accent="vermilion" on <html>
    vermilion: [
      '#fef2f0',
      '#fde0db',
      '#fbc5bc',
      '#f7a394',
      '#f27c67',
      '#eb5f45',
      '#e14d2a',
      '#bf3b1c',
      '#9c2f16',
      '#782411',
    ],
  },
  defaultRadius: 'md',
});

const SITE_TITLE = 'Lyga — DM yourself the important stuff';
const SITE_DESCRIPTION =
  'Send full-size videos, photos, and any file between your phone and computer in one encrypted timeline.';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  interactiveWidget: 'resizes-content',
};

function resolveMetadataBase(): URL {
  const candidates = [
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : undefined,
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined,
    'http://localhost:3000',
  ];
  for (const raw of candidates) {
    if (!raw) continue;
    try {
      const normalized = raw.startsWith('http://') || raw.startsWith('https://') ? raw : `https://${raw}`;
      return new URL(normalized);
    } catch {
      // try next candidate
    }
  }
  return new URL('http://localhost:3000');
}

export const metadata: Metadata = {
  metadataBase: resolveMetadataBase(),
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  manifest: '/site.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Lyga',
  },
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/favicon.svg', type: 'image/svg+xml' },
    ],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180' }],
  },
  openGraph: {
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    type: 'website',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: SITE_TITLE }],
  },
  twitter: {
    card: 'summary_large_image',
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: ['/og-image.png'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" {...mantineHtmlProps}>
      <head>
        <ColorSchemeScript defaultColorScheme="light" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@400..800&family=JetBrains+Mono:wght@400;500&display=swap"
        />
      </head>
      <body>
        <MantineProvider theme={theme} defaultColorScheme="light">
          {children}
        </MantineProvider>
      </body>
    </html>
  );
}
