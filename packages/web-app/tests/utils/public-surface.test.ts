import {
  hostnameFromHostHeader,
  isBriefingPublicHost,
  isBriefingPublicPath,
} from '../../src/lib/public-surface';

describe('briefing public surface', () => {
  it.each([
    '/briefings',
    '/briefings/0123456789abcdef0123456789abcdef',
    '/briefings/0123456789abcdef0123456789abcdef/image.svg',
    '/_next/static/chunk.js',
    '/favicon.ico',
  ])('allows %s', pathname => {
    expect(isBriefingPublicPath(pathname)).toBe(true);
  });

  it.each(['/', '/api/scan', '/api/summary', '/news', '/briefing/one'])('blocks %s', pathname => {
    expect(isBriefingPublicPath(pathname)).toBe(false);
  });

  it('only activates for the exact configured public host', () => {
    expect(isBriefingPublicHost('news.microzj.com', 'news.microzj.com')).toBe(true);
    expect(isBriefingPublicHost('NEWS.MICROZJ.COM', 'news.microzj.com')).toBe(true);
    expect(isBriefingPublicHost('other.microzj.com', 'news.microzj.com')).toBe(false);
    expect(isBriefingPublicHost('news.microzj.com', '')).toBe(false);
  });

  it('extracts a normalized hostname from an HTTP Host header', () => {
    expect(hostnameFromHostHeader('NEWS.MICROZJ.COM:39112')).toBe('news.microzj.com');
    expect(hostnameFromHostHeader('[::1]:39112')).toBe('[::1]');
    expect(hostnameFromHostHeader('one.example.com,two.example.com')).toBe('');
    expect(hostnameFromHostHeader(null)).toBe('');
  });
});
