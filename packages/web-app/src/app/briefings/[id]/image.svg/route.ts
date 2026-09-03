import { readBriefing } from '@/lib/services/briefing-store';
import { renderBriefingSvg } from '@/lib/services/briefing-image';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const briefing = await readBriefing(id);
  if (!briefing) return new Response('Not found', { status: 404 });

  return new Response(renderBriefingSvg(briefing), {
    headers: {
      'Cache-Control': 'public, max-age=31536000, immutable',
      'Content-Type': 'image/svg+xml; charset=utf-8',
      ETag: `"${briefing.id}"`,
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
