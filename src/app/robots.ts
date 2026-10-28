import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/site';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/dashboard',
        '/archive',
        '/analytics',
        '/order-form',
        '/follow-ups',
        '/account-settings',
        '/feature-requests',
        '/refund-form',
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
