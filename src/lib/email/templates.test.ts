import { describe, expect, it } from 'vitest';
import { adminCommunicationEmail } from './templates';

describe('branded admin email HTML assets', () => {
  it('uses the selected public Cloudflare URL for the email logo and inline image', () => {
    const email = adminCommunicationEmail({
      email: 'recipient@example.com',
      kind: 'OFFICIAL_COMMUNICATION',
      subject: 'Official communication from Urban Auto Express',
      heading: 'Important business communication',
      message: 'Test message',
      logoUrl: 'https://cdn.example.com/system/brand-logo.png',
      imageUrl: 'https://cdn.example.com/system/notice-banner.webp',
    });

    expect(email.html).toContain('src="https://cdn.example.com/system/brand-logo.png"');
    expect(email.html).toContain('src="https://cdn.example.com/system/notice-banner.webp"');
  });

  it('ignores non-HTTPS image URLs', () => {
    const email = adminCommunicationEmail({
      email: 'recipient@example.com',
      kind: 'OFFICIAL_COMMUNICATION',
      subject: 'Notice',
      heading: 'Notice',
      message: 'Test message',
      logoUrl: 'http://unsafe.example/logo.png',
      imageUrl: 'javascript:alert(1)',
    });

    expect(email.html).not.toContain('http://unsafe.example/logo.png');
    expect(email.html).not.toContain('javascript:alert(1)');
  });
});
