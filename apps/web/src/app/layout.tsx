import type { Metadata } from 'next';
import { Bricolage_Grotesque, JetBrains_Mono } from 'next/font/google';
import {
  ColorSchemeScript,
  MantineProvider,
  createTheme,
  mantineHtmlProps,
} from '@mantine/core';
import './globals.css';

const bricolage = Bricolage_Grotesque({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-sans',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-mono',
});

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

export const metadata: Metadata = {
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  manifest: '/site.webmanifest',
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
    <html
      lang="en"
      className={`${bricolage.variable} ${jetbrainsMono.variable}`}
      {...mantineHtmlProps}
    >
      <head>
        <ColorSchemeScript defaultColorScheme="light" />
      </head>
      <body>
        <MantineProvider theme={theme} defaultColorScheme="light">
          {children}
        </MantineProvider>
      </body>
    </html>
  );
}
