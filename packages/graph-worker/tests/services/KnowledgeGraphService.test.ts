export {};

const mockEntityService = {
  initialize: jest.fn().mockResolvedValue(undefined),
  isNewsProcessed: jest.fn(),
  batchCreateEntities: jest.fn().mockResolvedValue(undefined),
  getUnprocessedNewsIds: jest.fn(),
  close: jest.fn().mockResolvedValue(undefined),
  neo4j: {
    createIndexes: jest.fn().mockResolvedValue(undefined),
    getDbStats: jest.fn().mockResolvedValue({}),
    healthCheck: jest.fn().mockResolvedValue(true),
    executeQuery: jest.fn().mockResolvedValue({ records: [] })
  }
};

const mockExtractionService = {
  extractFromNews: jest.fn(),
  batchExtractEntities: jest.fn()
};

const mockRelationshipService = {
  initialize: jest.fn().mockResolvedValue(undefined),
  batchCreateRelationships: jest.fn().mockResolvedValue(undefined),
  createInferredRelationships: jest.fn().mockResolvedValue(undefined),
  getEntityRelationships: jest.fn().mockResolvedValue({ nodes: [], relationships: [] }),
  close: jest.fn().mockResolvedValue(undefined)
};

jest.mock('neo4j-driver', () => ({
  __esModule: true,
  int: (value: number) => value
}));

jest.mock('../../src/services/EntityService', () => ({
  __esModule: true,
  EntityService: jest.fn(() => mockEntityService),
  default: mockEntityService
}));

jest.mock('../../src/services/EntityExtractionService', () => ({
  __esModule: true,
  EntityExtractionService: jest.fn(() => mockExtractionService)
}));

jest.mock('../../src/services/RelationshipService', () => ({
  __esModule: true,
  default: mockRelationshipService
}));

const record = (data: Record<string, any>) => ({
  get: (key: string) => data[key]
});

