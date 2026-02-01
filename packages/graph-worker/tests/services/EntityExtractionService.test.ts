import fs from 'fs';
import path from 'path';
import {
  DEFAULT_EVENT_LEVEL,
  DEFAULT_EVENT_TYPE,
  DEFAULT_RELATIONSHIP_TYPE,
  DEFAULT_ORGANIZATION_TYPE,
  DEFAULT_LOCATION_TYPE,
  DEFAULT_SENTIMENT,
  EventLevel,
  EVENT_LEVELS
} from '../../src/constants/enums';
import { createTempDir } from '../helpers/tmp-dir';
import { setEnv } from '../helpers/env';

const aiService = {
  callLLMWithJsonResponse: jest.fn(),
  getProviderInfo: jest.fn()
};

const notificationService = {
  sendEntityExtractionFailureNotification: jest.fn().mockResolvedValue(undefined)
};

jest.mock('../../src/services/AiService', () => ({
  __esModule: true,
  default: aiService
}));

jest.mock('../../src/services/NotificationService', () => ({
  __esModule: true,
  default: notificationService
}));

const createNewsItem = (id = 'news_1') => ({
  id,
  title: 'Title',
  content: 'Content',
  source: 'futu_live',
  timestamp: '2024-01-01T00:00:00.000Z',
  raw_time: 1704067200,
  url: 'https://example.com'
});

const createExtractionData = () => ({
  events: [
    {
      event_name: 'Event A',
      event_description: 'Desc',
      event_type: DEFAULT_EVENT_TYPE,
      significance: 2,
      sentiment: DEFAULT_SENTIMENT,
      magnitude: 0.1,
      event_level: DEFAULT_EVENT_LEVEL,
      timestamp: '2024-01-01T00:00:00.000Z'
    }
  ],
  companies: [
    {
      company_name: 'Company A',
      ticker: '',
      industry: '',
      market: '',
      country: '',
      aliases: []
    }
  ],
  persons: [
    {
      person_name: 'Person A',
      title: '',
      company: '',
      nationality: ''
    }
  ],
  organizations: [
    {
      organization_name: 'Org A',
      type: DEFAULT_ORGANIZATION_TYPE,
      country: ''
    }
  ],
  locations: [
    {
      location_name: 'Location A',
      type: DEFAULT_LOCATION_TYPE,
      country: '',
      region: ''
    }
  ],
  relationships: [
    {
      type: DEFAULT_RELATIONSHIP_TYPE,
      from: 'Company A',
      to: 'Location A',
      description: '',
      confidence: 0.8
    }
  ]
});

const createExtractionResult = (newsId: string) => ({
  newsId,
  title: 'Title',
  content: 'Content',
  timestamp: '2024-01-01T00:00:00.000Z',
  raw_time: 1704067200,
  source: 'futu_live',
  url: 'https://example.com',
  news_level: DEFAULT_EVENT_LEVEL,
  confidence: 0.8,
  events: [],
  companies: [],
  persons: [],
  organizations: [],
  locations: [],
  relationships: []
});

const setupService = async () => {
  const temp = await createTempDir('drudge-extract-');
  const failedDir = path.join(temp.path, 'failed');

  const restoreEnv = setEnv({
    FAILED_NEWS_DIRECTORY: failedDir
  });

  jest.resetModules();
  const config = (await import('../../src/config/config')).default;
  const { EntityExtractionService } = await import('../../src/services/EntityExtractionService');

  return {
    service: new EntityExtractionService() as any,
    config,
    failedDir,
    cleanup: temp.cleanup,
    restoreEnv
  };
};

const withService = async (
  fn: (ctx: Awaited<ReturnType<typeof setupService>>) => Promise<void>
) => {
  const ctx = await setupService();
  try {
    await fn(ctx);
  } finally {
    ctx.restoreEnv();
    await ctx.cleanup();
  }
};

