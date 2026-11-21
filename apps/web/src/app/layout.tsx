import type { Metadata } from 'next';
import { Plus_Jakarta_Sans, JetBrains_Mono } from 'next/font/google';
import { ColorSchemeScript, MantineProvider, createTheme } from '@mantine/core';
import './globals.css';

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
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
  primaryColor: 'cobalt',
  colors: {
    cobalt: [
      '#eff6ff',
      '#dbeafe',
      '#bfdbfe',
      '#93c5fd',
      '#60a5fa',
      '#3b82f6',
      '#1d4ed8',
      '#1e40af',
      '#1e3a8a',
      '#172554',
    ],
  },
  defaultRadius: 'md',
});

export const metadata: Metadata = {
  title: 'Lyga — DM yourself the important stuff',
  description:
    'Send full-size videos, photos, and any file between your phone and computer in one encrypted feed.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${plusJakarta.variable} ${jetbrainsMono.variable}`}>
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
