import {
  BRIEFING_IMAGE_WIDTH,
  BRIEFING_IMAGE_MAX_HEIGHT,
  escapeXml,
  renderBriefingImages,
  renderBriefingSvg,
  wrapText,
} from '../../src/lib/services/briefing-image';
import type { BriefingDocument, BriefingItem } from '../../src/lib/services/notification-briefing';
import { parseSummaryItems } from '../../src/lib/services/notification-briefing';

const item = (id: string, level: string, tone: BriefingItem['tone']): BriefingItem => ({
  id,
  level,
  tone,
  label: `${id} 标签`,
  headline: `${id} 标题`,
  time: '14:30',
  detail: `事实：${id} 完整事实\n公司：示例公司\n背景：仍需进一步确认`,
  source: '示例来源',
  url: `https://example.com/${id}`,
});
const briefing: BriefingDocument = {
  id: '0123456789abcdef0123456789abcdef',
  createdAt: '2026-09-03T01:00:00.000Z',
  title: '重点财经快讯',
  meta: '14:30-14:35 · 4 条',
  l1Count: 1,
  l2Count: 1,
  l3PlusCount: 2,
  items: [
    item('muted-first', 'L3', 'muted'),
    item('core-second', 'L1', 'core'),
    item('support-third', 'L2', 'support'),
    item('muted-fourth', 'L4', 'muted'),
  ],
};
const heightOf = (svg: string): number => Number(svg.match(/<svg[^>]* height="(\d+)"/)?.[1]);
const visibleText = (svg: string): string =>
  [...svg.matchAll(/<text\b[^>]*>(.*?)<\/text>/gs)]
    .filter(match => match[1].includes('<tspan'))
    .map(match => match[1].replace(/<[^>]+>/g, ''))
    .join('');