describe('EntityExtractionService', () => {
  beforeEach(() => {
    aiService.callLLMWithJsonResponse.mockReset();
    aiService.getProviderInfo.mockReset();
    aiService.getProviderInfo.mockReturnValue({ current: 'deepseek', fallback: '', hasFallback: false });
    notificationService.sendEntityExtractionFailureNotification.mockClear();
  });

  it('parseExtractionResult applies defaults and filters invalid entries', async () => {
    await withService(async ({ service }) => {
      const newsItem = createNewsItem();

      const extractionData = {
        events: [
          {
            event_name: 'Event A'
          }
        ],
        companies: [
          {
            company_name: 'Company A',
            aliases: ['Alias A']
          },
          null
        ],
        persons: [
          {
            person_name: 'Person A'
          }
        ],
        organizations: [
          {
            organization_name: 'Org A'
          }
        ],
        locations: [
          {
            location_name: 'Location A'
          }
        ],
        relationships: [
          {
            from: 'A',
            to: 'B'
          }
        ]
      };

      const result = service.parseExtractionResult(extractionData, newsItem);

      expect(result.newsId).toBe('news_1');
      expect(result.events[0]).toMatchObject({
        event_name: 'Event A',
        event_type: DEFAULT_EVENT_TYPE,
        event_level: DEFAULT_EVENT_LEVEL,
        sentiment: DEFAULT_SENTIMENT
      });
      expect(result.companies[0]).toMatchObject({
        company_name: 'Company A',
        aliases: ['Alias A']
      });
      expect(result.persons[0]).toMatchObject({
        person_name: 'Person A'
      });
      expect(result.organizations[0]).toMatchObject({
        organization_name: 'Org A',
        type: DEFAULT_ORGANIZATION_TYPE
      });
      expect(result.locations[0]).toMatchObject({
        location_name: 'Location A',
        type: DEFAULT_LOCATION_TYPE
      });
      expect(result.relationships[0]).toMatchObject({
        type: DEFAULT_RELATIONSHIP_TYPE,
        from: 'A',
        to: 'B'
      });
    });
  });

  it('parseExtractionResult falls back for aliases and empty entities', async () => {
    await withService(async ({ service }) => {
      const newsItem = createNewsItem();

      const withBadAliases = service.parseExtractionResult(
        {
          companies: [{ company_name: 'Company A', aliases: 'bad' }],
          events: [],
          persons: [],
          organizations: [],
          locations: [],
          relationships: []
        },
        newsItem
      );

      expect(withBadAliases.companies[0]?.aliases).toEqual([]);

      const emptyEntities = service.parseExtractionResult(
        {
          events: [],
          companies: [],
          organizations: [],
          locations: [],
          relationships: []
        } as any,
        newsItem
      );

      expect(emptyEntities.confidence).toBe(0.3);
      expect(emptyEntities.persons?.length).toBe(0);
    });
  });

  it('builds system prompt with required guidance', async () => {
    await withService(async ({ service }) => {
      const prompt = service.getSystemPrompt();
      expect(prompt).toContain('只输出 JSON');
      expect(prompt).toContain('event_level');
    });
  });

  it('determines news level from events and entity counts', async () => {
    await withService(async ({ service }) => {
      const newsItem = createNewsItem();

      const level = service.determineNewsLevelWithConflictHandling(newsItem, {
        events: [{ event_level: EventLevel.LEVEL_2 }, { event_level: EventLevel.LEVEL_4 }],
        companies: [],
        persons: [],
        organizations: [],
        locations: [],
        relationships: []
      });

      expect(level).toBe(EventLevel.LEVEL_2);

      const levelFromEvents = service.determineNewsLevel(newsItem, {
        events: [{ event_level: EventLevel.LEVEL_1 }],
        companies: [],
        persons: [],
        organizations: [],
        locations: [],
        relationships: []
      });

      expect(levelFromEvents).toBe(EventLevel.LEVEL_1);

      const levelFromCounts = service.determineNewsLevel(newsItem, {
        events: [],
        companies: [{ company_name: 'a' }, { company_name: 'b' }, { company_name: 'c' }, { company_name: 'd' }, { company_name: 'e' }],
        persons: [],
        organizations: [],
        locations: [],
        relationships: []
      });

      expect(levelFromCounts).toBe(EventLevel.LEVEL_3);

      const levelFromSmallCounts = service.determineNewsLevel(newsItem, {
        events: [],
        companies: [{ company_name: 'a' }, { company_name: 'b' }, { company_name: 'c' }],
        persons: [],
        organizations: [],
        locations: [],
        relationships: []
      });

      expect(levelFromSmallCounts).toBe(EventLevel.LEVEL_4);

      const levelFallback = service.determineNewsLevel(newsItem, {
        events: [],
        companies: [],
        persons: [],
        organizations: [],
        locations: [],
        relationships: []
      });

      expect(levelFallback).toBe(EventLevel.LEVEL_5);
    });
  });

  it('throws when AI returns empty result and notification fails', async () => {
    await withService(async ({ service }) => {
      const newsItem = createNewsItem('news_empty');
      (service as any).callAIExtraction = jest.fn().mockResolvedValue(null);
      notificationService.sendEntityExtractionFailureNotification.mockRejectedValueOnce(
        new Error('notify failed')
      );

      await expect(service.extractFromNews(newsItem)).rejects.toThrow('AI提取返回空结果');
      expect(notificationService.sendEntityExtractionFailureNotification).toHaveBeenCalled();
    });
  });

  it('callAIExtraction throws when response indicates failure', async () => {
    await withService(async ({ service }) => {
      (service as any).maxRetries = 1;
      aiService.callLLMWithJsonResponse.mockResolvedValueOnce({
        success: false,
        error: 'nope'
      });

      await expect((service as any).callAIExtraction(createNewsItem())).rejects.toThrow('nope');
    });
  });

  it('callAIExtraction returns validated data on success', async () => {
    await withService(async ({ service }) => {
      (service as any).maxRetries = 1;
      aiService.callLLMWithJsonResponse.mockResolvedValueOnce({
        success: true,
        data: createExtractionData()
      });

      const result = await (service as any).callAIExtraction(createNewsItem());

      expect(result.events[0].event_name).toBe('Event A');
    });
  });

  it('callAIExtraction logs provider info when fallback available', async () => {
    await withService(async ({ service }) => {
      (service as any).maxRetries = 1;
      aiService.getProviderInfo.mockReturnValue({
        current: 'deepseek',
        fallback: 'google',
        hasFallback: true
      });
      aiService.callLLMWithJsonResponse.mockResolvedValueOnce({
        success: true,
        data: createExtractionData()
      });

      const result = await (service as any).callAIExtraction(createNewsItem());
      expect(result.events).toHaveLength(1);
    });
  });

  it('callAIExtraction throws default error when response lacks error message', async () => {
    await withService(async ({ service }) => {
      (service as any).maxRetries = 1;
      aiService.callLLMWithJsonResponse.mockResolvedValueOnce({
        success: false,
        error: ''
      });

      await expect((service as any).callAIExtraction(createNewsItem())).rejects.toThrow('AI提取失败');
    });
  });

  it('callAIExtraction attempts to recover from error text but fails schema', async () => {
    await withService(async ({ service }) => {
      (service as any).maxRetries = 1;
      aiService.callLLMWithJsonResponse.mockRejectedValueOnce({
        text: '{"events":[{"event_name":""}]}'
      });

      await expect((service as any).callAIExtraction(createNewsItem())).rejects.toBeTruthy();
    });
  });

  it('callAIExtraction recovers from response.text when error.text missing', async () => {
    await withService(async ({ service }) => {
      (service as any).maxRetries = 1;
      aiService.callLLMWithJsonResponse.mockRejectedValueOnce({
        response: { text: JSON.stringify(createExtractionData()) }
      });

      const result = await (service as any).callAIExtraction(createNewsItem());
      expect(result.companies).toHaveLength(1);
    });
  });

  it('callAIExtraction logs extraction failures and waits before retry', async () => {
    await withService(async ({ service }) => {
      jest.useFakeTimers();
      (service as any).maxRetries = 2;
      aiService.callLLMWithJsonResponse.mockRejectedValue({
        text: 'no json here'
      });

      const promise = (service as any).callAIExtraction(createNewsItem());
      const rejection = expect(promise).rejects.toBeTruthy();
      await jest.advanceTimersByTimeAsync(1000);
      await rejection;
      jest.useRealTimers();
    });
  });

  it('callAIExtraction handles extraction parsing errors', async () => {
    await withService(async ({ service }) => {
      (service as any).maxRetries = 1;
      aiService.callLLMWithJsonResponse.mockRejectedValueOnce({
        text: 'bad'
      });
      (service as any).extractJsonFromString = jest.fn(() => {
        throw new Error('extract fail');
      });

      await expect((service as any).callAIExtraction(createNewsItem())).rejects.toBeTruthy();
    });
  });

  it('callAIExtraction throws default error when retries are disabled', async () => {
    await withService(async ({ service }) => {
      (service as any).maxRetries = 0;

      await expect((service as any).callAIExtraction(createNewsItem())).rejects.toThrow(
        'AI提取失败：所有重试都失败'
      );
      expect(aiService.callLLMWithJsonResponse).not.toHaveBeenCalled();
    });
  });

  it('validateAndParsing handles valid data and bad strings', async () => {
    await withService(async ({ service }) => {
      const valid = createExtractionData();
      const parsed = (service as any).validateAndParsing(valid, 1);
      expect(parsed.events[0].event_name).toBe('Event A');

      expect(() => (service as any).validateAndParsing('{bad json', 1)).toThrow('数据解析失败');
    });
  });

  it('validateAndParsing parses JSON strings', async () => {
    await withService(async ({ service }) => {
      const json = JSON.stringify(createExtractionData());
      const parsed = (service as any).validateAndParsing(json, 1);
      expect(parsed.events[0].event_name).toBe('Event A');
    });
  });

  it('fixCommonSchemaIssues returns non-object input and handles bad stringified objects', async () => {
    await withService(async ({ service }) => {
      expect((service as any).fixCommonSchemaIssues('text')).toBe('text');

      const fixed = (service as any).fixCommonSchemaIssues({
        events: ['{bad json']
      });
      expect(fixed.events).toEqual([]);
    });
  });

  it('extractJsonFromString handles embedded json and parse failures', async () => {
    await withService(async ({ service }) => {
      const embedded = (service as any).extractJsonFromString('prefix {"ok":1} suffix');
      expect(embedded).toEqual({ ok: 1 });

      const codeBlock = (service as any).extractJsonFromString(
        '```json\\nnot json\\n```\\n{"ok":2}'
      );
      expect(codeBlock).toEqual({ ok: 2 });

      const missing = (service as any).extractJsonFromString('no json here');
      expect(missing).toBeNull();

      const bad = (service as any).extractJsonFromString('{"bad":');
      expect(bad).toBeNull();
    });
  });

  it('parseExtractionResult handles empty input and errors', async () => {
    await withService(async ({ service }) => {
      const newsItem = createNewsItem();
      const empty = service.parseExtractionResult(null, newsItem);
      expect(empty.newsId).toBe(newsItem.id);
      expect(empty.events).toEqual([]);

      const badEvent: any = {};
      Object.defineProperty(badEvent, 'event_name', {
        get() {
          throw new Error('boom');
        }
      });

      const result = service.parseExtractionResult({ events: [badEvent] }, newsItem);
      expect(result.newsId).toBe(newsItem.id);
      expect(result.events).toEqual([]);
    });
  });

  it('determineNewsLevel falls back when events lack level', async () => {
    await withService(async ({ service }) => {
      const result = createExtractionResult('news_1') as any;
      result.companies = [
        { company_name: 'A' } as any,
        { company_name: 'B' } as any,
        { company_name: 'C' } as any
      ];

      const level = (service as any).determineNewsLevelWithConflictHandling(createNewsItem(), result);
      expect(level).toBe(EventLevel.LEVEL_4);
    });
  });

  it('determineNewsLevel returns highest event level', async () => {
    await withService(async ({ service }) => {
      const result = createExtractionResult('news_2') as any;
      result.events = [
        { event_level: EventLevel.LEVEL_2 } as any,
        { event_level: EventLevel.LEVEL_3 } as any
      ];

      const level = (service as any).determineNewsLevel(createNewsItem(), result);
      expect(level).toBe(EventLevel.LEVEL_2);
    });
  });

  it('determineNewsLevel handles level 3 and 4 events', async () => {
    await withService(async ({ service }) => {
      const result = createExtractionResult('news_3') as any;
      result.events = [{ event_level: EventLevel.LEVEL_3 } as any];

      const level3 = (service as any).determineNewsLevel(createNewsItem(), result);
      expect(level3).toBe(EventLevel.LEVEL_3);

      result.events = [{ event_level: EventLevel.LEVEL_4 } as any];
      const level4 = (service as any).determineNewsLevel(createNewsItem(), result);
      expect(level4).toBe(EventLevel.LEVEL_4);
    });
  });

  it('determineNewsLevelWithConflictHandling returns explicit event levels', async () => {
    await withService(async ({ service }) => {
      const newsItem = createNewsItem('news_levels');
      const base = {
        companies: [],
        persons: [],
        organizations: [],
        locations: [],
        relationships: []
      } as any;

      const level1 = service.determineNewsLevelWithConflictHandling(newsItem, {
        ...base,
        events: [{ event_level: EventLevel.LEVEL_1 }]
      });
      expect(level1).toBe(EventLevel.LEVEL_1);

      const level3 = service.determineNewsLevelWithConflictHandling(newsItem, {
        ...base,
        events: [{ event_level: EventLevel.LEVEL_3 }]
      });
      expect(level3).toBe(EventLevel.LEVEL_3);

      const level4 = service.determineNewsLevelWithConflictHandling(newsItem, {
        ...base,
        events: [{ event_level: EventLevel.LEVEL_4 }]
      });
      expect(level4).toBe(EventLevel.LEVEL_4);
    });
  });

  it('delay resolves after timeout', async () => {
    await withService(async ({ service }) => {
      jest.useFakeTimers();
      const promise = (service as any).delay(5);
      await jest.advanceTimersByTimeAsync(5);
      await expect(promise).resolves.toBeUndefined();
      jest.useRealTimers();
    });
  });

  it('saveFailedNews logs when write fails', async () => {
    await withService(async ({ service, failedDir }) => {
      const newsItem = createNewsItem('news_fail');
      (service as any).failedNewsDir = failedDir;
      const writeSpy = jest
        .spyOn(fs.promises, 'writeFile')
        .mockRejectedValueOnce(new Error('disk full'));

      await (service as any).saveFailedNews(newsItem, new Error('boom'));

      expect(writeSpy).toHaveBeenCalled();
      writeSpy.mockRestore();
    });
  });

  it('saveFailedNews uses fallback error message and stack', async () => {
    await withService(async ({ service, failedDir }) => {
      const newsItem = createNewsItem('news_fallback');
      (service as any).failedNewsDir = failedDir;

      await (service as any).saveFailedNews(newsItem, {});

      const files = await fs.promises.readdir(failedDir);
      expect(files.length).toBeGreaterThan(0);

      const content = await fs.promises.readFile(path.join(failedDir, files[0]!), 'utf8');
      const parsed = JSON.parse(content);

      expect(parsed.error.message).toBe('Unknown error');
      expect(parsed.error.stack).toBe('');
    });
  });

  it('fixes common schema issues and stringified objects', async () => {
    await withService(async ({ service }) => {
      const raw = {
        events: [
          JSON.stringify({
            event_name: 'Event A',
            event_description: 'desc',
            event_type: 'bad',
            significance: 10,
            sentiment: 'bad',
            magnitude: 2,
            event_level: 'bad'
          })
        ],
        companies: [
          { company_name: 'Company A' },
          null
        ],
        persons: [
          { person_name: 'Person A' }
        ],
        organizations: [
          { organization_name: 'Org A', type: 'bad' }
        ],
        locations: [
          { location_name: 'Location A', type: 'bad', coordinates: {} }
        ],
        relationships: [
          { from: 'A', to: 'B', type: 'bad' }
        ]
      };

      const fixed = service.fixCommonSchemaIssues(raw);

      expect(fixed.events[0]).toMatchObject({
        event_name: 'Event A',
        event_type: DEFAULT_EVENT_TYPE,
        sentiment: DEFAULT_SENTIMENT,
        event_level: DEFAULT_EVENT_LEVEL,
        significance: 2,
        magnitude: 0
      });
      expect(fixed.companies[0].aliases).toEqual([]);
      expect(fixed.organizations[0].type).toBe(DEFAULT_ORGANIZATION_TYPE);
      expect(fixed.locations[0].type).toBe(DEFAULT_LOCATION_TYPE);
      expect(fixed.locations[0].coordinates).toBeUndefined();
      expect(fixed.relationships[0].type).toBe(DEFAULT_RELATIONSHIP_TYPE);
    });
  });

  it('fixCommonSchemaIssues drops coordinates with invalid latitude/longitude', async () => {
    await withService(async ({ service }) => {
      const raw = {
        locations: [
          { location_name: 'Loc A', coordinates: { latitude: '1', longitude: 2 } },
          { location_name: 'Loc B', coordinates: { latitude: 1, longitude: '2' } }
        ]
      };

      const fixed = service.fixCommonSchemaIssues(raw);

      expect(fixed.locations[0].coordinates).toBeUndefined();
      expect(fixed.locations[1].coordinates).toBeUndefined();
    });
  });

  it('validates and repairs invalid responses', async () => {
    await withService(async ({ service }) => {
      const invalidData = {
        events: [
          {
            event_name: 'Event A',
            event_description: 'desc',
            event_type: 'bad',
            significance: 10,
            sentiment: 'bad',
            magnitude: 2,
            event_level: 'bad',
            timestamp: ''
          }
        ],
        companies: [
          { company_name: 'Company A', aliases: 'bad' }
        ],
        persons: [
          { person_name: 'Person A' }
        ],
        organizations: [
          { organization_name: 'Org A', type: 'bad' }
        ],
        locations: [
          { location_name: 'Location A', type: 'bad', coordinates: {} }
        ],
        relationships: [
          { type: 'bad', from: 'A', to: 'B' }
        ]
      };

      const parsed = service.validateAndParsing(invalidData, 1);

      expect(parsed.events[0]).toMatchObject({
        event_type: DEFAULT_EVENT_TYPE,
        sentiment: DEFAULT_SENTIMENT,
        event_level: DEFAULT_EVENT_LEVEL,
        significance: 2,
        magnitude: 0
      });
      expect(parsed.companies[0].aliases).toEqual([]);
      expect(parsed.organizations[0].type).toBe(DEFAULT_ORGANIZATION_TYPE);
      expect(parsed.locations[0].type).toBe(DEFAULT_LOCATION_TYPE);
      expect(parsed.relationships[0].type).toBe(DEFAULT_RELATIONSHIP_TYPE);
    });
  });

  it('extracts JSON from code blocks and fixes trailing commas', async () => {
    await withService(async ({ service }) => {
      const text = "```json\n{\"events\":[],\"companies\":[],\"persons\":[],\"organizations\":[],\"locations\":[],\"relationships\":[],}\n```";
      const extracted = service.extractJsonFromString(text);

      expect(extracted).toBeTruthy();
      expect(extracted.events).toEqual([]);

      const missing = service.extractJsonFromString('no json here');
      expect(missing).toBeNull();
    });
  });

  it('extractJsonFromString handles non-Error parse failures', async () => {
    await withService(async ({ service }) => {
      const parseSpy = jest.spyOn(JSON, 'parse').mockImplementation(() => {
        throw 'boom';
      });

      const result = service.extractJsonFromString('{"ok":1}');
      expect(result).toBeNull();

      parseSpy.mockRestore();
    });
  });

  it('processes news chunks and skips failures', async () => {
    await withService(async ({ service }) => {
      const extractSpy = jest
        .spyOn(service, 'extractFromNews')
        .mockImplementation(async (newsItem: any) => {
          if (newsItem.id === 'news_3') {
            throw new Error('boom');
          }
          return createExtractionResult(newsItem.id);
        });

      const delaySpy = jest.spyOn(service, 'delay').mockResolvedValue(undefined);

      const results = await service.processNewsChunk(
        [createNewsItem('news_1'), createNewsItem('news_2'), createNewsItem('news_3')],
        2
      );

      expect(results).toHaveLength(2);
      expect(delaySpy).toHaveBeenCalledWith(2000);
      expect(extractSpy).toHaveBeenCalledTimes(3);
    });
  });

  it('batchExtractEntities respects chunking and triggers gc', async () => {
    await withService(async ({ service, config }) => {
      const originalMemory = { ...config.processing.memory };
      config.processing.memory.extractionChunkSize = 2;
      config.processing.memory.aiBatchSize = 1;
      config.processing.memory.chunkDelayMs = 5;
      config.processing.memory.dangerThreshold = 0.1;
      config.processing.memory.maxHeapSizeMB = 1;
      config.processing.memory.enableAutoGC = true;

      const memorySpy = jest
        .spyOn(process, 'memoryUsage')
        .mockReturnValue({
          heapUsed: 2 * 1024 * 1024,
          heapTotal: 3 * 1024 * 1024,
          external: 0,
          rss: 0,
          arrayBuffers: 0
        });

      const gcOriginal = global.gc;
      global.gc = jest.fn();

      const delaySpy = jest.spyOn(service, 'delay').mockResolvedValue(undefined);
      const chunkSpy = jest
        .spyOn(service, 'processNewsChunk')
        .mockResolvedValue([createExtractionResult('news_1')]);

      const results = await service.batchExtractEntities([
        createNewsItem('news_1'),
        createNewsItem('news_2'),
        createNewsItem('news_3')
      ]);

      expect(results).toHaveLength(2);
      expect(chunkSpy).toHaveBeenCalledTimes(2);
      expect(delaySpy).toHaveBeenCalledWith(5);
      expect(global.gc).toHaveBeenCalled();

      global.gc = gcOriginal;
      memorySpy.mockRestore();
      Object.assign(config.processing.memory, originalMemory);
    });
  });

  it('callAIExtraction recovers from error payloads', async () => {
    await withService(async ({ service }) => {
      const payload = createExtractionData();
      const error: any = new Error('bad');
      error.text = `\n\n\`\`\`json\n${JSON.stringify(payload)}\n\`\`\``;

      aiService.getProviderInfo.mockReturnValue({
        current: 'deepseek',
        fallback: '',
        hasFallback: false
      });
      aiService.callLLMWithJsonResponse.mockRejectedValueOnce(error);

      const result = await service.callAIExtraction(createNewsItem());
      expect(result.events).toHaveLength(1);
      expect(aiService.callLLMWithJsonResponse).toHaveBeenCalled();
    });
  });

  it('extractFromNews returns parsed result and sets processing time', async () => {
    await withService(async ({ service }) => {
      const extraction = createExtractionData();

      const callSpy = jest
        .spyOn(service, 'callAIExtraction')
        .mockResolvedValue(extraction);

      const result = await service.extractFromNews(createNewsItem());

      expect(callSpy).toHaveBeenCalled();
      expect(result.news_level).toBe(EVENT_LEVELS.LEVEL_5);
      expect(result.processing_time).toEqual(expect.any(Number));
      expect(result.events).toHaveLength(1);
    });
  });

  it('extractFromNews handles empty persons list', async () => {
    await withService(async ({ service }) => {
      const extraction = { ...createExtractionData(), persons: [] };

      jest.spyOn(service, 'callAIExtraction').mockResolvedValue(extraction);

      const result = await service.extractFromNews(createNewsItem('news_no_persons'));

      expect(result.persons).toEqual([]);
    });
  });

  it('extractFromNews uses fallback error message when error has no message', async () => {
    await withService(async ({ service, failedDir }) => {
      const error: any = { message: '' };

      jest.spyOn(service, 'callAIExtraction').mockRejectedValue(error);
      aiService.getProviderInfo.mockReturnValue({
        current: 'deepseek',
        fallback: '',
        hasFallback: false
      });

      await expect(service.extractFromNews(createNewsItem('news_no_message'))).rejects.toBe(error);

      const [, detail] = notificationService.sendEntityExtractionFailureNotification.mock.calls[0]!;
      expect(detail).toContain('实体提取失败');

      const files = await fs.promises.readdir(failedDir);
      expect(files.length).toBeGreaterThan(0);
    });
  });

  it('extractFromNews stores failed news and notifies on error', async () => {
    await withService(async ({ service, failedDir }) => {
      const error = new Error('boom');

      jest.spyOn(service, 'callAIExtraction').mockRejectedValue(error);

      aiService.getProviderInfo.mockReturnValue({
        current: 'deepseek',
        fallback: 'google',
        hasFallback: true
      });

      await expect(service.extractFromNews(createNewsItem('news_fail'))).rejects.toThrow('boom');

      const files = await fs.promises.readdir(failedDir);
      expect(files.some((file) => file.includes('failed_news_fail_'))).toBe(true);
      expect(notificationService.sendEntityExtractionFailureNotification).toHaveBeenCalled();
    });
  });
});
