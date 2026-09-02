import type { Metadata } from 'next';
import { IBM_Plex_Mono, Instrument_Serif, Inter } from 'next/font/google';
import './globals.css';
import './editor-pages.css';

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
});

const instrumentSerif = Instrument_Serif({
  variable: '--font-instrument-serif',
  subsets: ['latin'],
  weight: '400',
});

const ibmPlexMono = IBM_Plex_Mono({
  variable: '--font-ibm-plex-mono',
  subsets: ['latin'],
  weight: ['400', '500', '600'],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.SITE_URL ?? 'http://localhost:3000'),
  title: 'Build a beautiful website for free — SleekSite',
  description:
    'Describe a website and turn the idea into a working first draft.',
  openGraph: {
    title: 'Build a beautiful website for free',
    description: 'Turn a plain-language idea into a complete website with AI.',
    siteName: 'SleekSite',
    type: 'website',
    images: [
      {
        url: '/og.png',
        width: 1200,
        height: 630,
        alt: 'SleekSite AI website builder',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Build a beautiful website for free',
    description: 'Turn a plain-language idea into a complete website with AI.',
    images: ['/og.png'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${inter.variable} ${instrumentSerif.variable} ${ibmPlexMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
