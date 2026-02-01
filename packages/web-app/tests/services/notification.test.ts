const webhookService = {
  sendMessage: jest.fn().mockResolvedValue(true),
  testConnection: jest.fn().mockResolvedValue(true)
};

jest.mock('../../src/lib/services/webhook', () => ({
  __esModule: true,
  webhookService
}));

describe('notificationService', () => {
  beforeEach(() => {
    webhookService.sendMessage.mockClear();
    webhookService.testConnection.mockClear();
  });

  it('formats high level news notifications', async () => {
    jest.resetModules();
    const notificationService = (await import('../../src/lib/services/notification')).notificationService;

    const result = await notificationService.sendHighLevelNewsNotification({
      newsId: 'news_1',
      title: 'Title',
      level: 'Level 1',
      urgency: 'critical',
      timestamp: '2024-01-01T00:00:00.000Z',
      companies: ['Company A'],
      persons: ['Person A'],
      events: ['Event A'],
      source: 'futu_live',
      content: 'Long content'.repeat(10),
      url: 'https://example.com'
    });

    expect(result).toBe(true);
    const message = webhookService.sendMessage.mock.calls[0]?.[0];
    expect(message).toContain('标题');
    expect(message).toContain('来源');
    expect(message).toContain('https://example.com');
  });

  it('initializes notification service', async () => {
    jest.resetModules();
    const notificationService = (await import('../../src/lib/services/notification')).notificationService;

    await expect(notificationService.initialize()).resolves.toBeUndefined();
  });

  it('throws when initialization fails', async () => {
    jest.resetModules();
    const notificationService = (await import('../../src/lib/services/notification')).notificationService;
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {
      throw new Error('boom');
    });

    await expect(notificationService.initialize()).rejects.toThrow('boom');

    logSpy.mockRestore();
  });

  it('returns false when high level notification fails', async () => {
    jest.resetModules();
    const notificationService = (await import('../../src/lib/services/notification')).notificationService;

    webhookService.sendMessage.mockRejectedValue(new Error('boom'));

    const result = await notificationService.sendHighLevelNewsNotification({
      newsId: 'news_1',
      title: 'Title',
      level: 'Level 1',
      urgency: 'critical',
      timestamp: '2024-01-01T00:00:00.000Z',
      companies: [],
      persons: [],
      events: []
    });

    expect(result).toBe(false);

    webhookService.sendMessage.mockResolvedValue(true);
  });

  it('sends batch notifications with aggregated entities', async () => {
    jest.resetModules();
    const notificationService = (await import('../../src/lib/services/notification')).notificationService;

    const result = await notificationService.sendBatchHighLevelNewsNotification([
      {
        title: 'Title 1',
        timestamp: '2024-01-01T00:00:00.000Z',
        companies: ['Company A'],
        persons: ['Person A'],
        events: ['Event A']
      },
      {
        title: 'Title 2',
        timestamp: '2024-01-01T01:00:00.000Z',
        companies: ['Company B'],
        persons: [],
        events: []
      }
    ]);

    expect(result).toBe(true);
    const message = webhookService.sendMessage.mock.calls[0]?.[0];
    expect(message).toContain('Level 1');
    expect(message).toContain('涉及公司');
  });

  it('builds time range from numeric and string timestamps', async () => {
    jest.resetModules();
    const notificationService = (await import('../../src/lib/services/notification')).notificationService;

    const result = await notificationService.sendBatchHighLevelNewsNotification([
      {
        title: 'Title 1',
        timestamp: 1704067200000,
        companies: [],
        persons: [],
        events: []
      },
      {
        title: 'Title 0',
        timestamp: null,
        companies: [],
        persons: [],
        events: []
      },
      {
        title: 'Title 2',
        timestamp: 'not-a-date',
        companies: [],
        persons: [],
        events: []
      },
      {
        title: 'Title 3',
        timestamp: '2024-01-01T01:00:00.000Z',
        companies: [],
        persons: [],
        events: []
      }
    ]);

    expect(result).toBe(true);
    const message = webhookService.sendMessage.mock.calls[0]?.[0];
    expect(message).toContain('时间范围');
  });

  it('handles batch notifications with missing entity arrays', async () => {
    jest.resetModules();
    const notificationService = (await import('../../src/lib/services/notification')).notificationService;

    const result = await notificationService.sendBatchHighLevelNewsNotification([
      {
        title: 'Title 1',
        timestamp: '2024-01-01T00:00:00.000Z'
      }
    ] as any);

    expect(result).toBe(true);
    expect(webhookService.sendMessage).toHaveBeenCalled();
  });

  it('skips batch notifications when no news', async () => {
    jest.resetModules();
    const notificationService = (await import('../../src/lib/services/notification')).notificationService;

    const result = await notificationService.sendBatchHighLevelNewsNotification([]);

    expect(result).toBe(false);
    expect(webhookService.sendMessage).not.toHaveBeenCalled();
  });

  it('handles batch notification failures', async () => {
    jest.resetModules();
    const notificationService = (await import('../../src/lib/services/notification')).notificationService;

    webhookService.sendMessage.mockRejectedValue(new Error('fail'));

    const result = await notificationService.sendBatchHighLevelNewsNotification([
      {
        title: 'Title',
        timestamp: '2024-01-01T00:00:00.000Z',
        companies: ['Company A', 'Company B', 'Company C', 'Company D', 'Company E', 'Company F'],
        persons: ['Person A', 'Person B', 'Person C', 'Person D', 'Person E', 'Person F'],
        events: ['Event A', 'Event B', 'Event C', 'Event D']
      }
    ]);

    expect(result).toBe(false);
    const message = webhookService.sendMessage.mock.calls[0]?.[0];
    expect(message).toContain('等');

    webhookService.sendMessage.mockResolvedValue(true);
  });

  it('handles high level notifications with minimal fields', async () => {
    jest.resetModules();
    const notificationService = (await import('../../src/lib/services/notification')).notificationService;

    const result = await notificationService.sendHighLevelNewsNotification({
      newsId: 'news_2',
      title: 'Title',
      level: 'Level 2',
      urgency: 'low',
      timestamp: '2024-01-01T00:00:00.000Z',
      companies: [],
      persons: [],
      events: [],
      content: 'short'
    });

    expect(result).toBe(true);
    const message = webhookService.sendMessage.mock.calls[0]?.[0];
    expect(message).toContain('⚠️');
  });

  it('includes overflow markers for long entity lists', async () => {
    jest.resetModules();
    const notificationService = (await import('../../src/lib/services/notification')).notificationService;

    const result = await notificationService.sendHighLevelNewsNotification({
      newsId: 'news_3',
      title: 'Title',
      level: 'Level 1',
      urgency: 'critical',
      timestamp: '2024-01-01T00:00:00.000Z',
      companies: ['A', 'B', 'C', 'D'],
      persons: ['P1', 'P2', 'P3', 'P4'],
      events: ['E1', 'E2', 'E3'],
      content: 'short'
    });

    expect(result).toBe(true);
    const message = webhookService.sendMessage.mock.calls[0]?.[0];
    expect(message).toContain('等');
  });

  it('sends summary and system alerts', async () => {
    jest.resetModules();
    const notificationService = (await import('../../src/lib/services/notification')).notificationService;

    const summaryResult = await notificationService.sendNormalSummaryNotification(
      'summary text',
      '2024-01-01T00:00:00.000Z',
      '2024-01-01T01:00:00.000Z',
      []
    );

    const alertResult = await notificationService.sendSystemAlert('Title', 'Message');

    expect(summaryResult).toBe(true);
    expect(alertResult).toBe(true);
    expect(webhookService.sendMessage).toHaveBeenCalled();
  });

  it('includes level 1 block in summaries', async () => {
    jest.resetModules();
    const notificationService = (await import('../../src/lib/services/notification')).notificationService;

    const result = await notificationService.sendNormalSummaryNotification(
      { summary: 'summary text' },
      '2024-01-01T00:00:00.000Z',
      '2024-01-01T01:00:00.000Z',
      [{ title: 'Title', level: 'Level 1' }]
    );

    expect(result).toBe(true);
    const message = webhookService.sendMessage.mock.calls[0]?.[0];
    expect(message).toContain('Level 1 新闻');
  });

  it('returns false when summary notification fails', async () => {
    jest.resetModules();
    const notificationService = (await import('../../src/lib/services/notification')).notificationService;

    webhookService.sendMessage.mockRejectedValue(new Error('boom'));

    const result = await notificationService.sendNormalSummaryNotification(
      'summary text',
      '2024-01-01T00:00:00.000Z',
      '2024-01-01T01:00:00.000Z',
      []
    );

    expect(result).toBe(false);

    webhookService.sendMessage.mockResolvedValue(true);
  });

  it('returns health check status', async () => {
    jest.resetModules();
    const notificationService = (await import('../../src/lib/services/notification')).notificationService;

    const result = await notificationService.healthCheck();

    expect(result.status).toBe('healthy');
    expect(result.webhook_connection).toBe('connected');
    expect(webhookService.testConnection).toHaveBeenCalled();
  });

  it('returns false when system alert fails', async () => {
    jest.resetModules();
    const notificationService = (await import('../../src/lib/services/notification')).notificationService;

    webhookService.sendMessage.mockRejectedValue(new Error('boom'));

    const result = await notificationService.sendSystemAlert('Title', 'Message');

    expect(result).toBe(false);

    webhookService.sendMessage.mockResolvedValue(true);
  });

  it('returns unhealthy status when webhook fails', async () => {
    jest.resetModules();
    const notificationService = (await import('../../src/lib/services/notification')).notificationService;

    webhookService.testConnection.mockRejectedValue(new Error('fail'));

    const result = await notificationService.healthCheck();

    expect(result.status).toBe('unhealthy');
    expect(result.webhook_connection).toBeUndefined();
  });
});
