// next.config.ts injects this non-secret value at build time for both Edge middleware and server code.
export const BUILT_BRIEFING_PUBLIC_HOST = process.env.DRUDGE_BRIEFING_PUBLIC_HOST ?? '';

export const isBriefingPublicHost = (hostname: string, configuredHost: string): boolean => {
  const normalizedConfiguredHost = configuredHost.trim().toLowerCase();
  return (
    Boolean(normalizedConfiguredHost) && hostname.trim().toLowerCase() === normalizedConfiguredHost
  );
};

export const hostnameFromHostHeader = (value: string | null): string => {
  const host = value?.trim() ?? '';
  if (!host || host.includes(',')) return '';

  try {
    return new URL(`http://${host}`).hostname.toLowerCase();
  } catch {
    return '';
  }
};

// Keep other web pages from triggering business actions. Internal scheduler calls
// have no browser Origin / Fetch Metadata headers and remain compatible.
export const isCrossOriginApiAction = (
  pathname: string,
  method: string,
  headers: Headers
): boolean => {
  const isAction =
    pathname.startsWith('/api/') &&
    (!['GET', 'HEAD', 'OPTIONS'].includes(method) || pathname === '/api/summary');
  if (!isAction) return false;

  const fetchSite = headers.get('sec-fetch-site');
  if (fetchSite && fetchSite !== 'same-origin' && fetchSite !== 'none') return true;

  const origin = headers.get('origin');
  if (!origin) return false;
  try {
    return new URL(origin).host.toLowerCase() !== headers.get('host')?.toLowerCase();
  } catch {
    return true;
  }
};
