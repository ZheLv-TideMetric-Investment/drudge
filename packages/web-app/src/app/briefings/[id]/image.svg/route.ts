import { readBriefing } from '@/lib/services/briefing-store';
import {
  BRIEFING_IMAGE_VERSION,
  renderBriefingImages,
  renderBriefingSvg,
} from '@/lib/services/briefing-image';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const pageValue = new URL(request.url).searchParams.get('page');
  if (pageValue !== null && !/^[1-9]\d*$/.test(pageValue)) {
    return new Response('Not found', { status: 404 });
  }
  const { id } = await params;
  const briefing = await readBriefing(id);
  if (!briefing) return new Response('Not found', { status: 404 });
  const svg =
    pageValue === null
      ? renderBriefingSvg(briefing)
      : renderBriefingImages(briefing)[Number(pageValue) - 1]?.svg;
  if (!svg) return new Response('Not found', { status: 404 });

  return new Response(svg, {
    headers: {
      'Cache-Control': 'public, max-age=31536000, immutable',
      'Content-Type': 'image/svg+xml; charset=utf-8',
      ETag: `"${briefing.id}-${BRIEFING_IMAGE_VERSION}-${pageValue ?? 'all'}"`,
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
