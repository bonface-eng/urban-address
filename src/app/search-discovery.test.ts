import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import robots from './robots';
import sitemap from './sitemap';

describe('public search discovery', () => {
  it('advertises the sitemap on the actual www production host', () => {
    const policy = robots();
    expect(policy.sitemap).toBe('https://www.urbanautoexpress.com/sitemap.xml');
    expect(policy.rules).toEqual([{ userAgent: '*', allow: '/', disallow: ['/api/'] }]);
  });

  it('lists existing public pages, not staff or account pages', () => {
    const entries = sitemap();
    expect(entries.map(entry => new URL(entry.url).pathname)).toEqual([
      '/', '/about', '/contact', '/client/lounge', '/client/store', '/client/carwash', '/download',
    ]);
    for (const entry of entries) {
      const url = new URL(entry.url);
      expect(url.origin).toBe('https://www.urbanautoexpress.com');
      const route = ['/client/lounge', '/client/store'].includes(url.pathname)
        ? '/client/[branch]' : url.pathname;
      expect(existsSync(join(process.cwd(), 'src/app', route, 'page.tsx'))).toBe(true);
      expect(entry.lastModified).toBeUndefined();
    }
    expect(new Set(entries.map(entry => entry.url)).size).toBe(entries.length);
  });
});
