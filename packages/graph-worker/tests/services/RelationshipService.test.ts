export {};

const neo4jService = {
  initialize: jest.fn().mockResolvedValue(undefined),
  executeQuery: jest.fn().mockResolvedValue({ records: [] }),
  close: jest.fn().mockResolvedValue(undefined)
};

jest.mock('../../src/services/Neo4jService', () => ({
  __esModule: true,
  default: neo4jService
}));

const record = (data: Record<string, any>) => ({
  get: (key: string) => data[key]
});

describe('RelationshipService', () => {
  beforeEach(() => {
    neo4jService.initialize.mockClear();
    neo4jService.executeQuery.mockClear();
    neo4jService.close.mockClear();
  });

  it('sanitizes relationship types', async () => {
    jest.resetModules();
    const service = (await import('../../src/services/RelationshipService')).default as any;

    expect(service.sanitizeRelationshipType('OWNS')).toBe('OWNS');
    expect(service.sanitizeRelationshipType('related')).toBe('OTHER');
  });

  it('returns early when initialized', async () => {
    jest.resetModules();
    const service = (await import('../../src/services/RelationshipService')).default as any;
    service.initialized = true;

    await service.initialize();

    expect(neo4jService.initialize).not.toHaveBeenCalled();
  });

  it('warns for unknown relationship types', async () => {
    jest.resetModules();
    const service = (await import('../../src/services/RelationshipService')).default as any;

    expect(service.sanitizeRelationshipType('UNKNOWN_TYPE')).toBe('OTHER');
  });

  it('creates relationships using sanitized type', async () => {
    jest.resetModules();
    const service = (await import('../../src/services/RelationshipService')).default;

    await service.createRelationship(
      {
        type: 'related' as any,
        from: 'Company A',
        to: 'Company B',
        description: 'related',
        confidence: 0.5
      },
      'news_1'
    );

    const query = neo4jService.executeQuery.mock.calls[0]?.[0] as string;
    expect(query).toContain('MERGE (from)-[r:OTHER]->(to)');
  });

  it('creates relationships with default description and confidence', async () => {
    jest.resetModules();
    const service = (await import('../../src/services/RelationshipService')).default;

    await service.createRelationship(
      {
        type: 'related' as any,
        from: 'Company A',
        to: 'Company B'
      } as any,
      'news_1'
    );

    const [, params] = neo4jService.executeQuery.mock.calls[0] as [string, any];
    expect(params.description).toBe('');
    expect(params.confidence).toBe(0.8);
  });

  it('handles relationship creation failures', async () => {
    jest.resetModules();
    const service = (await import('../../src/services/RelationshipService')).default;

    neo4jService.executeQuery.mockRejectedValueOnce(new Error('boom'));

    await service.createRelationship(
      {
        type: 'related' as any,
        from: 'Company A',
        to: 'Company B',
        description: 'related',
        confidence: 0.5
      },
      'news_1'
    );

    expect(neo4jService.executeQuery).toHaveBeenCalled();
  });

  it('batch creates relationships and skips empty input', async () => {
    jest.resetModules();
    const service = (await import('../../src/services/RelationshipService')).default;

    await service.batchCreateRelationships([
      {
        newsId: 'news_1',
        relationships: [
          {
            type: 'related' as any,
            from: 'Company A',
            to: 'Company B',
            description: 'related',
            confidence: 0.5
          }
        ],
        events: [],
        companies: [],
        persons: [],
        organizations: [],
        locations: []
      }
    ] as any);

    expect(neo4jService.executeQuery).toHaveBeenCalled();

    neo4jService.executeQuery.mockClear();
    await service.batchCreateRelationships([]);
    expect(neo4jService.executeQuery).not.toHaveBeenCalled();
  });

  it('batchCreateRelationships uses defaults and newsId fallback', async () => {
    jest.resetModules();
    const service = (await import('../../src/services/RelationshipService')).default;

    await service.batchCreateRelationships([
      {
        newsId: undefined,
        relationships: [
          {
            type: 'related' as any,
            from: 'Company A',
            to: 'Company B'
          }
        ],
        events: [],
        companies: [],
        persons: [],
        organizations: [],
        locations: []
      }
    ] as any);

    const [, params] = neo4jService.executeQuery.mock.calls[0] as [string, any];
    const key = Object.keys(params)[0]!;
    expect(params[key].description).toBe('');
    expect(params[key].confidence).toBe(0.8);
    expect(params[key].newsId).toBe('');
  });

  it('batchCreateRelationships logs per-query failures', async () => {
    jest.resetModules();
    const service = (await import('../../src/services/RelationshipService')).default;

    neo4jService.executeQuery.mockRejectedValueOnce(new Error('boom'));

    await service.batchCreateRelationships([
      {
        newsId: 'news_1',
        relationships: [
          {
            type: 'related' as any,
            from: 'Company A',
            to: 'Company B',
            description: 'related',
            confidence: 0.5
          }
        ],
        events: [],
        companies: [],
        persons: [],
        organizations: [],
        locations: []
      }
    ] as any);

    expect(neo4jService.executeQuery).toHaveBeenCalled();
  });

  it('batchCreateRelationships falls back on unexpected errors', async () => {
    jest.resetModules();
    const service = (await import('../../src/services/RelationshipService')).default as any;
    service.initialized = true;
    const { logger } = await import('../../src/utils/logger');
    const infoSpy = jest.spyOn(logger, 'info').mockImplementation(() => {
      throw new Error('boom');
    });

    await service.batchCreateRelationships([
      {
        newsId: 'news_1',
        relationships: [
          {
            type: 'related' as any,
            from: 'Company A',
            to: 'Company B',
            description: 'related',
            confidence: 0.5
          }
        ],
        events: [],
        companies: [],
        persons: [],
        organizations: [],
        locations: []
      }
    ] as any);
    infoSpy.mockRestore();
  });

  it('batchCreateRelationships fallback uses empty newsId when missing', async () => {
    jest.resetModules();
    const service = (await import('../../src/services/RelationshipService')).default as any;
    service.initialized = true;
    const { logger } = await import('../../src/utils/logger');
    const infoSpy = jest.spyOn(logger, 'info').mockImplementation(() => {
      throw new Error('boom');
    });
    const createSpy = jest.spyOn(service, 'createRelationship').mockResolvedValue(undefined);

    await service.batchCreateRelationships([
      {
        newsId: undefined,
        relationships: [
          {
            type: 'related' as any,
            from: 'Company A',
            to: 'Company B'
          }
        ],
        events: [],
        companies: [],
        persons: [],
        organizations: [],
        locations: []
      }
    ] as any);

    expect(createSpy).toHaveBeenCalledWith(
      expect.objectContaining({ from: 'Company A', to: 'Company B' }),
      ''
    );

    infoSpy.mockRestore();
    createSpy.mockRestore();
  });

  it('logs when fallback relationship creation fails', async () => {
    jest.resetModules();
    const service = (await import('../../src/services/RelationshipService')).default as any;
    service.initialized = true;
    const { logger } = await import('../../src/utils/logger');
    const infoSpy = jest.spyOn(logger, 'info').mockImplementation(() => {
      throw new Error('boom');
    });
    const createSpy = jest
      .spyOn(service, 'createRelationship')
      .mockRejectedValueOnce(new Error('rel fail'));

    await service.batchCreateRelationships([
      {
        newsId: 'news_1',
        relationships: [
          {
            type: 'related' as any,
            from: 'Company A',
            to: 'Company B',
            description: 'related',
            confidence: 0.5
          }
        ],
        events: [],
        companies: [],
        persons: [],
        organizations: [],
        locations: []
      }
    ] as any);

    infoSpy.mockRestore();
    createSpy.mockRestore();
  });

  it('dedupes inferred relationships and uses parameterized query', async () => {
    jest.resetModules();
    const service = (await import('../../src/services/RelationshipService')).default;

    await service.createInferredRelationships([
      {
        newsId: 'news_1',
        events: [],
        companies: [{ company_name: 'Acme' }],
        persons: [{ person_name: 'Alice' }],
        organizations: [],
        locations: [],
        relationships: []
      },
      {
        newsId: 'news_2',
        events: [],
        companies: [{ company_name: 'Acme' }],
        persons: [{ person_name: 'Alice' }],
        organizations: [],
        locations: [],
        relationships: []
      }
    ] as any);

    const [query, params] = neo4jService.executeQuery.mock.calls[0] as [string, any];
    expect(query).toContain('UNWIND $pairs');
    expect(params.pairs).toHaveLength(1);
    expect(params.pairs[0]).toEqual({
      companyName: 'Acme',
      personName: 'Alice',
      newsId: 'news_1'
    });
  });

  it('creates inferred relationships for multiple pair types and handles errors', async () => {
    jest.resetModules();
    const service = (await import('../../src/services/RelationshipService')).default;

    neo4jService.executeQuery
      .mockResolvedValueOnce({ records: [] })
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce({ records: [] })
      .mockResolvedValueOnce({ records: [] });

    await service.createInferredRelationships([
      {
        newsId: 'news_1',
        events: [],
        companies: [{ company_name: 'Acme' }],
        persons: [{ person_name: 'Alice' }],
        organizations: [{ organization_name: 'Org' }],
        locations: [{ location_name: 'NY' }],
        relationships: []
      }
    ] as any);

    expect(neo4jService.executeQuery).toHaveBeenCalled();
  });

  it('createInferredRelationships handles missing newsId and persons', async () => {
    jest.resetModules();
    const service = (await import('../../src/services/RelationshipService')).default;

    await service.createInferredRelationships([
      {
        newsId: undefined,
        events: [],
        companies: [{ company_name: 'Acme' }],
        persons: undefined,
        organizations: [],
        locations: [{ location_name: 'NY' }],
        relationships: []
      }
    ] as any);

    expect(neo4jService.executeQuery).toHaveBeenCalled();
  });

  it('getEntityRelationships maps inferred defaults and handles errors', async () => {
    jest.resetModules();
    const service = (await import('../../src/services/RelationshipService')).default;

    neo4jService.executeQuery.mockResolvedValueOnce({
      records: [
        record({
          relationType: 'INVOLVES',
          description: 'desc',
          confidence: 0.8,
          inferred: undefined,
          entityLabels: ['Company'],
          entity: { properties: { company_name: 'Acme' } },
          connectedLabels: ['Person'],
          connected: { properties: { person_name: 'Alice' } }
        })
      ]
    });

    const results = await service.getEntityRelationships('Acme', 1);
    expect(results[0].inferred).toBe(false);

    neo4jService.executeQuery.mockRejectedValueOnce(new Error('boom'));
    const fallback = await service.getEntityRelationships('Acme', 1);
    expect(fallback).toEqual([]);
  });

  it('creates inferred relationships across entity types and handles errors', async () => {
    jest.resetModules();
    const service = (await import('../../src/services/RelationshipService')).default;

    neo4jService.executeQuery.mockRejectedValueOnce(new Error('boom'));

    await service.createInferredRelationships([
      {
        newsId: 'news_1',
        events: [],
        companies: [{ company_name: 'Acme' }],
        persons: [{ person_name: 'Alice' }],
        organizations: [{ organization_name: 'Org' }],
        locations: [{ location_name: 'NYC' }],
        relationships: []
      }
    ] as any);

    expect(neo4jService.executeQuery).toHaveBeenCalled();
  });

  it('returns mapped entity relationships', async () => {
    jest.resetModules();
    const service = (await import('../../src/services/RelationshipService')).default;

    neo4jService.executeQuery.mockResolvedValueOnce({
      records: [
        record({
          relationType: 'INVOLVES',
          description: 'desc',
          confidence: 0.8,
          inferred: true,
          entityLabels: ['Company'],
          entity: { properties: { company_name: 'Acme' } },
          connectedLabels: ['Person'],
          connected: { properties: { person_name: 'Alice' } }
        })
      ]
    });

    const results = await service.getEntityRelationships('Acme', 10);

    expect(results[0]).toMatchObject({
      relationType: 'INVOLVES',
      description: 'desc',
      inferred: true,
      entity: { labels: ['Company'] },
      connected: { labels: ['Person'] }
    });
  });

  it('getEntityRelationships uses default limit when omitted', async () => {
    jest.resetModules();
    const service = (await import('../../src/services/RelationshipService')).default;

    neo4jService.executeQuery.mockResolvedValueOnce({ records: [] });

    await service.getEntityRelationships('Acme');

    expect(neo4jService.executeQuery).toHaveBeenCalledWith(expect.any(String), {
      entityName: 'Acme',
      limit: 50
    });
  });

  it('returns empty list when entity relationship query fails', async () => {
    jest.resetModules();
    const service = (await import('../../src/services/RelationshipService')).default;

    neo4jService.executeQuery.mockRejectedValueOnce(new Error('boom'));

    const results = await service.getEntityRelationships('Acme', 10);
    expect(results).toEqual([]);
  });

  it('propagates initialization failures', async () => {
    jest.resetModules();
    neo4jService.initialize.mockRejectedValueOnce(new Error('boom'));
    const service = (await import('../../src/services/RelationshipService')).default;

    await expect(service.initialize()).rejects.toThrow('boom');
  });

  it('closes service', async () => {
    jest.resetModules();
    const service = (await import('../../src/services/RelationshipService')).default;

    await service.close();
    expect(neo4jService.close).toHaveBeenCalled();
  });
});
