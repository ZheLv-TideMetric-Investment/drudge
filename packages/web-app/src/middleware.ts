import { NextRequest, NextResponse } from 'next/server';
import {
  BUILT_BRIEFING_PUBLIC_HOST,
  hostnameFromHostHeader,
  isBriefingPublicHost,
  isBriefingPublicPath,
} from './lib/public-surface';

export function middleware(request: NextRequest) {
  const requestHost = hostnameFromHostHeader(request.headers.get('host'));
  if (!isBriefingPublicHost(requestHost, BUILT_BRIEFING_PUBLIC_HOST)) return NextResponse.next();

  if (!isBriefingPublicPath(request.nextUrl.pathname)) {
    return new NextResponse('Not found', {
      status: 404,
      headers: {
        'Cache-Control': 'no-store',
        'X-Robots-Tag': 'noindex, nofollow',
      },
    });
  }

  const response = NextResponse.next();
  response.headers.set('X-Robots-Tag', 'noindex, nofollow');
  return response;
}

export const config = {
  matcher: '/:path*',
};
