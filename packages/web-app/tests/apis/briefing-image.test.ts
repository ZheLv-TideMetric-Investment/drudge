import type { BriefingDocument } from '../../src/lib/services/notification-briefing';

const readBriefing = jest.fn();
jest.mock('../../src/lib/services/briefing-store', () => ({ readBriefing }));

const id = '0123456789abcdef0123456789abcdef';
const document: BriefingDocument = {
  id,
  createdAt: '2026-09-05T13:00:00.000Z',
  title: '模拟简报',
  meta: '20:00–21:00 · 40 条',
  l1Count: 0,
  l2Count: 0,
  l3PlusCount: 40,
  items: Array.from({ length: 40 }, (_, index) => ({
    id: `item-${index}`,
    level: 'L3',
    tone: 'muted',
    label: `内容${index}`,
    headline: `内容${index}`,
    detail: '事实：完整保留本段模拟内容。'.repeat(10),
    time: '20:30',
    source: '模拟来源',
    url: 'https://example.com/source',
  })),
};

describe('briefing image route', () => {
  beforeEach(() => readBriefing.mockReset().mockResolvedValue(document));

  it('serves separate image pages with different cache validators', async () => {
    const { GET } = await import('../../src/app/briefings/[id]/image.svg/route');
    const first = await GET(new Request(`https://example.com/briefings/${id}/image.svg?page=1`), {
      params: Promise.resolve({ id }),
    });
    const second = await GET(new Request(`https://example.com/briefings/${id}/image.svg?page=2`), {
      params: Promise.resolve({ id }),
    });
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(first.headers.get('content-type')).toContain('image/svg+xml');
    expect(first.headers.get('etag')).not.toBe(second.headers.get('etag'));
    expect(await first.text()).not.toEqual(await second.text());
  });

  it('keeps an unpaged existing URL readable with the last item included', async () => {
    const { GET } = await import('../../src/app/briefings/[id]/image.svg/route');
    const response = await GET(new Request(`https://example.com/briefings/${id}/image.svg`), {
      params: Promise.resolve({ id }),
    });
    expect(response.status).toBe(200);
    expect(await response.text()).toContain('内容39');
  });

  it.each(['0', '-1', '1.5', 'invalid', '999999'])(
    'does not silently serve another page for %s',
    async page => {
      const { GET } = await import('../../src/app/briefings/[id]/image.svg/route');
      const response = await GET(
        new Request(`https://example.com/briefings/${id}/image.svg?page=${page}`),
        { params: Promise.resolve({ id }) }
      );
      expect(response.status).toBe(404);
    }
  );

  it('returns not found for a missing briefing', async () => {
    readBriefing.mockResolvedValue(null);
    const { GET } = await import('../../src/app/briefings/[id]/image.svg/route');
    const response = await GET(
      new Request(`https://example.com/briefings/${id}/image.svg?page=1`),
      { params: Promise.resolve({ id }) }
    );
    expect(response.status).toBe(404);
  });
});
