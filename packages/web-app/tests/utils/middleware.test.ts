import { NextRequest } from 'next/server';
import { middleware } from '../../src/middleware';

jest.mock('../../src/lib/public-surface', () => ({
  ...jest.requireActual('../../src/lib/public-surface'),
  BUILT_BRIEFING_PUBLIC_HOST: 'drudge.microzj.com',
}));

const request = (path: string, headers: Record<string, string> = {}, method = 'GET') =>
  new NextRequest(`https://drudge.microzj.com${path}`, {
    method,
    headers: { host: 'drudge.microzj.com', ...headers },
  });

describe('shared domain middleware', () => {
  it.each(['/briefings/0123456789abcdef0123456789abcdef', '/briefings/health', '/_next/static/main.js'])('allows anonymous content at %s', path => {
    const response = middleware(request(path));
    expect(response.status).toBe(200);
    expect(response.headers.get('x-robots-tag')).toBe('noindex, nofollow');
  });

  it.each(['/', '/news', '/graph', '/summary', '/monitor', '/stats', '/tingzi', '/api/monitor', '/api/scan'])('allows the workbench without credentials at %s', path => {
    const response = middleware(request(path));
    expect(response.status).toBe(200);
    expect(response.headers.get('www-authenticate')).toBeNull();
    expect(response.headers.get('x-robots-tag')).toBe('noindex, nofollow');
  });

  it('still rejects cross-origin actions', () => {
    const response = middleware(request('/api/summary', {
      'sec-fetch-site': 'cross-site',
      origin: 'https://other.example.com',
    }));
    expect(response.status).toBe(403);
    expect(response.headers.get('cache-control')).toBe('no-store');
  });

  it('preserves same-origin workbench actions and internal scheduler access', () => {
    expect(middleware(request('/api/scan', {
      'sec-fetch-site': 'same-origin',
      origin: 'https://drudge.microzj.com',
    }, 'POST')).status).toBe(200);
    expect(middleware(request('/api/scheduler', { host: '127.0.0.1:39112' }, 'POST')).status).toBe(200);
  });

  it('does not require or interpret an ingress authentication marker', () => {
    for (const value of ['', 'owner', 'invalid']) {
      expect(middleware(request('/', { 'x-home-ingress-authenticated': value })).status).toBe(200);
    }
  });
});
