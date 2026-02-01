import { freezeTime } from '../helpers/fake-time';
import { EventLevel } from '../../constants/enums';

const neo4jNewsService = {
  getNewsInTimeRange: jest.fn(),
  getNewsEntities: jest.fn(),
  getHistoricalNewsByEntities: jest.fn()
};

const notificationService = {
  sendNormalSummaryNotification: jest.fn()
};

const aiService = {
  callLLM: jest.fn()
};

const createMessages = jest.fn();
const callSimpleAIText = jest.fn();

jest.mock('../../src/lib/neo4j', () => ({
  __esModule: true,
  neo4jNewsService
}));

jest.mock('../../src/lib/services/notification', () => ({
  __esModule: true,
  notificationService
}));

jest.mock('../../src/lib/utils/llm', () => ({
  __esModule: true,
  aiService,
  createMessages,
  callSimpleAIText
}));

import {
  buildPrompt,
  generateSummary,
  groupByLevel,
  summaryHandlers
} from '../../src/lib/services/summary';

describe('summaryService', () => {
  beforeEach(() => {
    neo4jNewsService.getNewsInTimeRange.mockReset();
    neo4jNewsService.getNewsEntities.mockReset();
    neo4jNewsService.getHistoricalNewsByEntities.mockReset();
    notificationService.sendNormalSummaryNotification.mockReset();
    aiService.callLLM.mockReset();
    createMessages.mockReset();
    callSimpleAIText.mockReset();
  });

  it('builds prompts via createMessages', () => {
    createMessages.mockReturnValue([{ role: 'system', content: 'sys' }]);

    const result = buildPrompt('sys', 'user');

    expect(createMessages).toHaveBeenCalledWith('sys', 'user');
    expect(result).toEqual([{ role: 'system', content: 'sys' }]);
  });

  it('groups news by level', () => {
    const grouped = groupByLevel([
      {
        level: EventLevel.LEVEL_1,
        title: 'A',
        timestamp: '2024-01-01T00:00:00.000Z',
        content: 'A',
        newsId: '1'
      },
      {
        level: EventLevel.LEVEL_2,
        title: 'B',
        timestamp: '2024-01-01T00:00:00.000Z',
        content: 'B',
        newsId: '2'
      },
      {
        level: EventLevel.LEVEL_1,
        title: 'C',
        timestamp: '2024-01-01T00:00:00.000Z',
        content: 'C',
        newsId: '3'
      }
    ]);

    expect(grouped[EventLevel.LEVEL_1]).toHaveLength(2);
    expect(grouped[EventLevel.LEVEL_2]).toHaveLength(1);
  });

  it('groups news with numeric timestamps and fallback time fields', () => {
    const grouped = groupByLevel([
      {
        level: 'Unknown',
        title: 'A',
        timestamp: 1700000000,
        content: 'A',
        newsId: '1'
      },
      {
        level: EventLevel.LEVEL_1,
        title: 'B',
        time: 1700000100,
        content: 'B',
        newsId: '2'
      },
      {
        title: 'C',
        time: '2024-01-01T00:00:00.000Z',
        newsId: '3'
      },
      {
        level: EventLevel.LEVEL_2,
        title: 'D',
        timestamp: 'invalid-time',
        newsId: '4'
      },
      {
        level: EventLevel.LEVEL_2,
        title: 'E',
        newsId: '5'
      }
    ]);

    expect(grouped.Unknown[0].time).toBe(1700000000);
    expect(grouped[EventLevel.LEVEL_1][0].time).toBe(1700000100);
    expect(grouped.Unknown[1].content).toBe('');
    expect(grouped[EventLevel.LEVEL_2][0].time).toBe(0);
    expect(grouped[EventLevel.LEVEL_2][1].time).toBe(0);
  });

  it('fetches news through neo4j service', async () => {
    neo4jNewsService.getNewsInTimeRange.mockResolvedValue({ news_count: 1, news_items: [] });

    const start = new Date('2024-01-01T00:00:00.000Z');
    const end = new Date('2024-01-01T01:00:00.000Z');

    const result = await summaryHandlers.fetchNews(start, end);

    expect(neo4jNewsService.getNewsInTimeRange).toHaveBeenCalledWith(
      start.toISOString(),
      end.toISOString()
    );
    expect(result.news_count).toBe(1);
  });

  it('extracts and deduplicates entities', async () => {
    neo4jNewsService.getNewsEntities
      .mockResolvedValueOnce([
        { name: 'Entity A', type: 'Company' },
        { name: 'Entity B', type: 'Location' }
      ])
      .mockResolvedValueOnce([{ name: 'Entity A', type: 'Company' }]);

    const result = await summaryHandlers.extractEntitiesFromNews([
      { newsId: 'news_1' },
      { newsId: 'news_2' }
    ]);

    expect(result).toEqual([{ name: 'Entity A', type: 'Company' }]);
  });

  it('handles extraction with no news items', async () => {
    const result = await summaryHandlers.extractEntitiesFromNews([]);

    expect(result).toEqual([]);
  });

  it('handles entity extraction failures', async () => {
    neo4jNewsService.getNewsEntities.mockRejectedValue(new Error('boom'));

    const result = await summaryHandlers.extractEntitiesFromNews([{ newsId: 'news_1' }]);

    expect(result).toEqual([]);
  });

  it('skips historical news when no entities', async () => {
    const result = await summaryHandlers.getHistoricalNewsForEntities([], new Date('2024-01-01T00:00:00.000Z'));

    expect(result).toEqual([]);
    expect(neo4jNewsService.getHistoricalNewsByEntities).not.toHaveBeenCalled();
  });

  it('summarizes entities with historical news', async () => {
    callSimpleAIText.mockResolvedValue({ success: true, data: 'summary' });

    const result = await summaryHandlers.generateEntitySummaries(
      [{ name: 'Entity A', type: 'Company' }],
      [{ relatedEntity: 'Entity A', timestamp: '2024-01-01T00:00:00.000Z', title: 'Old' }]
    );

    expect(result).toEqual({ 'Entity A': 'summary' });
  });

  it('sorts historical news before summarizing', async () => {
    callSimpleAIText.mockResolvedValue({ success: true, data: 'summary' });

    await summaryHandlers.generateEntitySummaries(
      [{ name: 'Entity A', type: 'Company' }],
      [
        { relatedEntity: 'Entity A', timestamp: '2024-01-01T00:00:00.000Z', title: 'Old' },
        { relatedEntity: 'Entity A', timestamp: '2024-01-02T00:00:00.000Z', title: 'New' }
      ]
    );

    const userPrompt = callSimpleAIText.mock.calls[0]?.[1] as string;
    expect(userPrompt.indexOf('New')).toBeLessThan(userPrompt.indexOf('Old'));
  });

  it('uses fallback entity type names when unknown', async () => {
    callSimpleAIText.mockResolvedValue({ success: true, data: 'summary' });

    const result = await summaryHandlers.generateEntitySummaries(
      [{ name: 'Entity A', type: 'Alien' }],
      [{ relatedEntity: 'Entity A', timestamp: '2024-01-01T00:00:00.000Z', title: 'Old' }]
    );

    expect(result).toEqual({ 'Entity A': 'summary' });
    expect(callSimpleAIText).toHaveBeenCalledWith(
      expect.stringContaining('Alien'),
      expect.any(String),
      expect.any(Object)
    );
  });

  it('handles entity summary errors', async () => {
    callSimpleAIText.mockRejectedValue(new Error('boom'));

    const result = await summaryHandlers.generateEntitySummaries(
      [{ name: 'Entity A', type: 'Company' }],
      [{ relatedEntity: 'Entity A', timestamp: '2024-01-01T00:00:00.000Z', title: 'Old' }]
    );

    expect(result).toEqual({});
  });

  it('skips entity summaries when no history or failures', async () => {
    const result = await summaryHandlers.generateEntitySummaries([], []);
    expect(result).toEqual({});

    callSimpleAIText.mockResolvedValue({ success: false, error: 'fail' });

    const resultWithFailure = await summaryHandlers.generateEntitySummaries(
      [{ name: 'Entity A', type: 'Company' }],
      [{ relatedEntity: 'Entity A', timestamp: '2024-01-01T00:00:00.000Z', title: 'Old' }]
    );

    expect(resultWithFailure).toEqual({});
  });

  it('skips entity summaries when AI returns empty data', async () => {
    callSimpleAIText.mockResolvedValue({ success: true, data: '   ' });

    const result = await summaryHandlers.generateEntitySummaries(
      [{ name: 'Entity A' }],
      [{ relatedEntity: 'Entity A', timestamp: '2024-01-01T00:00:00.000Z', title: 'Old' }]
    );

    expect(result).toEqual({});
  });

  it('uses fallback entity type when type is missing', async () => {
    callSimpleAIText.mockResolvedValue({ success: true, data: 'summary' });

    await summaryHandlers.generateEntitySummaries(
      [{ name: 'Entity A' }],
      [{ relatedEntity: 'Entity A', timestamp: '2024-01-01T00:00:00.000Z', title: 'Old' }]
    );

    expect(callSimpleAIText).toHaveBeenCalledWith(
      expect.stringContaining('其他实体'),
      expect.any(String),
      expect.any(Object)
    );
  });

  it('skips entity summaries when AI returns success without data', async () => {
    callSimpleAIText.mockResolvedValue({ success: true });

    const result = await summaryHandlers.generateEntitySummaries(
      [{ name: 'Entity A', type: 'Company' }],
      [{ relatedEntity: 'Entity A', timestamp: '2024-01-01T00:00:00.000Z', title: 'Old' }]
    );

    expect(result).toEqual({});
  });

  it('enriches news with historical context', async () => {
    neo4jNewsService.getNewsEntities.mockResolvedValue([{ name: 'Entity A', type: 'Company' }]);

    const result = await summaryHandlers.enrichNewsWithHistoricalContext(
      [
        {
          newsId: 'news_1',
          title: 'Title',
          content: 'Content',
          time: 1700000000,
          level: EventLevel.LEVEL_1
        }
      ],
      { 'Entity A': 'history' }
    );

    expect(result[EventLevel.LEVEL_1]).toContain('[历史：Entity A: history]');
  });

  it('handles task failures during enrichment', async () => {
    neo4jNewsService.getNewsEntities.mockResolvedValue([{ name: 'Entity A', type: 'Company' }]);

    const badSummaries = new Proxy(
      {},
      {
        get() {
          throw new Error('boom');
        }
      }
    );

    const result = await summaryHandlers.enrichNewsWithHistoricalContext(
      [
        {
          newsId: 'news_bad',
          title: 'Title',
          content: 'Content',
          time: 1700000000,
          level: EventLevel.LEVEL_1
        }
      ],
      badSummaries as any
    );

    expect(result[EventLevel.LEVEL_1]).toContain('【Level 1级新闻】');
  });

  it('handles enrichment when entity fetch fails', async () => {
    neo4jNewsService.getNewsEntities.mockRejectedValue(new Error('boom'));

    const result = await summaryHandlers.enrichNewsWithHistoricalContext(
      [
        {
          newsId: 'news_1',
          title: 'Title',
          content: 'Content',
          time: 1700000000,
          level: EventLevel.LEVEL_1
        }
      ],
      {}
    );

    expect(result[EventLevel.LEVEL_1]).toContain('标题：Title');
  });

  it('fetches historical news for entities', async () => {
    const start = new Date('2024-01-01T00:00:00.000Z');
    neo4jNewsService.getHistoricalNewsByEntities.mockResolvedValue([{ id: 'history' }]);

    const result = await summaryHandlers.getHistoricalNewsForEntities(
      [{ name: 'Entity A', type: 'Company' }],
      start
    );

    expect(result).toEqual([{ id: 'history' }]);
    expect(neo4jNewsService.getHistoricalNewsByEntities).toHaveBeenCalled();
  });

  it('generates level summaries with fallback on failures', async () => {
    aiService.callLLM
      .mockResolvedValueOnce({ success: true, data: 'Level 1 summary' })
      .mockResolvedValueOnce({ success: false, error: 'boom' });

    const result = await summaryHandlers.generateLevelSummaries({
      [EventLevel.LEVEL_1]: 'content 1',
      [EventLevel.LEVEL_2]: 'content 2'
    });

    expect(result).toContain('Level 1 summary');
    expect(result).toContain('Level 2级新闻总结生成失败');
  });

  it('returns fallback error when AI returns empty content', async () => {
    aiService.callLLM.mockResolvedValue({ success: false });

    const result = await summaryHandlers.generateLevelSummaries({
      [EventLevel.LEVEL_1]: 'content'
    });

    expect(result).toContain('AI生成的内容为空');
  });

  it('generates level summaries for unknown levels', async () => {
    aiService.callLLM.mockResolvedValue({ success: true, data: 'summary' });

    const result = await summaryHandlers.generateLevelSummaries({
      Unknown: 'content',
      [EventLevel.LEVEL_1]: 'content'
    });

    expect(result).toContain('Unknown级新闻总结');
  });

  it('calculates stats with entity coverage', async () => {
    neo4jNewsService.getNewsEntities
      .mockResolvedValueOnce([{ name: 'Entity A', type: 'Company' }])
      .mockResolvedValueOnce([{ name: 'Entity B', type: 'Location' }])
      .mockResolvedValueOnce([{ name: 'Entity A', type: 'Company' }])
      .mockResolvedValueOnce([{ name: 'Entity A', type: 'Company' }]);

    const stats = await summaryHandlers.calculateStats(
      {
        news_items: [
          { newsId: 'news_1' },
          { newsId: 'news_2' }
        ]
      },
      [{ name: 'Entity A', type: 'Company' }],
      [{ id: 'history' }],
      { 'Entity A': 'summary' }
    );

    expect(stats.total_entities_found).toBe(1);
    expect(stats.total_historical_news).toBe(1);
    expect(stats.news_with_entities).toBe(1);
    expect(stats.news_with_historical_context).toBe(2);
  });

  it('handles stats calculation failures', async () => {
    neo4jNewsService.getNewsEntities.mockRejectedValue(new Error('boom'));

    const stats = await summaryHandlers.calculateStats(
      { news_items: [{ newsId: 'news_1' }] },
      [],
      [],
      {}
    );

    expect(stats.news_with_entities).toBe(0);
    expect(stats.news_with_historical_context).toBe(0);
  });

  it('sends summary notifications when enabled', async () => {
    const start = new Date('2024-01-01T00:00:00.000Z');
    const end = new Date('2024-01-01T01:00:00.000Z');

    await summaryHandlers.notify(true, 'summary', start, end, {
      news_items: [{ level: EventLevel.LEVEL_1 }]
    });

    expect(notificationService.sendNormalSummaryNotification).toHaveBeenCalled();
  });

  it('skips notifications when disabled', async () => {
    const start = new Date('2024-01-01T00:00:00.000Z');
    const end = new Date('2024-01-01T01:00:00.000Z');

    await summaryHandlers.notify(false, 'summary', start, end, { news_items: [] });

    expect(notificationService.sendNormalSummaryNotification).not.toHaveBeenCalled();
  });

  it('handles notification errors', async () => {
    const start = new Date('2024-01-01T00:00:00.000Z');
    const end = new Date('2024-01-01T01:00:00.000Z');
    notificationService.sendNormalSummaryNotification.mockRejectedValue(new Error('boom'));

    await summaryHandlers.notify(true, 'summary', start, end, { news_items: [] });

    expect(notificationService.sendNormalSummaryNotification).toHaveBeenCalled();
  });

  it('handles notifications when news items are missing', async () => {
    const start = new Date('2024-01-01T00:00:00.000Z');
    const end = new Date('2024-01-01T01:00:00.000Z');

    await summaryHandlers.notify(true, 'summary', start, end, {});

    expect(notificationService.sendNormalSummaryNotification).toHaveBeenCalledWith(
      { summary: 'summary' },
      start.toISOString(),
      end.toISOString(),
      []
    );
  });

  it('returns empty result when no news', async () => {
    const restoreTime = freezeTime('2024-01-01T00:00:00.000Z');
    neo4jNewsService.getNewsInTimeRange.mockResolvedValue({ news_count: 0, news_items: [] });

    try {
      const result = await generateSummary(
        '2024-01-01T00:00:00.000Z',
        '2024-01-01T01:00:00.000Z'
      );

      expect(result.success).toBe(true);
      expect(result.data?.empty).toBe(true);
    } finally {
      restoreTime();
    }
  });

  it('returns error result for invalid time', async () => {
    const result = await generateSummary('bad-time', 'bad-time', false);

    expect(result.success).toBe(false);
    expect(result.error).toContain('无效的时间格式');
  });

  it('returns error result when start is after end', async () => {
    const result = await generateSummary(
      '2024-01-02T00:00:00.000Z',
      '2024-01-01T00:00:00.000Z',
      false
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('开始时间不能晚于结束时间');
  });

  it('returns success result when news exists', async () => {
    const restoreTime = freezeTime('2024-01-01T00:00:00.000Z');

    try {
      const fetchSpy = jest
        .spyOn(summaryHandlers, 'fetchNews')
        .mockResolvedValue({ news_count: 1, news_items: [{ newsId: 'news_1', level: EventLevel.LEVEL_1 }] });
      const extractSpy = jest.spyOn(summaryHandlers, 'extractEntitiesFromNews').mockResolvedValue([]);
      const historySpy = jest.spyOn(summaryHandlers, 'getHistoricalNewsForEntities').mockResolvedValue([]);
      const summariesSpy = jest.spyOn(summaryHandlers, 'generateEntitySummaries').mockResolvedValue({});
      const enrichSpy = jest.spyOn(summaryHandlers, 'enrichNewsWithHistoricalContext').mockResolvedValue({
        [EventLevel.LEVEL_1]: 'content'
      });
      const levelSpy = jest.spyOn(summaryHandlers, 'generateLevelSummaries').mockResolvedValue('summary');
      const statsSpy = jest.spyOn(summaryHandlers, 'calculateStats').mockResolvedValue({ total: 1 });
      const notifySpy = jest.spyOn(summaryHandlers, 'notify').mockResolvedValue(undefined);

      const result = await generateSummary(
        '2024-01-01T00:00:00.000Z',
        '2024-01-01T01:00:00.000Z',
        true
      );

      expect(result.success).toBe(true);
      expect(result.data?.summary).toBe('summary');
      expect(notifySpy).toHaveBeenCalled();

      fetchSpy.mockRestore();
      extractSpy.mockRestore();
      historySpy.mockRestore();
      summariesSpy.mockRestore();
      enrichSpy.mockRestore();
      levelSpy.mockRestore();
      statsSpy.mockRestore();
      notifySpy.mockRestore();
    } finally {
      restoreTime();
    }
  });

  it('returns success when news items are missing', async () => {
    const restoreTime = freezeTime('2024-01-01T00:00:00.000Z');

    try {
      const fetchSpy = jest.spyOn(summaryHandlers, 'fetchNews').mockResolvedValue({ news_count: 1 } as any);
      const extractSpy = jest.spyOn(summaryHandlers, 'extractEntitiesFromNews').mockResolvedValue([]);
      const historySpy = jest.spyOn(summaryHandlers, 'getHistoricalNewsForEntities').mockResolvedValue([]);
      const summariesSpy = jest.spyOn(summaryHandlers, 'generateEntitySummaries').mockResolvedValue({});
      const enrichSpy = jest.spyOn(summaryHandlers, 'enrichNewsWithHistoricalContext').mockResolvedValue({});
      const levelSpy = jest.spyOn(summaryHandlers, 'generateLevelSummaries').mockResolvedValue('summary');
      const statsSpy = jest.spyOn(summaryHandlers, 'calculateStats').mockResolvedValue({ total: 0 });
      const notifySpy = jest.spyOn(summaryHandlers, 'notify').mockResolvedValue(undefined);

      const result = await generateSummary(
        '2024-01-01T00:00:00.000Z',
        '2024-01-01T01:00:00.000Z',
        false
      );

      expect(result.success).toBe(true);
      expect(result.data?.high_level_count).toBe(0);

      fetchSpy.mockRestore();
      extractSpy.mockRestore();
      historySpy.mockRestore();
      summariesSpy.mockRestore();
      enrichSpy.mockRestore();
      levelSpy.mockRestore();
      statsSpy.mockRestore();
      notifySpy.mockRestore();
    } finally {
      restoreTime();
    }
  });
});
