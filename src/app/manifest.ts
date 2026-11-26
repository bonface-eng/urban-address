import { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'URBAN AUTO EXPRESS',
    short_name: 'Urban Auto Express',
    description: 'Premium Lounge, Shop & Detailing Service in Nakuru, Kenya.',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#FF6A00',
    icons: [
      {
        src: '/assets/pwa.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/assets/pwa.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/assets/pwa.png',
        sizes: 'any',
        type: 'image/png',
      },
    ],
  }
}
