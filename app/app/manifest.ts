import type { MetadataRoute } from 'next';

// PWA manifest. Next.js serves this at /manifest.webmanifest with the correct
// Content-Type. Phase 1 PWA — installable on Android (Chrome) and iOS (Safari)
// home screens. Real native apps come later.

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Naadvidya — Online Indian Classical Music Academy',
    short_name: 'Naadvidya',
    description:
      'A curated, invitation-only academy for Indian Classical music at Visharad level and beyond. Hosted by Mrs. Amee Buch, Sangeet Visharad.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#FAF3E0',
    theme_color: '#8B1A1A',
    lang: 'en-IN',
    categories: ['education', 'music', 'lifestyle'],
    icons: [
      {
        src: '/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'any',
      },
      {
        src: '/icon-maskable.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'maskable',
      },
    ],
  };
}
