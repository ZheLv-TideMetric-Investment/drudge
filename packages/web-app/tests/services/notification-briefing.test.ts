import {
  buildBatchNewsBriefing,
  buildSummaryBriefing,
  buildSystemAlertBriefing,
  detailText,
  parseSummaryItems,
  safeWebUrl,
} from '../../src/lib/services/notification-briefing';

describe('notification briefing formatter', () => {
  it('parses level sections and keeps complete facts and source links', () => {
    const items = parseSummaryItems(`## Level 1级新闻总结

### 新闻内容
- **央行**下调利率 **25bp** *(10:30)* [原文](https://example.com/rate)
  后续说明仍属于同一条事实

---

## 2级新闻总结
- 公司A收入为 **130亿元** *(10:45)*`);

    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({
      level: 'L1',
      tone: 'core',
      time: '10:30',
      url: 'https://example.com/rate',
    });
    expect(`${items[0].headline}\n${items[0].detail}`).toContain('25bp');
    expect(items[0].detail).toContain('后续说明仍属于同一条事实');
    expect(items[1]).toMatchObject({ level: 'L2', tone: 'support', time: '10:45' });
    expect(items[1].headline).toContain('130亿元');
  });

  it('keeps every item for H5 instead of collapsing overflow content', () => {
    const newsItems = Array.from({ length: 10 }, (_, index) => ({
      newsId: `news-${index + 1}`,
      title: `完整新闻标题 ${index + 1}`,
      content: `完整事实内容 ${index + 1}`,
      level: index === 0 ? 'Level 1' : 'Level 3',
      timestamp: 1_704_067_200 + index * 60,
      url: `https://example.com/${index + 1}`,
    }));

    const briefing = buildBatchNewsBriefing(newsItems);

    expect(briefing.items).toHaveLength(10);
    expect(briefing.items[9].detail).toContain('完整事实内容 10');
    expect(briefing.items[9].url).toBe('https://example.com/10');
    expect(briefing.l1Count).toBe(1);
    expect(briefing.l3PlusCount).toBe(9);
  });

  it('promotes source Level 1 news when malformed summary text has no L1 section', () => {
    const briefing = buildSummaryBriefing(
      '这是一段没有标准列表的摘要，包含全部原始信息。',
      '2024-01-01T00:00:00.000Z',
      '2024-01-01T01:00:00.000Z',
      [
        {
          newsId: 'core-1',
          title: '核心事实',
          content: '核心详情',
          level: 'Level 1',
          timestamp: '2024-01-01T00:30:00.000Z',
        },
      ]
    );

    expect(briefing.items[0].level).toBe('L1');
    expect(briefing.items[0].detail).toContain('核心详情');
    expect(
      briefing.items.some(item => `${item.headline}\n${item.detail}`.includes('全部原始信息'))
    ).toBe(true);
  });

  it('keeps structured fields while removing display-only Markdown markers', () => {
    const briefing = buildBatchNewsBriefing([
      {
        newsId: 'one',
        title: '**美联储**维持利率不变',
        content: '目标区间维持不变',
        level: 'Level 1',
        urgency: 'critical',
        companies: ['Company A', 'Company B'],
        source: 'futu_live',
        url: 'https://example.com/one',
      },
    ]);

    const [item] = briefing.items;
    expect(item.headline).toBe('美联储维持利率不变');
    expect(item.detail).toContain('紧急度：critical');
    expect(item.detail).toContain('事实：目标区间维持不变');
    expect(item.detail).toContain('公司：Company A、Company B');
    expect(item.source).toBe('futu_live');
    expect(item.url).toBe('https://example.com/one');
    expect(item.detail).not.toMatch(/###|\*\*/);
  });

  it('rejects non-web links and normalizes free-form detail safely', () => {
    expect(safeWebUrl('javascript:alert(1)')).toBe('');
    expect(safeWebUrl('not a url')).toBe('');
    expect(safeWebUrl('https://example.com/path')).toBe('https://example.com/path');
    expect(detailText('### 标题\n**事实**：完整内容')).toBe('标题\n事实：完整内容');
  });

  it('builds a one-item system alert without needing a card template', () => {
    const briefing = buildSystemAlertBriefing('AI 调用失败', 'provider unavailable');
    expect(briefing.items).toHaveLength(1);
    expect(briefing.items[0]).toMatchObject({
      level: 'L1',
      headline: 'AI 调用失败',
      detail: 'provider unavailable',
      source: 'Drudge',
    });
  });
});