describe('KnowledgeGraphService', () => {
  beforeEach(() => {
    mockEntityService.isNewsProcessed.mockReset();
    mockEntityService.batchCreateEntities.mockReset();
    mockEntityService.getUnprocessedNewsIds.mockReset();
    mockEntityService.initialize.mockResolvedValue(undefined);
    mockEntityService.close.mockResolvedValue(undefined);
    mockEntityService.neo4j.createIndexes.mockResolvedValue(undefined);
    mockEntityService.neo4j.getDbStats.mockResolvedValue({});
    mockEntityService.neo4j.healthCheck.mockResolvedValue(true);
    mockEntityService.neo4j.executeQuery.mockResolvedValue({ records: [] });
    mockExtractionService.extractFromNews.mockReset();
    mockExtractionService.batchExtractEntities.mockReset();
    mockRelationshipService.initialize.mockReset();
    mockRelationshipService.batchCreateRelationships.mockReset();
    mockRelationshipService.createInferredRelationships.mockReset();
    mockRelationshipService.getEntityRelationships.mockReset();
    mockRelationshipService.close.mockResolvedValue(undefined);
  });

  it('processNews returns early when already processed', async () => {
    jest.resetModules();
    mockEntityService.isNewsProcessed.mockResolvedValue(true);

    const service = (await import('../../src/services/KnowledgeGraphService')).default;
    const result = await service.processNews({ id: 'news_1' } as any);

    expect(result.success).toBe(true);
    expect(result.newsId).toBe('news_1');
    expect(mockExtractionService.extractFromNews).not.toHaveBeenCalled();
    expect(mockEntityService.batchCreateEntities).not.toHaveBeenCalled();
    expect(mockRelationshipService.batchCreateRelationships).not.toHaveBeenCalled();
  });

  it('processNews extracts and writes entities when unprocessed', async () => {
    jest.resetModules();
    mockEntityService.isNewsProcessed.mockResolvedValue(false);

    const extractionResult = {
      newsId: 'news_2',
      events: [{}],
      companies: [{ company_name: 'Company A' }],
      persons: [{ person_name: 'Person A' }],
      organizations: [],
      locations: [{ location_name: 'Location A' }, { location_name: 'Location B' }],
      relationships: [{ type: 'related', from: 'A', to: 'B' }]
    };

    mockExtractionService.extractFromNews.mockResolvedValue(extractionResult);

    const service = (await import('../../src/services/KnowledgeGraphService')).default;
    const result = await service.processNews({ id: 'news_2' } as any);

    expect(mockEntityService.batchCreateEntities).toHaveBeenCalledWith(extractionResult);
    expect(mockRelationshipService.batchCreateRelationships).toHaveBeenCalledWith([extractionResult]);
    expect(mockRelationshipService.createInferredRelationships).toHaveBeenCalledWith([extractionResult]);
    expect(result.stats).toEqual({
      events: 1,
      companies: 1,
      persons: 1,
      organizations: 0,
      locations: 2,
      relationships: 1
    });
  });

  it('processNews treats missing persons as zero', async () => {
    jest.resetModules();
    mockEntityService.isNewsProcessed.mockResolvedValue(false);

    const extractionResult = {
      newsId: 'news_3',
      events: [],
      companies: [],
      organizations: [],
      locations: [],
      relationships: []
    };

    mockExtractionService.extractFromNews.mockResolvedValue(extractionResult);

    const service = (await import('../../src/services/KnowledgeGraphService')).default;
    const result = await service.processNews({ id: 'news_3' } as any);

    expect(result.stats?.persons).toBe(0);
  });
  it('processNews returns failure when extraction throws', async () => {
    jest.resetModules();
    mockEntityService.isNewsProcessed.mockResolvedValue(false);
    mockExtractionService.extractFromNews.mockRejectedValueOnce(new Error('boom'));

    const service = (await import('../../src/services/KnowledgeGraphService')).default;
    const result = await service.processNews({ id: 'news_err' } as any);

    expect(result.success).toBe(false);
    expect(result.error).toBe('boom');
  });

  it('batchProcessNews skips extraction when all processed', async () => {
    jest.resetModules();
    mockEntityService.getUnprocessedNewsIds.mockResolvedValue([]);

    const service = (await import('../../src/services/KnowledgeGraphService')).default;
    const results = await service.batchProcessNews([
      { id: 'news_1' } as any,
      { id: 'news_2' } as any
    ]);

    expect(results).toHaveLength(2);
    expect(results.every(result => result.success)).toBe(true);
    expect(mockExtractionService.batchExtractEntities).not.toHaveBeenCalled();
  });

  it('batchProcessNews processes only unprocessed news', async () => {
    jest.resetModules();
    mockEntityService.getUnprocessedNewsIds.mockResolvedValue(['news_3']);

    const extractionResult = {
      newsId: 'news_3',
      events: [],
      companies: [],
      persons: [],
      organizations: [],
      locations: [],
      relationships: []
    };

    mockExtractionService.batchExtractEntities.mockResolvedValue([extractionResult]);

    const service = (await import('../../src/services/KnowledgeGraphService')).default;
    const results = await service.batchProcessNews([
      { id: 'news_1' } as any,
      { id: 'news_3' } as any
    ]);

    expect(mockExtractionService.batchExtractEntities).toHaveBeenCalledWith([{ id: 'news_3' }]);
    expect(mockEntityService.batchCreateEntities).toHaveBeenCalledWith(extractionResult);
    expect(mockRelationshipService.batchCreateRelationships).toHaveBeenCalled();
    expect(mockRelationshipService.createInferredRelationships).toHaveBeenCalled();
    expect(results).toHaveLength(1);
    expect(results[0]?.newsId).toBe('news_3');
  });

  it('initializes dependent services and creates indexes', async () => {
    jest.resetModules();

    const service = (await import('../../src/services/KnowledgeGraphService')).default;
    await service.initialize();

    expect(mockEntityService.initialize).toHaveBeenCalled();
    expect(mockRelationshipService.initialize).toHaveBeenCalled();
    expect(mockEntityService.neo4j.createIndexes).toHaveBeenCalled();
  });

  it('propagates initialization failures', async () => {
    jest.resetModules();
    mockEntityService.initialize.mockRejectedValueOnce(new Error('boom'));

    const service = (await import('../../src/services/KnowledgeGraphService')).default;
    await expect(service.initialize()).rejects.toThrow('boom');
  });

  it('batchProcessNews marks failures when extraction fails', async () => {
    jest.resetModules();
    mockEntityService.getUnprocessedNewsIds.mockResolvedValue(['news_1', 'news_2']);
    mockExtractionService.batchExtractEntities.mockRejectedValueOnce(new Error('boom'));

    const service = (await import('../../src/services/KnowledgeGraphService')).default;
    const results = await service.batchProcessNews([
      { id: 'news_1' } as any,
      { id: 'news_2' } as any
    ]);

    expect(results).toHaveLength(2);
    expect(results.every(result => result.success === false)).toBe(true);
  });

  it('batchProcessNews triggers gc and delays between chunks', async () => {
    jest.useFakeTimers();
    jest.resetModules();

    jest.doMock('../../src/config/config', () => ({
      __esModule: true,
      default: {
        processing: {
          memory: {
            processingChunkSize: 1,
            chunkDelayMs: 1,
            dangerThreshold: 0.1,
            maxHeapSizeMB: 1,
            enableAutoGC: true
          }
        },
        logging: {
          level: 'info',
          format: 'combined'
        }
      }
    }));

    const memorySpy = jest.spyOn(process, 'memoryUsage').mockReturnValue({
      heapUsed: 10 * 1024 * 1024,
      heapTotal: 12 * 1024 * 1024,
      external: 0,
      rss: 0,
      arrayBuffers: 0
    });

    const gcSpy = jest.fn();
    const originalGc = global.gc;
    global.gc = gcSpy;

    mockEntityService.getUnprocessedNewsIds.mockResolvedValue(['news_1', 'news_2']);
    mockExtractionService.batchExtractEntities
      .mockResolvedValueOnce([
        {
          newsId: 'news_1',
          events: [],
          companies: [],
          persons: [],
          organizations: [],
          locations: [],
          relationships: []
        }
      ])
      .mockResolvedValueOnce([
        {
          newsId: 'news_2',
          events: [],
          companies: [],
          persons: [],
          organizations: [],
          locations: [],
          relationships: []
        }
      ]);

    const service = (await import('../../src/services/KnowledgeGraphService')).default;
    const promise = service.batchProcessNews([
      { id: 'news_1' } as any,
      { id: 'news_2' } as any
    ]);

    await jest.advanceTimersByTimeAsync(2);
    const results = await promise;

    expect(results.length).toBeGreaterThan(0);
    expect(gcSpy).toHaveBeenCalled();

    jest.dontMock('../../src/config/config');
    global.gc = originalGc;
    memorySpy.mockRestore();
    jest.useRealTimers();
  });

  it('processExtractionResults handles per-item failures and relationship errors', async () => {
    jest.resetModules();
    const service = (await import('../../src/services/KnowledgeGraphService')).default as any;

    mockEntityService.batchCreateEntities.mockRejectedValueOnce(new Error('boom'));
    mockRelationshipService.batchCreateRelationships.mockRejectedValueOnce(new Error('rel boom'));

    const results = await service.processExtractionResults([
      {
        newsId: 'news_1',
        events: [],
        companies: [],
        persons: [],
        organizations: [],
        locations: [],
        relationships: []
      },
      {
        newsId: 'news_2',
        events: [],
        companies: [],
        persons: [],
        organizations: [],
        locations: [],
        relationships: []
      }
    ]);

    expect(results).toHaveLength(2);
    expect(results[0]?.success).toBe(false);
    expect(results[1]?.success).toBe(true);
  });

  it('processExtractionResults uses empty newsId fallback', async () => {
    jest.resetModules();
    const service = (await import('../../src/services/KnowledgeGraphService')).default as any;

    const results = await service.processExtractionResults([
      {
        newsId: undefined,
        events: [],
        companies: [],
        persons: undefined,
        organizations: [],
        locations: [],
        relationships: []
      }
    ]);

    expect(results[0]?.newsId).toBe('');
    expect(results[0]?.stats?.persons).toBe(0);
  });

  it('processExtractionResults uses empty newsId on failures', async () => {
    jest.resetModules();
    const service = (await import('../../src/services/KnowledgeGraphService')).default as any;

    mockEntityService.batchCreateEntities.mockRejectedValueOnce(new Error('boom'));

    const results = await service.processExtractionResults([
      {
        newsId: undefined,
        events: [],
        companies: [],
        persons: [],
        organizations: [],
        locations: [],
        relationships: []
      }
    ]);

    expect(results[0]?.success).toBe(false);
    expect(results[0]?.newsId).toBe('');
  });

  it('gets graph stats and handles failures', async () => {
    jest.resetModules();
    const service = (await import('../../src/services/KnowledgeGraphService')).default;

    mockEntityService.neo4j.getDbStats.mockResolvedValueOnce({ nodes: { total: 1 }, relationships: { total: 2 } });
    mockEntityService.neo4j.healthCheck.mockResolvedValueOnce(true);

    const stats = await service.getGraphStats();
    expect(stats.success).toBe(true);
    expect(stats.database.nodes.total).toBe(1);

    mockEntityService.neo4j.getDbStats.mockRejectedValueOnce(new Error('boom'));
    const failed = await service.getGraphStats();
    expect(failed.success).toBe(false);
    expect(failed.error).toBe('boom');
  });

  it('getGraphStats reflects initialized state and unhealthy database', async () => {
    jest.resetModules();
    const service = (await import('../../src/services/KnowledgeGraphService')).default as any;
    service.initialized = true;

    mockEntityService.neo4j.getDbStats.mockResolvedValueOnce({});
    mockEntityService.neo4j.healthCheck.mockResolvedValueOnce(false);

    const stats = await service.getGraphStats();
    expect(stats.success).toBe(true);
    expect(stats.services['知识图谱服务']).toBe('✅ 运行中');
    expect(stats.database.status).toBe('异常');
    expect(stats.database.nodes.total).toBe(0);
  });

  it('searches entities with and without query', async () => {
    jest.resetModules();
    const service = (await import('../../src/services/KnowledgeGraphService')).default;

    mockEntityService.neo4j.executeQuery.mockResolvedValueOnce({
      records: [record({ labels: ['Company'], n: { properties: { company_name: 'Acme' } } })]
    });

    const allResults = await service.searchEntities('', 2);
    expect(allResults).toHaveLength(1);

    mockEntityService.neo4j.executeQuery.mockResolvedValueOnce({
      records: [record({ labels: ['Person'], n: { properties: { person_name: 'Alice' } } })]
    });

    const queryResults = await service.searchEntities('Ali', 1);
    expect(queryResults[0].properties.person_name).toBe('Alice');
  });

  it('searchEntities uses safeLimit for invalid input and wildcard', async () => {
    jest.resetModules();
    const service = (await import('../../src/services/KnowledgeGraphService')).default;

    mockEntityService.neo4j.executeQuery.mockResolvedValueOnce({ records: [] });
    await service.searchEntities('*', 'bad' as any);

    const [, params] = mockEntityService.neo4j.executeQuery.mock.calls[0] as [string, any];
    expect(params.limit).toBe(10);
  });

  it('searchEntities uses default limit when not provided', async () => {
    jest.resetModules();
    const service = (await import('../../src/services/KnowledgeGraphService')).default;

    mockEntityService.neo4j.executeQuery.mockResolvedValueOnce({ records: [] });

    await service.searchEntities('Acme');

    const [, params] = mockEntityService.neo4j.executeQuery.mock.calls[0] as [string, any];
    expect(params.limit).toBe(10);
  });

  it('returns empty list when searchEntities throws', async () => {
    jest.resetModules();
    mockEntityService.neo4j.executeQuery.mockRejectedValueOnce(new Error('boom'));

    const service = (await import('../../src/services/KnowledgeGraphService')).default;
    const results = await service.searchEntities('boom', 1);
    expect(results).toEqual([]);
  });

  it('delegates isNewsProcessed', async () => {
    jest.resetModules();
    mockEntityService.isNewsProcessed.mockResolvedValueOnce(true);

    const service = (await import('../../src/services/KnowledgeGraphService')).default;
    const result = await service.isNewsProcessed('news_1');

    expect(result).toBe(true);
    expect(mockEntityService.isNewsProcessed).toHaveBeenCalledWith('news_1');
  });

  it('returns fallback when entity relations fail', async () => {
    jest.resetModules();
    mockRelationshipService.getEntityRelationships.mockRejectedValueOnce(new Error('boom'));

    const service = (await import('../../src/services/KnowledgeGraphService')).default;
    const result = await service.getEntityRelations('Entity', 2);

    expect(result).toEqual({ nodes: [], relationships: [], center: 'Entity' });
  });

  it('returns entity relations when available', async () => {
    jest.resetModules();
    mockRelationshipService.getEntityRelationships.mockResolvedValueOnce({ nodes: ['n'] });

    const service = (await import('../../src/services/KnowledgeGraphService')).default;
    const result = await service.getEntityRelations('Entity', 2);

    expect(result).toEqual({ nodes: ['n'] });
  });

  it('getEntityRelations uses default depth when omitted', async () => {
    jest.resetModules();
    mockRelationshipService.getEntityRelationships.mockResolvedValueOnce({ nodes: ['n'] });

    const service = (await import('../../src/services/KnowledgeGraphService')).default;
    await service.getEntityRelations('Entity');

    expect(mockRelationshipService.getEntityRelationships).toHaveBeenCalledWith('Entity', 50);
  });

  it('closes services', async () => {
    jest.resetModules();
    const service = (await import('../../src/services/KnowledgeGraphService')).default;

    await service.close();
    expect(mockEntityService.close).toHaveBeenCalled();
    expect(mockRelationshipService.close).toHaveBeenCalled();
  });
});
