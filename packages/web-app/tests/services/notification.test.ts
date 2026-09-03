const saveBriefing = jest.fn();
const dingtalkMessageService = {
  sendBriefing: jest.fn(),
  healthCheck: jest.fn(),
};

jest.mock('../../src/lib/services/briefing-store', () => ({ saveBriefing }));
jest.mock('../../src/lib/services/dingtalk-message', () => ({ dingtalkMessageService }));

import { notificationService } from '../../src/lib/services/notification';

describe('notificationService', () => {
  beforeEach(() => {
    saveBriefing.mockReset().mockImplementation(async briefing => ({
      ...briefing,
      id: '0123456789abcdef0123456789abcdef',
      createdAt: '2026-09-03T01:00:00.000Z',
    }));
    dingtalkMessageService.sendBriefing.mockReset().mockResolvedValue(true);
    dingtalkMessageService.healthCheck.mockReset().mockResolvedValue(true);
  });

  it('initializes the single-user image-and-H5 notification channel', async () => {
    await expect(notificationService.initialize()).resolves.toBeUndefined();
  });

  it('persists a complete high-level briefing before sending it', async () => {
    const result = await notificationService.sendHighLevelNewsNotification({
      newsId: 'news-1',
      title: 'Company A raises guidance',
      level: 'Level 1',
      urgency: 'critical',
      timestamp: '2024-01-01T00:00:00.000Z',
      content: 'Revenue guidance increased from 100 to 130.',
      companies: ['Company A', 'Company B', 'Company C', 'Company D'],
      persons: ['Person A'],
      organizations: ['Exchange A'],
      events: ['Guidance update'],
      source: 'futu_live',
      url: 'https://example.com/news-1',
    });

    expect(result).toBe(true);
    const draft = saveBriefing.mock.calls[0]?.[0];
    expect(draft.l1Count).toBe(1);
    expect(draft.items[0].detail).toContain('Revenue guidance increased from 100 to 130.');
    expect(draft.items[0].detail).toContain('Company D');
    expect(draft.items[0].url).toBe('https://example.com/news-1');
    expect(saveBriefing.mock.invocationCallOrder[0]).toBeLessThan(
      dingtalkMessageService.sendBriefing.mock.invocationCallOrder[0]
    );
  });

  it('aggregates a batch without dropping items and skips an empty batch', async () => {
    const newsItems = Array.from({ length: 10 }, (_, index) => ({
      newsId: `news-${index}`,
      title: `News ${index}`,
      level: index === 0 ? 'Level 1' : 'Level 2',
      timestamp: `2024-01-01T${String(index).padStart(2, '0')}:00:00.000Z`,
    }));

    await expect(notificationService.sendBatchHighLevelNewsNotification(newsItems)).resolves.toBe(
      true
    );
    expect(saveBriefing.mock.calls[0]?.[0].items).toHaveLength(10);

    saveBriefing.mockClear();
    dingtalkMessageService.sendBriefing.mockClear();
    await expect(notificationService.sendBatchHighLevelNewsNotification([])).resolves.toBe(false);
    expect(saveBriefing).not.toHaveBeenCalled();
    expect(dingtalkMessageService.sendBriefing).not.toHaveBeenCalled();
  });

  it('turns a level-grouped summary into H5 detail items', async () => {
    const summary = `## Level 1级新闻总结

### 新闻内容
- **央行**下调利率 **25bp** *(10:30)*

## Level 2级新闻总结
- **公司A**发布财报，收入 **130亿元** *(10:45)*`;

    const result = await notificationService.sendNormalSummaryNotification(
      { summary },
      '2024-01-01T00:00:00.000Z',
      '2024-01-01T01:00:00.000Z',
      [{ level: 'Level 1' }, { level: 'Level 2' }]
    );

    expect(result).toBe(true);
    const draft = saveBriefing.mock.calls[0]?.[0];
    expect(draft.items.map((item: any) => item.level)).toEqual(['L1', 'L2']);
    expect(draft.items[0].headline).toContain('25bp');
    expect(draft.items[1].headline).toContain('130亿元');
  });

  it('returns false for persistence and transport failures', async () => {
    dingtalkMessageService.sendBriefing.mockResolvedValueOnce(false);
    await expect(
      notificationService.sendSystemAlert('AI 调用失败', 'provider unavailable')
    ).resolves.toBe(false);

    saveBriefing.mockRejectedValueOnce(new Error('disk full'));
    await expect(
      notificationService.sendHighLevelNewsNotification({ newsId: 'x', title: 'x' })
    ).resolves.toBe(false);

    dingtalkMessageService.sendBriefing.mockRejectedValueOnce(new Error('boom'));
    await expect(
      notificationService.sendBatchHighLevelNewsNotification([{ title: 'x' }])
    ).resolves.toBe(false);

    dingtalkMessageService.sendBriefing.mockRejectedValueOnce(new Error('boom'));
    await expect(
      notificationService.sendNormalSummaryNotification('x', 'start', 'end', [])
    ).resolves.toBe(false);
  });

  it('reports health without sending a test message', async () => {
    const healthy = await notificationService.healthCheck();
    expect(healthy.status).toBe('healthy');
    expect(healthy.dingtalk_message_connection).toBe('connected');
    expect(dingtalkMessageService.sendBriefing).not.toHaveBeenCalled();

    dingtalkMessageService.healthCheck.mockResolvedValueOnce(false);
    const unhealthy = await notificationService.healthCheck();
    expect(unhealthy.status).toBe('unhealthy');
    expect(unhealthy.error).toContain('配置不完整');
  });
});
