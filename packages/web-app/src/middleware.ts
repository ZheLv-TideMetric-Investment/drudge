import { NextRequest, NextResponse } from 'next/server';
import {
  BUILT_BRIEFING_PUBLIC_HOST,
  hostnameFromHostHeader,
  isBriefingPublicHost,
  isCrossOriginApiAction,
} from './lib/public-surface';

export function middleware(request: NextRequest) {
  if (isCrossOriginApiAction(request.nextUrl.pathname, request.method, request.headers)) {
    return NextResponse.json(
      { success: false, error: '请在工作台内发起此操作' },
      { status: 403, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  const response = NextResponse.next();
  const requestHost = hostnameFromHostHeader(request.headers.get('host'));
  if (isBriefingPublicHost(requestHost, BUILT_BRIEFING_PUBLIC_HOST)) {
    response.headers.set('X-Robots-Tag', 'noindex, nofollow');
  }
  return response;
}

export const config = {
  matcher: '/:path*',
};
