// next.config.ts injects this non-secret value at build time for both Edge middleware and server code.
export const BUILT_BRIEFING_PUBLIC_HOST = process.env.DRUDGE_BRIEFING_PUBLIC_HOST ?? '';

export const isBriefingPublicPath = (pathname: string): boolean => {
  return (
    pathname === '/briefings' ||
    pathname.startsWith('/briefings/') ||
    pathname === '/favicon.ico' ||
    pathname.startsWith('/_next/')
  );
};

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
