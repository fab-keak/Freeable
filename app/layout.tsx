import type { Metadata } from 'next';
import { IBM_Plex_Mono, Instrument_Serif, Inter } from 'next/font/google';
import Script from 'next/script';
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
  title: 'Build a beautiful website for free — Freeable',
  description:
    'Describe a website and turn the idea into a working first draft.',
  openGraph: {
    title: 'Build a beautiful website for free',
    description: 'Turn a plain-language idea into a complete website with AI.',
    siteName: 'Freeable',
    type: 'website',
    images: [
      {
        url: '/og.png',
        width: 1200,
        height: 630,
        alt: 'Freeable AI website builder',
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
        <Script id="x-conversion-tracking" strategy="afterInteractive">
          {`!function(e,t,n,s,u,a){e.twq||(s=e.twq=function(){s.exe?s.exe.apply(s,arguments):s.queue.push(arguments)},s.version='1.1',s.queue=[],u=t.createElement(n),u.async=!0,u.src='https://static.ads-twitter.com/uwt.js',a=t.getElementsByTagName(n)[0],a.parentNode.insertBefore(u,a))}(window,document,'script');twq('config','ofrz1');`}
        </Script>
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-YHK2XLBT8W"
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','G-YHK2XLBT8W');`}
        </Script>
      </body>
    </html>
  );
}
