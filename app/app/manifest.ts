import type { MetadataRoute } from 'next';

// PWA manifest. Next.js serves this at /manifest.webmanifest with the correct
// Content-Type. Phase 1 PWA — installable on Android (Chrome) and iOS (Safari)
// home screens. Real native apps come later.

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Naadvidya — Online Indian Classical Music Academy',
    short_name: 'Naadvidya',
    description:
      'A curated, invitation-only academy for Indian Classical music at Visharad level and beyond. Guided by the Naadvidya Gurus.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#FAF3E0',
    theme_color: '#8B1A1A',
    lang: 'en-IN',
    categories: ['education', 'music', 'lifestyle'],
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
