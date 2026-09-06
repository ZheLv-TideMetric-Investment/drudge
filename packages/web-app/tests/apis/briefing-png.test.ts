import type { BriefingDocument } from '../../src/lib/services/notification-briefing';
import { renderBriefingImages } from '../../src/lib/services/briefing-image';
import { renderBriefingPng } from '../../src/lib/services/briefing-png';

const readBriefing = jest.fn();
jest.mock('../../src/lib/services/briefing-store', () => ({ readBriefing }));

const id = '0123456789abcdef0123456789abcdef';
const document: BriefingDocument = {
  id,
  createdAt: '2026-09-06T06:00:00.000Z',
  title: '合成简报',
  meta: '40 条',
  l1Count: 0,
  l2Count: 0,
  l3PlusCount: 40,
  items: Array.from({ length: 40 }, (_, index) => ({
    id: `item-${index}`,
    level: 'L3',
    tone: 'muted',
    label: '合成事件',
    headline: `某企业${index}拟投资12亿元建新产线，仍需审批。`,
    emphasis: ['拟投资12亿元建新产线'],
    detail: '历史：去年已披露扩产计划。',
    time: '',
  })),
};

const get = async (query = '') => {
  const { GET } = await import('../../src/app/briefings/[id]/image.png/route');
  return GET(new Request(`https://example.com/briefings/${id}/image.png${query}`), {
    params: Promise.resolve({ id }),
  });
};

describe('briefing PNG delivery', () => {
  beforeEach(() => readBriefing.mockReset().mockResolvedValue(document));

  it('serves real PNG pages matching every page of the existing template', async () => {
    const pages = renderBriefingImages(document);
    expect(pages.length).toBeGreaterThan(1);
    const etags = new Set<string>();
    for (const [index, image] of pages.entries()) {
      const response = await get(`?v=plain-2&page=${index + 1}`);
      const png = Buffer.from(await response.arrayBuffer());
      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toBe('image/png');
      expect(response.headers.get('content-length')).toBe(String(png.length));
      expect(response.headers.get('x-content-type-options')).toBe('nosniff');
      expect(response.headers.get('cache-control')).toContain('immutable');
      expect(png.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
      expect(png.subarray(12, 16).toString()).toBe('IHDR');
      expect(png.readUInt32BE(16)).toBe(image.width * 2);
      expect(png.readUInt32BE(20)).toBe(image.height * 2);
      expect(png.subarray(-8, -4).toString()).toBe('IEND');
      expect(png.length).toBeLessThan(2 * 1024 * 1024);
      expect(png).toEqual(await renderBriefingPng(image));
      etags.add(response.headers.get('etag')!);
    }
    expect(etags.size).toBe(pages.length);
  });

  it('renders distinct Chinese glyphs and the original emphasis with bundled fonts', async () => {
    const render = async (headline: string, emphasis?: string[]) =>
      renderBriefingPng(
        renderBriefingImages({
          ...document,
          items: [{ ...document.items[0], headline, emphasis, detail: '' }],
        })[0]
      );
    const plain = await render('金融快讯');
    expect(plain).not.toEqual(await render('产业消息'));
    expect(plain).not.toEqual(await render(''));
    expect(plain).not.toEqual(await render('金融快讯', ['金融快讯']));
  });

  it('defaults to the first page when no page is supplied', async () => {
    const response = await get();
    const first = await get('?page=1');
    expect(response.headers.get('etag')).toBe(first.headers.get('etag'));
    expect(await response.arrayBuffer()).toEqual(await first.arrayBuffer());
  });

  it.each(['0', '-1', '1.5', '', 'invalid', '999999'])(
    'returns 404 instead of silently substituting another page for %s',
    async page => expect((await get(`?page=${page}`)).status).toBe(404)
  );

  it('returns 404 for a missing snapshot', async () => {
    readBriefing.mockResolvedValue(null);
    expect((await get('?page=1')).status).toBe(404);
  });
});
