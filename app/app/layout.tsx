import type { Metadata, Viewport } from 'next';
import { Cormorant_Garamond, Plus_Jakarta_Sans } from 'next/font/google';
import { PWARegister } from '@/components/pwa/PWARegister';
import './globals.css';

const cormorant = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  style: ['normal', 'italic'],
  variable: '--font-cormorant',
  display: 'swap',
});

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-jakarta',
  display: 'swap',
});

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#8B1A1A' },
    { media: '(prefers-color-scheme: dark)', color: '#2D0808' },
  ],
  width: 'device-width',
  initialScale: 1,
  // Allow user pinch-zoom — better accessibility (don't lock at maximumScale=1)
};

export const metadata: Metadata = {
  applicationName: 'Naadvidya',
  title: 'Naadvidya — Learn Indian Classical Music from India\'s Finest Gurus',
  description:
    'Naadvidya is a curated online academy for Indian Classical music at Visharad level and beyond. Hosted by Mrs. Amee Buch, Sangeet Visharad.',
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'),
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [{ url: '/icon.svg', type: 'image/svg+xml' }],
    apple: [{ url: '/apple-icon.svg' }],
  },
  appleWebApp: {
    capable: true,
    title: 'Naadvidya',
    statusBarStyle: 'default',
  },
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    title: 'Naadvidya — नादविद्या',
    description: 'India\'s premier online Indian Classical music academy.',
    type: 'website',
    locale: 'en_IN',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${cormorant.variable} ${jakarta.variable}`}>
      <body>
        {children}
        <PWARegister />
      </body>
    </html>
  );
}
