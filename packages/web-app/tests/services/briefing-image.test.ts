import {
  BRIEFING_IMAGE_HEIGHT,
  BRIEFING_IMAGE_WIDTH,
  escapeXml,
  renderBriefingSvg,
  wrapText,
} from '../../src/lib/services/briefing-image';
import type { BriefingDocument, BriefingItem } from '../../src/lib/services/notification-briefing';

const item = (id: string, level: string, tone: BriefingItem['tone']): BriefingItem => ({
  id,
  level,
  tone,
  label: `${id} 标签`,
  headline: `${id} 标题`,
  time: '14:30',
  detail: `事实：${id} 完整事实`,
  source: 'futu_live',
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

describe('briefing image renderer', () => {
  it('renders a fixed compact SVG with priority ordering and an overflow cue', () => {
    const svg = renderBriefingSvg(briefing);

    expect(svg).toContain(`width="${BRIEFING_IMAGE_WIDTH}" height="${BRIEFING_IMAGE_HEIGHT}"`);
    expect(svg).toContain('L1 1   L2 1   L3+ 2');
    expect(svg).toContain('另有 1 条');
    expect(svg.indexOf('core-second 标题')).toBeLessThan(svg.indexOf('support-third 标题'));
    expect(svg.indexOf('support-third 标题')).toBeLessThan(svg.indexOf('muted-first 标题'));
    expect(svg).not.toContain('muted-fourth 标题');
    expect(svg).not.toContain('https://example.com');
  });

  it('escapes untrusted text before inserting it into SVG', () => {
    const unsafe = {
      ...briefing,
      title: '<script>alert("x")</script>',
      items: [{ ...briefing.items[0], headline: 'A & B < C' }],
    };
    const svg = renderBriefingSvg(unsafe);

    expect(svg).toContain('&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;');
    expect(svg).toContain('A &amp; B &lt; C');
    expect(svg).not.toContain('<script>');
    expect(escapeXml(`'"&<>`)).toBe('&apos;&quot;&amp;&lt;&gt;');
  });

  it('wraps CJK and Latin text deterministically and marks truncation', () => {
    expect(wrapText('这是一个很长的中文摘要', 4, 2)).toEqual(['这是一个', '很长的…']);
    expect(wrapText('', 4, 2)).toEqual([]);
    expect(wrapText('short', 10, 2)).toEqual(['short']);
  });
});
