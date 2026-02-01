import { freezeTime } from '../helpers/fake-time';

const neo4jNewsService = {
  getHighLevelNews: jest.fn()
};

const notificationService = {
  sendBatchHighLevelNewsNotification: jest.fn()
};

jest.mock('../../src/lib/neo4j', () => ({
  __esModule: true,
  neo4jNewsService
}));

jest.mock('../../src/lib/services/notification', () => ({
  __esModule: true,
  notificationService
}));

describe('highLevelNewsScanner', () => {
  beforeEach(() => {
    neo4jNewsService.getHighLevelNews.mockReset();
    notificationService.sendBatchHighLevelNewsNotification.mockReset();
  });

  it('returns empty result when no news found', async () => {
    const restoreTime = freezeTime('2024-01-01T00:00:00.000Z');
    try {
      jest.resetModules();
      const { highLevelNewsScanner } = await import('../../src/lib/services/high-level-scanner');

      neo4jNewsService.getHighLevelNews.mockResolvedValue([]);

      const result = await highLevelNewsScanner.scanHighLevelNews();

      expect(result.success).toBe(true);
      expect(result.found).toBe(0);
      expect(result.message).toContain('没有发现');
    } finally {
      restoreTime();
    }
  });

  it('calls notification helper with empty list when skipProcessed is false', async () => {
    const restoreTime = freezeTime('2024-01-01T00:00:00.000Z');
    try {
      jest.resetModules();
      const { highLevelNewsScanner } = await import('../../src/lib/services/high-level-scanner');

      neo4jNewsService.getHighLevelNews.mockResolvedValue([]);

      const result = await highLevelNewsScanner.scanHighLevelNews(undefined, undefined, {
        skipProcessed: false
      });

      expect(result.success).toBe(true);
      expect(result.sent).toBe(0);
    } finally {
      restoreTime();
    }
  });

  it('returns zero when sendNotifications receives empty list', async () => {
    const restoreTime = freezeTime('2024-01-01T00:00:00.000Z');
    try {
      jest.resetModules();
      const { highLevelNewsScanner } = await import('../../src/lib/services/high-level-scanner');

      const result = await (highLevelNewsScanner as any).sendNotifications([]);

      expect(result).toBe(0);
    } finally {
      restoreTime();
    }
  });

  it('sends notifications for new high level news', async () => {
    const restoreTime = freezeTime('2024-01-01T00:00:00.000Z');
    try {
      jest.resetModules();
      const { highLevelNewsScanner } = await import('../../src/lib/services/high-level-scanner');

      const newsItems = [
        {
          newsId: 'news_1',
          title: 'Title 1',
          level: 'Level 1',
          urgency: 'high',
          timestamp: '2024-01-01T00:00:00.000Z',
          companies: ['Company A'],
          persons: [],
          organizations: [],
          events: []
        }
      ];

      neo4jNewsService.getHighLevelNews.mockResolvedValue(newsItems);
      notificationService.sendBatchHighLevelNewsNotification.mockResolvedValue(true);

      const result = await highLevelNewsScanner.scanHighLevelNews();

      expect(result.success).toBe(true);
      expect(result.found).toBe(1);
      expect(result.sent).toBe(1);
      expect(notificationService.sendBatchHighLevelNewsNotification).toHaveBeenCalledWith(newsItems);
    } finally {
      restoreTime();
    }
  });

  it('supports custom scan range and defaults organizations', async () => {
    const restoreTime = freezeTime('2024-01-01T00:00:00.000Z');
    try {
      jest.resetModules();
      const { highLevelNewsScanner } = await import('../../src/lib/services/high-level-scanner');

      const newsItems = [
        {
          newsId: 'news_10',
          title: 'Title 10',
          level: 'Level 1',
          urgency: 'high',
          timestamp: '2024-01-01T00:00:00.000Z',
          companies: [],
          persons: [],
          events: []
        }
      ];

      neo4jNewsService.getHighLevelNews.mockResolvedValue(newsItems);
      notificationService.sendBatchHighLevelNewsNotification.mockResolvedValue(true);

      const result = await highLevelNewsScanner.scanHighLevelNews(
        '2024-01-01T00:00:00.000Z',
        '2024-01-01T01:00:00.000Z',
        { skipProcessed: false }
      );

      expect(result.message).toContain('自定义');
      const firstNews = (result.high_level_news as any)?.[0];
      expect(firstNews?.organizations ?? []).toEqual([]);
    } finally {
      restoreTime();
    }
  });

  it('accepts Date inputs for scan range', async () => {
    const restoreTime = freezeTime('2024-01-01T00:00:00.000Z');
    try {
      jest.resetModules();
      const { highLevelNewsScanner } = await import('../../src/lib/services/high-level-scanner');

      neo4jNewsService.getHighLevelNews.mockResolvedValue([]);

      const result = await highLevelNewsScanner.scanHighLevelNews(
        new Date('2024-01-01T00:00:00.000Z'),
        new Date('2024-01-01T01:00:00.000Z'),
        { skipProcessed: false }
      );

      expect(result.success).toBe(true);
      expect(result.period).toContain('-');
    } finally {
      restoreTime();
    }
  });

  it('skips already processed news', async () => {
    const restoreTime = freezeTime('2024-01-01T00:00:00.000Z');
    try {
      jest.resetModules();
      const { highLevelNewsScanner } = await import('../../src/lib/services/high-level-scanner');

      const newsItems = [
        {
          newsId: 'news_1',
          title: 'Title 1',
          level: 'Level 1',
          urgency: 'high',
          timestamp: '2024-01-01T00:00:00.000Z',
          companies: ['Company A'],
          persons: [],
          organizations: [],
          events: []
        }
      ];

      neo4jNewsService.getHighLevelNews.mockResolvedValue(newsItems);
      notificationService.sendBatchHighLevelNewsNotification.mockResolvedValue(true);

      await highLevelNewsScanner.scanHighLevelNews();

      const secondResult = await highLevelNewsScanner.scanHighLevelNews();

      expect(secondResult.success).toBe(true);
      expect(secondResult.sent).toBe(0);
      expect(secondResult.message).toContain('都已处理过');
    } finally {
      restoreTime();
    }
  });

  it('returns error when time range is invalid', async () => {
    const restoreTime = freezeTime('2024-01-01T00:00:00.000Z');
    try {
      jest.resetModules();
      const { highLevelNewsScanner } = await import('../../src/lib/services/high-level-scanner');

      const result = await highLevelNewsScanner.scanHighLevelNews(
        '2024-01-02T00:00:00.000Z',
        '2024-01-01T00:00:00.000Z'
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('开始时间不能晚于结束时间');
    } finally {
      restoreTime();
    }
  });

  it('returns error for invalid time format', async () => {
    const restoreTime = freezeTime('2024-01-01T00:00:00.000Z');
    try {
      jest.resetModules();
      const { highLevelNewsScanner } = await import('../../src/lib/services/high-level-scanner');

      const result = await highLevelNewsScanner.scanHighLevelNews('bad-time', '2024-01-01T00:00:00.000Z');

      expect(result.success).toBe(false);
      expect(result.error).toContain('无效的时间格式');
    } finally {
      restoreTime();
    }
  });

  it('supports skipping notifications and processed checks', async () => {
    const restoreTime = freezeTime('2024-01-01T00:00:00.000Z');
    try {
      jest.resetModules();
      const { highLevelNewsScanner } = await import('../../src/lib/services/high-level-scanner');

      const newsItems = [
        {
          newsId: 'news_1',
          title: 'Title 1',
          level: 'Level 1',
          urgency: 'high',
          timestamp: '2024-01-01T00:00:00.000Z',
          companies: [],
          persons: [],
          organizations: [],
          events: []
        }
      ];

      neo4jNewsService.getHighLevelNews.mockResolvedValue(newsItems);

      const result = await highLevelNewsScanner.scanHighLevelNews(undefined, undefined, {
        sendNotifications: false,
        skipProcessed: false
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain('全部');
      expect(notificationService.sendBatchHighLevelNewsNotification).not.toHaveBeenCalled();
    } finally {
      restoreTime();
    }
  });

  it('handles notification failures and cleanup', async () => {
    const restoreTime = freezeTime('2024-01-01T00:00:00.000Z');
    try {
      jest.resetModules();
      const { highLevelNewsScanner } = await import('../../src/lib/services/high-level-scanner');

      const newsItems = [
        {
          newsId: 'news_2000',
          title: 'Title 1',
          level: 'Level 1',
          urgency: 'high',
          timestamp: '2024-01-01T00:00:00.000Z',
          companies: [],
          persons: [],
          organizations: [],
          events: []
        }
      ];

      neo4jNewsService.getHighLevelNews.mockResolvedValue(newsItems);
      notificationService.sendBatchHighLevelNewsNotification.mockResolvedValue(false);

      const processed = (highLevelNewsScanner as any).processedNewsIds as Set<string>;
      for (let i = 0; i < 1005; i += 1) {
        processed.add(`news_${i}`);
      }

      const result = await highLevelNewsScanner.scanHighLevelNews();

      expect(result.sent).toBe(0);
      expect(result.message).toContain('无需发送通知');
      expect(processed.size).toBeLessThan(1005);
    } finally {
      restoreTime();
    }
  });

  it('handles notification throws in sendNotifications', async () => {
    const restoreTime = freezeTime('2024-01-01T00:00:00.000Z');
    try {
      jest.resetModules();
      const { highLevelNewsScanner } = await import('../../src/lib/services/high-level-scanner');

      const newsItems = [
        {
          newsId: 'news_3000',
          title: 'Title 1',
          level: 'Level 1',
          urgency: 'high',
          timestamp: '2024-01-01T00:00:00.000Z',
          companies: [],
          persons: [],
          organizations: [],
          events: []
        }
      ];

      neo4jNewsService.getHighLevelNews.mockResolvedValue(newsItems);
      notificationService.sendBatchHighLevelNewsNotification.mockRejectedValue(new Error('fail'));

      const result = await highLevelNewsScanner.scanHighLevelNews();

      expect(result.sent).toBe(0);
    } finally {
      restoreTime();
    }
  });

  it('formats period across different days', async () => {
    const restoreTime = freezeTime('2024-01-02T00:00:00.000Z');
    try {
      jest.resetModules();
      const { highLevelNewsScanner } = await import('../../src/lib/services/high-level-scanner');

      neo4jNewsService.getHighLevelNews.mockResolvedValue([]);

      const result = await highLevelNewsScanner.scanHighLevelNews(
        '2024-01-01T00:00:00.000Z',
        '2024-01-02T00:00:00.000Z',
        { skipProcessed: false }
      );

      expect(result.period).toContain('01-01');
      expect(result.period).toContain('01-02');
    } finally {
      restoreTime();
    }
  });

  it('reports status and can reset', async () => {
    const restoreTime = freezeTime('2024-01-01T00:00:00.000Z');
    try {
      jest.resetModules();
      const { highLevelNewsScanner } = await import('../../src/lib/services/high-level-scanner');

      const status = highLevelNewsScanner.getStatus();
      expect(status).toMatchObject({
        processedNewsCount: 0,
        isRunning: false
      });

      highLevelNewsScanner.reset();
      expect(highLevelNewsScanner.getStatus().lastScanTime).toBeNull();
    } finally {
      restoreTime();
    }
  });
});
