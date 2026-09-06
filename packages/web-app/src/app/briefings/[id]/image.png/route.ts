import { readBriefing } from '@/lib/services/briefing-store';
import { BRIEFING_IMAGE_VERSION, renderBriefingImages } from '@/lib/services/briefing-image';
import { renderBriefingPng } from '@/lib/services/briefing-png';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const pageValue = new URL(request.url).searchParams.get('page') ?? '1';
  if (!/^[1-9]\d*$/.test(pageValue)) return new Response('Not found', { status: 404 });

  const { id } = await params;
  const briefing = await readBriefing(id);
  if (!briefing) return new Response('Not found', { status: 404 });
  const image = renderBriefingImages(briefing)[Number(pageValue) - 1];
  if (!image) return new Response('Not found', { status: 404 });
  const png = await renderBriefingPng(image);

  return new Response(new Uint8Array(png), {
    headers: {
      'Cache-Control': 'public, max-age=31536000, immutable',
      'Content-Type': 'image/png',
      'Content-Length': String(png.byteLength),
      ETag: `"${briefing.id}-${BRIEFING_IMAGE_VERSION}-png-${pageValue}"`,
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
