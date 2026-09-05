import {
  hostnameFromHostHeader,
  isBriefingPublicHost,
  isCrossOriginApiAction,
} from '../../src/lib/public-surface';

describe('briefing public surface', () => {
  it('only activates for the exact configured public host', () => {
    expect(isBriefingPublicHost('drudge.microzj.com', 'drudge.microzj.com')).toBe(true);
    expect(isBriefingPublicHost('DRUDGE.MICROZJ.COM', 'drudge.microzj.com')).toBe(true);
    expect(isBriefingPublicHost('other.microzj.com', 'drudge.microzj.com')).toBe(false);
    expect(isBriefingPublicHost('drudge.microzj.com', '')).toBe(false);
  });

  it('extracts a normalized hostname from an HTTP Host header', () => {
    expect(hostnameFromHostHeader('DRUDGE.MICROZJ.COM:39112')).toBe('drudge.microzj.com');
    expect(hostnameFromHostHeader('[::1]:39112')).toBe('[::1]');
    expect(hostnameFromHostHeader('one.example.com,two.example.com')).toBe('');
    expect(hostnameFromHostHeader(null)).toBe('');
  });

});

describe('workbench browser actions', () => {
  it.each([
    ['/api/summary', 'GET', 'cross-site'],
    ['/api/summary', 'GET', 'same-site'],
    ['/api/scan', 'POST', 'cross-site'],
    ['/api/scheduler', 'POST', 'same-site'],
    ['/api/tingzi', 'POST', 'cross-site'],
  ])('rejects %s %s from %s', (pathname, method, site) => {
    expect(isCrossOriginApiAction(pathname, method, new Headers({ 'sec-fetch-site': site }))).toBe(true);
  });

  it.each(['same-origin', 'none'])('allows a %s browser action', site => {
    expect(isCrossOriginApiAction('/api/summary', 'GET', new Headers({
      host: 'drudge.microzj.com', origin: 'https://drudge.microzj.com', 'sec-fetch-site': site,
    }))).toBe(false);
  });

  it('checks Origin when Fetch Metadata is unavailable', () => {
    expect(isCrossOriginApiAction('/api/scan', 'POST', new Headers({
      host: 'drudge.microzj.com', origin: 'https://other.microzj.com',
    }))).toBe(true);
    expect(isCrossOriginApiAction('/api/scan', 'POST', new Headers({ origin: 'null' }))).toBe(true);
  });

  it('preserves headerless scheduler requests and read-only queries', () => {
    expect(isCrossOriginApiAction('/api/summary', 'GET', new Headers())).toBe(false);
    expect(isCrossOriginApiAction('/api/scan', 'GET', new Headers({ 'sec-fetch-site': 'cross-site' }))).toBe(false);
    expect(isCrossOriginApiAction('/briefings/one', 'GET', new Headers({ 'sec-fetch-site': 'cross-site' }))).toBe(false);
  });
});
