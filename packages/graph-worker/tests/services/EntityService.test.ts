import {
  EVENT_LEVELS,
  EVENT_TYPES,
  SENTIMENTS,
  ORGANIZATION_TYPES,
  LOCATION_TYPES
} from '../../src/constants/enums';

const neo4jService = {
  initialize: jest.fn().mockResolvedValue(undefined),
  executeQuery: jest.fn().mockResolvedValue({ records: [] }),
  batchMergeEntities: jest.fn().mockResolvedValue(undefined),
  batchMergeRelationships: jest.fn().mockResolvedValue(undefined),
  close: jest.fn().mockResolvedValue(undefined)
};

jest.mock('../../src/services/Neo4jService', () => ({
  __esModule: true,
  default: neo4jService
}));

describe('EntityService', () => {
  beforeEach(() => {
    neo4jService.initialize.mockReset();
    neo4jService.executeQuery.mockReset();
    neo4jService.batchMergeEntities.mockReset();
    neo4jService.batchMergeRelationships.mockReset();
    neo4jService.close.mockClear();
  });

  it('initializes the service', async () => {
    jest.resetModules();
    const { EntityService } = await import('../../src/services/EntityService');
    const service = new EntityService();

    await service.initialize();

    expect(neo4jService.initialize).toHaveBeenCalled();
  });

  it('createNews writes news_level and processedAt with resolved numeric level', async () => {
    jest.resetModules();
    const { EntityService } = await import('../../src/services/EntityService');
    const service = new EntityService();

    await service.createNews(
      {
        id: 'news_1',
        title: 'Title',
        content: 'Content',
        source: 'futu_live',
        url: 'https://example.com',
        timestamp: '2024-01-01T00:00:00.000Z',
        level: 4,
        raw_time: 123
      } as any,
      EVENT_LEVELS.LEVEL_1
    );

    const [query, params] = neo4jService.executeQuery.mock.calls[0] as [string, any];
    expect(query).toContain('n.processedAt = timestamp()');
    expect(params.newsLevel).toBe(EVENT_LEVELS.LEVEL_1);
    expect(params.level).toBe(1);
    expect(params.rawTime).toBe(123);
  });

  it('createNews falls back to numeric level when news_level missing', async () => {
    jest.resetModules();
    const { EntityService } = await import('../../src/services/EntityService');
    const service = new EntityService();

    await service.createNews(
      {
        id: 'news_2',
        title: 'Title',
        content: 'Content',
        source: 'futu_live',
        url: 'https://example.com',
        timestamp: '2024-01-01T00:00:00.000Z',
        level: 3
      } as any
    );

    const [, params] = neo4jService.executeQuery.mock.calls[0] as [string, any];
    expect(params.newsLevel).toBe(EVENT_LEVELS.LEVEL_5);
    expect(params.level).toBe(5);
  });

  it('createNews uses fallback level when news_level is invalid', async () => {
    jest.resetModules();
    const { EntityService } = await import('../../src/services/EntityService');
    const service = new EntityService();

    await service.createNews(
      {
        id: 'news_2b',
        title: 'Title',
        content: 'Content',
        timestamp: '2024-01-01T00:00:00.000Z',
        level: 2
      } as any,
      'n/a'
    );

    const [, params] = neo4jService.executeQuery.mock.calls[0] as [string, any];
    expect(params.level).toBe(2);
  });

  it('createNews falls back to zero when level is missing and news_level invalid', async () => {
    jest.resetModules();
    const { EntityService } = await import('../../src/services/EntityService');
    const service = new EntityService();

    await service.createNews(
      {
        id: 'news_3',
        title: 'Title',
        content: 'Content',
        source: 'futu_live',
        url: 'https://example.com',
        timestamp: '2024-01-01T00:00:00.000Z'
      } as any,
      'nonsense'
    );

    const [, params] = neo4jService.executeQuery.mock.calls[0] as [string, any];
    expect(params.level).toBe(0);
  });

  it('resolveLevelNumber returns numeric fallback when provided', async () => {
    jest.resetModules();
    const { EntityService } = await import('../../src/services/EntityService');
    const service = new EntityService() as any;

    const resolved = service.resolveLevelNumber('n/a', 4);
    expect(resolved).toBe(4);
  });

  it('createNews defaults source and url when missing', async () => {
    jest.resetModules();
    const { EntityService } = await import('../../src/services/EntityService');
    const service = new EntityService();

    await service.createNews(
      {
        id: 'news_src',
        title: 'Title',
        content: 'Content',
        timestamp: '2024-01-01T00:00:00.000Z'
      } as any,
      EVENT_LEVELS.LEVEL_2
    );

    const [, params] = neo4jService.executeQuery.mock.calls[0] as [string, any];
    expect(params.source).toBe('');
    expect(params.url).toBe('');
  });

  it('creates event nodes with defaults', async () => {
    jest.resetModules();
    const { EntityService } = await import('../../src/services/EntityService');
    const service = new EntityService();

    await service.createEvent(
      {
        event_id: 'event_1',
        event_name: 'Event',
        event_description: '',
        significance: undefined,
        sentiment: undefined,
        magnitude: undefined,
        event_level: undefined
      } as any,
      'news_1'
    );

    const [, params] = neo4jService.executeQuery.mock.calls[0] as [string, any];
    expect(params.eventType).toBe(EVENT_TYPES.OTHER);
    expect(params.sentiment).toBe(SENTIMENTS.NEUTRAL);
    expect(params.eventLevel).toBe(EVENT_LEVELS.LEVEL_5);
    expect(params.significance).toBe(1);
    expect(params.magnitude).toBe(0);
    expect(params.newsId).toBe('news_1');
  });

  it('creates company, person, organization, and location nodes', async () => {
    jest.resetModules();
    const { EntityService } = await import('../../src/services/EntityService');
    const service = new EntityService();

    await service.createCompany({ company_name: 'Company A' } as any, 'news_1');
    await service.createPerson({ person_name: 'Person A' } as any, 'news_1');
    await service.createOrganization({ organization_name: 'Org A' } as any, 'news_1');
    await service.createLocation(
      {
        location_name: 'Location A',
        coordinates: { latitude: 1.23, longitude: 4.56 }
      } as any,
      'news_1'
    );

    const companyParams = neo4jService.executeQuery.mock.calls[0]?.[1] as any;
    expect(companyParams.aliases).toEqual([]);

    const personParams = neo4jService.executeQuery.mock.calls[1]?.[1] as any;
    expect(personParams.title).toBe('');
    expect(personParams.company).toBe('');
    expect(personParams.nationality).toBe('');

    const orgParams = neo4jService.executeQuery.mock.calls[2]?.[1] as any;
    expect(orgParams.type).toBe(ORGANIZATION_TYPES.OTHER);

    const locationParams = neo4jService.executeQuery.mock.calls[3]?.[1] as any;
    expect(locationParams.type).toBe(LOCATION_TYPES.OTHER);
    expect(locationParams.coordinates).toContain('latitude');
    expect(locationParams.latitude).toBe(1.23);
    expect(locationParams.longitude).toBe(4.56);
  });

  it('creates company with aliases and location without coordinates', async () => {
    jest.resetModules();
    const { EntityService } = await import('../../src/services/EntityService');
    const service = new EntityService();

    await service.createCompany({ company_name: 'Company B', aliases: ['B'] } as any, 'news_2');
    await service.createLocation({ location_name: 'Location B' } as any, 'news_2');

    const companyParams = neo4jService.executeQuery.mock.calls[0]?.[1] as any;
    expect(companyParams.aliases).toEqual(['B']);

    const locationParams = neo4jService.executeQuery.mock.calls[1]?.[1] as any;
    expect(locationParams.coordinates).toBeNull();
    expect(locationParams.latitude).toBeNull();
    expect(locationParams.longitude).toBeNull();
  });

  it('batchCreateEntities writes entities and relationships', async () => {
    jest.resetModules();
    const { EntityService } = await import('../../src/services/EntityService');
    const service = new EntityService();

    await service.batchCreateEntities({
      newsId: 'news_1',
      title: 'Title',
      content: 'Content',
      timestamp: 1704067200000,
      raw_time: 1704067200,
      source: 'futu_live',
      url: 'https://example.com',
      news_level: EVENT_LEVELS.LEVEL_2,
      confidence: 0.8,
      events: [
        {
          event_id: 'event_1',
          event_name: 'Event',
          event_description: '',
          event_type: EVENT_TYPES.OTHER,
          significance: 1,
          sentiment: SENTIMENTS.NEUTRAL,
          magnitude: 0,
          event_level: EVENT_LEVELS.LEVEL_2,
          timestamp: '2024-01-01T00:00:00.000Z'
        }
      ],
      companies: [{ company_name: 'Company A' }],
      persons: [{ person_name: 'Person A' }],
      organizations: [{ organization_name: 'Org A' }],
      locations: [{ location_name: 'Location A' }],
      relationships: []
    } as any);

    expect(neo4jService.batchMergeEntities).toHaveBeenCalledWith('Event', expect.any(Array));
    expect(neo4jService.batchMergeEntities).toHaveBeenCalledWith('Company', expect.any(Array));
    expect(neo4jService.batchMergeEntities).toHaveBeenCalledWith('Person', expect.any(Array));
    expect(neo4jService.batchMergeEntities).toHaveBeenCalledWith('Organization', expect.any(Array));
    expect(neo4jService.batchMergeEntities).toHaveBeenCalledWith('Location', expect.any(Array));
    expect(neo4jService.batchMergeRelationships).toHaveBeenCalled();

    const createNewsParams = neo4jService.executeQuery.mock.calls[0]?.[1] as any;
    expect(createNewsParams.newsLevel).toBe(EVENT_LEVELS.LEVEL_2);
    expect(createNewsParams.level).toBe(2);
  });

  it('batchCreateEntities skips empty collections and parses numeric timestamps', async () => {
    jest.resetModules();
    const { EntityService } = await import('../../src/services/EntityService');
    const service = new EntityService();

    await service.batchCreateEntities({
      newsId: 'news_empty',
      title: '',
      content: '',
      timestamp: 1704067200000,
      raw_time: 1704067200,
      source: '',
      url: '',
      news_level: EVENT_LEVELS.LEVEL_5,
      confidence: 0.5,
      events: [],
      companies: [],
      persons: undefined,
      organizations: [],
      locations: [],
      relationships: []
    } as any);

    expect(neo4jService.batchMergeEntities).not.toHaveBeenCalled();
    expect(neo4jService.batchMergeRelationships).not.toHaveBeenCalled();
  });

  it('batchCreateEntities falls back to empty newsId in relationships', async () => {
    jest.resetModules();
    const { EntityService } = await import('../../src/services/EntityService');
    const service = new EntityService();

    await service.batchCreateEntities({
      newsId: undefined,
      title: 'Title',
      content: 'Content',
      timestamp: '2024-01-01T00:00:00.000Z',
      source: 'futu_live',
      url: '',
      news_level: EVENT_LEVELS.LEVEL_5,
      confidence: 0.5,
      events: [],
      companies: [{ company_name: 'Company A' }],
      persons: undefined,
      organizations: [],
      locations: [],
      relationships: []
    } as any);

    const relCalls = neo4jService.batchMergeRelationships.mock.calls[0]?.[0] as any[];
    expect(relCalls[0]?.fromValue).toBe('');
  });

  it('batchCreateEntities surfaces errors', async () => {
    jest.resetModules();
    const { EntityService } = await import('../../src/services/EntityService');
    const service = new EntityService();

    neo4jService.batchMergeEntities.mockRejectedValueOnce(new Error('boom'));

    await expect(
      service.batchCreateEntities({
        newsId: 'news_1',
        title: 'Title',
        content: 'Content',
        timestamp: '2024-01-01T00:00:00.000Z',
        source: 'futu_live',
        url: '',
        news_level: EVENT_LEVELS.LEVEL_5,
        confidence: 0.5,
        events: [{ event_id: 'event_1', event_name: 'Event' }],
        companies: [],
        persons: [],
        organizations: [],
        locations: [],
        relationships: []
      } as any)
    ).rejects.toThrow('boom');
  });

  it('checks processed news and handles errors', async () => {
    jest.resetModules();
    const { EntityService } = await import('../../src/services/EntityService');
    const service = new EntityService();

    neo4jService.executeQuery.mockResolvedValueOnce({
      records: [
        {
          get: (key: string) => (key === 'processed' ? true : null)
        }
      ]
    });

    const processed = await service.isNewsProcessed('news_1');
    expect(processed).toBe(true);

    neo4jService.executeQuery.mockResolvedValueOnce({ records: [] });
    const missing = await service.isNewsProcessed('news_missing');
    expect(missing).toBe(false);

    neo4jService.executeQuery.mockRejectedValueOnce(new Error('boom'));
    const fallback = await service.isNewsProcessed('news_2');
    expect(fallback).toBe(false);
  });

  it('returns unprocessed ids and falls back on errors', async () => {
    jest.resetModules();
    const { EntityService } = await import('../../src/services/EntityService');
    const service = new EntityService();

    const empty = await service.getUnprocessedNewsIds([]);
    expect(empty).toEqual([]);
    expect(neo4jService.executeQuery).not.toHaveBeenCalled();

    neo4jService.executeQuery.mockResolvedValueOnce({
      records: [
        {
          get: (key: string) => (key === 'id' ? 'news_1' : null)
        }
      ]
    });

    const unprocessed = await service.getUnprocessedNewsIds(['news_1', 'news_2']);
    expect(unprocessed).toEqual(['news_2']);

    neo4jService.executeQuery.mockRejectedValueOnce(new Error('boom'));
    const fallback = await service.getUnprocessedNewsIds(['news_3']);
    expect(fallback).toEqual(['news_3']);
  });

  it('reports health status', async () => {
    jest.resetModules();
    const { EntityService } = await import('../../src/services/EntityService');
    const service = new EntityService();

    neo4jService.executeQuery.mockResolvedValueOnce({ records: [] });
    const healthy = await service.healthCheck();
    expect(healthy.status).toBe('healthy');

    neo4jService.executeQuery.mockRejectedValueOnce(new Error('boom'));
    const unhealthy = await service.healthCheck();
    expect(unhealthy.status).toBe('unhealthy');
    expect(unhealthy.error).toBe('boom');
  });

  it('healthCheck reports disconnected when result is falsy', async () => {
    jest.resetModules();
    const { EntityService } = await import('../../src/services/EntityService');
    const service = new EntityService();

    neo4jService.executeQuery.mockResolvedValueOnce(null);

    const result = await service.healthCheck();
    expect(result.neo4j_connection).toBe('disconnected');
  });

  it('closes underlying connection', async () => {
    jest.resetModules();
    const { EntityService } = await import('../../src/services/EntityService');
    const service = new EntityService();

    await service.close();
    expect(neo4jService.close).toHaveBeenCalled();
  });

  it('propagates initialization errors', async () => {
    jest.resetModules();
    neo4jService.initialize.mockRejectedValueOnce(new Error('boom'));
    const { EntityService } = await import('../../src/services/EntityService');
    const service = new EntityService();

    await expect(service.initialize()).rejects.toThrow('boom');
  });
});