describe('briefing image renderer', () => {
  it('shows every event with optional context and source, keeping detailed facts and entities in the snapshot', () => {
    const before = JSON.stringify(briefing);
    const svg = renderBriefingSvg(briefing);
    const text = visibleText(svg);
    expect(svg).toContain(`width="${BRIEFING_IMAGE_WIDTH}"`);
    for (const entry of briefing.items) {
      expect(text).toContain(entry.headline);
      expect(text).not.toContain(`${entry.id} 完整事实`);
      expect(text).toContain(entry.source);
      expect(text).not.toContain(entry.url);
    }
    expect(text).toContain('背景：仍需进一步确认');
    expect(text).not.toContain('公司：示例公司');
    expect(text.indexOf('core-second 标题')).toBeLessThan(text.indexOf('support-third 标题'));
    expect(text.indexOf('muted-first 标题')).toBeLessThan(text.indexOf('muted-fourth 标题'));
    expect(svg).not.toMatch(/另有|查看详情|DRUDGE BRIEF|…/);
    expect(JSON.stringify(briefing)).toBe(before);
  });

  it('grows with all ten items instead of clipping to three or shrinking the text', () => {
    const ten = {
      ...briefing,
      items: Array.from({ length: 10 }, (_, index) => item(`entry-${index}`, 'L3', 'muted')),
    };
    const svg = renderBriefingSvg(ten);
    const single = renderBriefingSvg({ ...briefing, items: [briefing.items[0]] });
    expect(heightOf(svg)).toBeGreaterThan(heightOf(single));
    expect(visibleText(svg)).toContain('entry-9 标题');
    expect(svg).toContain('font-size="30"');
    const yPositions = [...svg.matchAll(/<(?:text|line)[^>]* (?:y|y1)="(\d+)"/g)].map(match =>
      Number(match[1])
    );
    expect(Math.max(...yPositions)).toBeLessThan(heightOf(svg));
    const pages = renderBriefingImages(ten);
    expect(pages.length).toBeGreaterThan(1);
    for (const page of pages) {
      expect(page.height).toBeLessThanOrEqual(BRIEFING_IMAGE_MAX_HEIGHT);
      expect(page.svg).toContain('font-size="30"');
    }
  });

  it('does not invent background or reserve space for missing context', () => {
    const empty = { ...briefing.items[0], detail: '', url: '', time: '', source: '' };
    const short = renderBriefingSvg({ ...briefing, items: [empty] });
    const full = renderBriefingSvg({ ...briefing, items: [briefing.items[0]] });
    expect(heightOf(short)).toBeLessThan(heightOf(full));
    expect(short).not.toContain('undefined');
    expect(visibleText(short)).not.toContain('原文：');
    expect(visibleText(short)).not.toMatch(/历史|背景|暂无/);
  });

  it('keeps a long existing event intact and uses only the first complete context sentence', () => {
    const headline = '很长的标题包括关键数字25.75亿元与事件时间。'.repeat(40);
    const detail =
      '事实：完整信息留在详情。\n历史：上次利率维持不变，但通胀仍高于目标。更早的脉络留在详情。';
    const svg = renderBriefingSvg({
      ...briefing,
      items: [{ ...briefing.items[0], headline, detail }],
    });
    const text = visibleText(svg)
      .replaceAll(briefing.title, '')
      .replaceAll(briefing.meta, '')
      .replaceAll('长婷报社', '')
      .replaceAll('L3 · 接上图', '');
    expect(text).toContain(headline);
    expect(text).toContain('历史：上次利率维持不变，但通胀仍高于目标。');
    expect(text).not.toContain('更早的脉络');
    expect(text).not.toContain('完整信息留在详情');
    expect(svg).not.toContain('…');
    const pages = renderBriefingImages({
      ...briefing,
      items: [{ ...briefing.items[0], headline, detail }],
    });
    expect(pages.length).toBeGreaterThan(1);
    expect(pages.every(page => page.height <= BRIEFING_IMAGE_MAX_HEIGHT)).toBe(true);
    expect(pages[1].svg).toContain('接上图');
  });

  it('moves a repeated trailing timestamp to metadata without losing the date', () => {
    const headline = '示例标题（2026-09-05 14:30）';
    const svg = renderBriefingSvg({ ...briefing, items: [{ ...briefing.items[0], headline }] });
    expect(visibleText(svg)).toContain('2026-09-05 14:30');
    expect(visibleText(svg)).toContain('示例标题');
    expect(svg).not.toContain('示例标题（');
    const different = renderBriefingSvg({
      ...briefing,
      items: [{ ...briefing.items[0], headline, time: '13:00' }],
    });
    expect(visibleText(different)).toContain(headline);
  });

  it('escapes XML markup and removes invalid XML control characters', () => {
    const svg = renderBriefingSvg({
      ...briefing,
      title: '<script>alert("x")</script>',
      items: [{ ...briefing.items[0], headline: 'A & B < C', detail: '历史：安全\u0000内容' }],
    });
    expect(svg).toContain('&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;');
    expect(svg).toContain('A &amp; B &lt; C');
    expect(svg).not.toContain('<script>');
    expect(svg).not.toContain('\u0000');
    expect(escapeXml(`'"&<>`)).toBe('&apos;&quot;&amp;&lt;&gt;');
  });

  it('removes image URLs without dropping qualifiers in the event sentence or changing the snapshot', () => {
    const entry = {
      ...briefing.items[0],
      headline: '示例企业拟建 8 万台产能，仍需审批 https://example.com/release',
      source: '示例交易所',
      detail:
        '事实：详细进度仅供深入阅读。\n原文：https://example.com/original\n背景：上期产能为 5 万台 https://example.com/report，口径相同。\n公司：示例公司',
    };
    const before = JSON.stringify(entry);
    const text = visibleText(renderBriefingSvg({ ...briefing, items: [entry] }));
    expect(text).toContain('示例企业拟建 8 万台产能，仍需审批');
    expect(text).toContain('示例交易所');
    expect(text).toContain('上期产能为 5 万台');
    expect(text).toContain('口径相同。');
    expect(text).not.toContain('公司：');
    expect(text).not.toMatch(/https?:\/\/|example\.com|原文：/);
    expect(JSON.stringify(entry)).toBe(before);
  });

  it('emphasizes existing event quantities while retaining uncertainty and leaving context quiet', () => {
    const headline = '示例企业拟投资 12 亿元，规划 8 万台产能，贷款 3 亿元尚未落实';
    const detail = '背景：上期投资 5 亿元。\n公司：示例公司';
    const svg = renderBriefingSvg({
      ...briefing,
      items: [{ ...briefing.items[0], headline, detail }],
    });
    const emphasized = [...svg.matchAll(/<tspan font-weight="700"[^>]*>([^<]+)<\/tspan>/g)].map(
      match => match[1]
    );
    expect(emphasized).toEqual(['12 亿元', '8 万台']);
    const text = visibleText(svg);
    expect(text).toContain(headline);
    expect(text).toContain('背景：上期投资 5 亿元。');
  });

  it('separates the actual summary format into event, brief history and timestamp without changing H5 content', () => {
    const items = parseSummaryItems(`## Level 1级新闻总结
- **示例央行**下调利率 **25bp** *(截至 14:30)* [历史：上次会议维持不变。] [原文](https://example.com/rate)
## Level 2级新闻总结
- **示例企业**否认裁员传闻 *(14:35)*`);
    const before = JSON.stringify(items);
    const text = visibleText(renderBriefingSvg({ ...briefing, meta: '2 条', items }));
    expect(text).toContain('示例央行下调利率 25bp');
    expect(text).toContain('历史：上次会议维持不变。');
    expect(text).toContain('截至 14:30');
    expect(text).toContain('示例企业否认裁员传闻');
    expect(text).not.toMatch(/\[历史|\(截至|原文|https/);
    expect(text.indexOf('25bp')).toBeLessThan(text.indexOf('历史：'));
    expect(text.indexOf('历史：')).toBeLessThan(text.indexOf('截至 14:30'));
    expect(JSON.stringify(items)).toBe(before);
  });

  it('wraps mixed text and explicit paragraph breaks without dropping the end', () => {
    expect(wrapText('这是一个很长的中文摘要', 4)).toEqual(['这是一个', '很长的中', '文摘要']);
    expect(wrapText('', 4)).toEqual([]);
    expect(wrapText('short', 10)).toEqual(['short']);
    expect(wrapText('第一段\r\n第二段', 10)).toEqual(['第一段', '第二段']);
    expect(wrapText('这是测试，继续阅读。', 4)).toEqual(['这是测', '试，继续', '阅读。']);
    const rate = '利率下调至3.25%，次日生效。';
    expect(wrapText(rate, 8).some(line => line.includes('3.25%'))).toBe(true);
    expect(wrapText(rate, 8).join('')).toBe(rate);
    expect(wrapText('ABC 123中文😀结尾', 4).join('')).toContain('结尾');
    expect(() => wrapText('text', 0)).toThrow('Invalid text width');
  });
});
