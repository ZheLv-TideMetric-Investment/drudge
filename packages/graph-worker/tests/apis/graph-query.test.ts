import { freezeTime } from '../helpers/fake-time';

const knowledgeGraphService = {
  getGraphStats: jest.fn(),
  searchEntities: jest.fn(),
  getEntityRelations: jest.fn()
};

const neo4jService = {
  executeQuery: jest.fn()
};

jest.mock('../../src/services/KnowledgeGraphService', () => ({
  __esModule: true,
  default: knowledgeGraphService
}));

jest.mock('../../src/services/Neo4jService', () => ({
  __esModule: true,
  default: neo4jService
}));

const record = (data: Record<string, any>) => ({
  get: (key: string) => data[key]
});

describe('graph query api', () => {
  let restoreTime: (() => void) | undefined;

  beforeEach(() => {
    restoreTime = freezeTime('2024-01-01T00:00:00.000Z');
    knowledgeGraphService.getGraphStats.mockReset();
    knowledgeGraphService.searchEntities.mockReset();
    knowledgeGraphService.getEntityRelations.mockReset();
    neo4jService.executeQuery.mockReset();
  });

  afterEach(() => {
    restoreTime?.();
  });

  it('getGraphStats returns stats', async () => {
    jest.resetModules();
    const api = await import('../../src/apis/graph/query');

    knowledgeGraphService.getGraphStats.mockResolvedValue({ nodes: 1 });

    const result = await api.getGraphStats();
    expect(result.success).toBe(true);
    expect(result.stats).toEqual({ nodes: 1 });
    expect(result).toMatchSnapshot();
  });

  it('getGraphStats handles failures', async () => {
    jest.resetModules();
    const api = await import('../../src/apis/graph/query');

    knowledgeGraphService.getGraphStats.mockRejectedValueOnce(new Error('boom'));

    const result = await api.getGraphStats();
    expect(result.success).toBe(false);
    expect(result.error).toBe('boom');
    expect(result).toMatchSnapshot();
  });

  it('searchEntities handles failures', async () => {
    jest.resetModules();
    const api = await import('../../src/apis/graph/query');

    knowledgeGraphService.searchEntities.mockRejectedValue(new Error('boom'));

    const result = await api.searchEntities('test');
    expect(result.success).toBe(false);
    expect(result.error).toBe('boom');
    expect(result).toMatchSnapshot();
  });

  it('searchEntities returns entities', async () => {
    jest.resetModules();
    const api = await import('../../src/apis/graph/query');

    knowledgeGraphService.searchEntities.mockResolvedValue([{ labels: ['Company'] }]);

    const result = await api.searchEntities('test', 2);
    expect(result.success).toBe(true);
    expect(result.entities).toHaveLength(1);
    expect(result).toMatchSnapshot();
  });

  it('getNewsList maps records with normalized levels', async () => {
    jest.resetModules();
    const api = await import('../../src/apis/graph/query');

    neo4jService.executeQuery.mockResolvedValueOnce({
      records: [
        record({
          id: 'news_1',
          title: 'Title',
          level: 'Level 1',
          timestamp: '2024-01-01T00:00:00.000Z',
          processedAt: { toNumber: () => 1704067800000 }
        })
      ]
    });

    const result = await api.getNewsList(1, '1');

    expect(result.success).toBe(true);
    expect(result.news).toHaveLength(1);
    expect(result.news[0]).toMatchObject({
      id: 'news_1',
      level: 'Level 1'
    });
    expect(result.news[0]?.processedAt).toBe(1704067800000);

    const [query, params] = neo4jService.executeQuery.mock.calls[0] as [string, any];
    expect(query).toContain('WHERE n.news_level = $level');
    expect(params.level).toBe('Level 1');
    expect(result).toMatchSnapshot();
  });

  it('getNewsList normalizes "Level" prefix and preserves unknown strings', async () => {
    jest.resetModules();
    const api = await import('../../src/apis/graph/query');

    neo4jService.executeQuery.mockResolvedValueOnce({ records: [] });
    await api.getNewsList(1, 'Level 2');
    const [, paramsLevel] = neo4jService.executeQuery.mock.calls[0] as [string, any];
    expect(paramsLevel.level).toBe('Level 2');

    neo4jService.executeQuery.mockResolvedValueOnce({ records: [] });
    await api.getNewsList(1, 'Custom');
    const [, paramsCustom] = neo4jService.executeQuery.mock.calls[1] as [string, any];
    expect(paramsCustom.level).toBe('Custom');
  });

  it('getNewsList works without level filter', async () => {
    jest.resetModules();
    const api = await import('../../src/apis/graph/query');

    neo4jService.executeQuery.mockResolvedValueOnce({
      records: []
    });

    const result = await api.getNewsList(2);
    expect(result.success).toBe(true);
    expect(result.filters.level).toBeUndefined();
  });

  it('getNewsList uses default limit and handles raw processedAt', async () => {
    jest.resetModules();
    const api = await import('../../src/apis/graph/query');

    neo4jService.executeQuery.mockResolvedValueOnce({
      records: [
        record({
          id: 'news_2',
          title: 'Title 2',
          level: 'Level 1',
          timestamp: '2024-01-01T00:00:00.000Z',
          processedAt: 1704067800000
        })
      ]
    });

    const result = await api.getNewsList();
    expect(result.success).toBe(true);
    expect(result.news[0]?.processedAt).toBe(1704067800000);
  });

  it('getNewsList returns error when query fails', async () => {
    jest.resetModules();
    const api = await import('../../src/apis/graph/query');

    neo4jService.executeQuery.mockRejectedValueOnce(new Error('boom'));
    const result = await api.getNewsList(1, 'Level 1');
    expect(result.success).toBe(false);
    expect(result.error).toBe('boom');
    expect(result).toMatchSnapshot();
  });

  it('getNewsDetail returns not found when missing', async () => {
    jest.resetModules();
    const api = await import('../../src/apis/graph/query');

    neo4jService.executeQuery.mockResolvedValueOnce({ records: [] });

    const result = await api.getNewsDetail('missing');
    expect(result.success).toBe(false);
    expect(result.error).toBe('新闻不存在');
    expect(result).toMatchSnapshot();
  });

  it('getNewsDetail returns entities when found', async () => {
    jest.resetModules();
    const api = await import('../../src/apis/graph/query');

    neo4jService.executeQuery
      .mockResolvedValueOnce({
        records: [record({ n: { properties: { id: 'news_1' } } })]
      })
      .mockResolvedValueOnce({
        records: [
          record({
            relationType: 'INVOLVES',
            entityLabels: ['Company'],
            entity: { properties: { company_name: 'Acme' } }
          })
        ]
      });

    const result = await api.getNewsDetail('news_1');

    expect(result.success).toBe(true);
    expect(result.entities).toHaveLength(1);
    expect(result.entities[0]?.relationType).toBe('INVOLVES');
    expect(result).toMatchSnapshot();
  });

  it('getNewsDetail handles query errors', async () => {
    jest.resetModules();
    const api = await import('../../src/apis/graph/query');

    neo4jService.executeQuery.mockRejectedValueOnce(new Error('boom'));
    const result = await api.getNewsDetail('news_1');
    expect(result.success).toBe(false);
    expect(result.error).toBe('boom');
    expect(result).toMatchSnapshot();
  });

  it('getPopularEntities maps counts', async () => {
    jest.resetModules();
    const api = await import('../../src/apis/graph/query');

    neo4jService.executeQuery.mockResolvedValue({
      records: [
        record({
          labels: ['Company'],
          name: 'Company A',
          newsCount: { toNumber: () => 5 }
        })
      ]
    });

    const result = await api.getPopularEntities(1);

    expect(result.success).toBe(true);
    expect(result.entities[0]).toMatchObject({ name: 'Company A', newsCount: 5 });
    expect(result).toMatchSnapshot();
  });

  it('getPopularEntities uses default limit', async () => {
    jest.resetModules();
    const api = await import('../../src/apis/graph/query');

    neo4jService.executeQuery.mockResolvedValue({
      records: []
    });

    const result = await api.getPopularEntities();
    expect(result.success).toBe(true);
  });

  it('getPopularEntities returns errors', async () => {
    jest.resetModules();
    const api = await import('../../src/apis/graph/query');

    neo4jService.executeQuery.mockRejectedValueOnce(new Error('boom'));

    const result = await api.getPopularEntities(1);
    expect(result.success).toBe(false);
    expect(result.error).toBe('boom');
    expect(result).toMatchSnapshot();
  });

  it('getEntityNews maps relation types', async () => {
    jest.resetModules();
    const api = await import('../../src/apis/graph/query');

    neo4jService.executeQuery.mockResolvedValue({
      records: [
        record({
          id: 'news_1',
          title: 'Title',
          level: 'Level 2',
          timestamp: '2024-01-01T00:00:00.000Z',
          relationType: 'INVOLVES'
        })
      ]
    });

    const result = await api.getEntityNews('Acme', 1);
    expect(result.success).toBe(true);
    expect(result.news[0]).toMatchObject({ relationType: 'INVOLVES' });
    expect(result).toMatchSnapshot();
  });

  it('getEntityNews uses default limit', async () => {
    jest.resetModules();
    const api = await import('../../src/apis/graph/query');

    neo4jService.executeQuery.mockResolvedValue({ records: [] });

    const result = await api.getEntityNews('Acme');
    expect(result.success).toBe(true);
  });

  it('getEntityNews handles errors', async () => {
    jest.resetModules();
    const api = await import('../../src/apis/graph/query');

    neo4jService.executeQuery.mockRejectedValueOnce(new Error('boom'));

    const result = await api.getEntityNews('Acme', 1);
    expect(result.success).toBe(false);
    expect(result.error).toBe('boom');
    expect(result).toMatchSnapshot();
  });

  it('getEntityRelations returns relation graph and handles errors', async () => {
    jest.resetModules();
    const api = await import('../../src/apis/graph/query');

    knowledgeGraphService.getEntityRelations.mockResolvedValue({ nodes: [] });
    const ok = await api.getEntityRelations('Acme', 2);
    expect(ok.success).toBe(true);
    expect(ok).toMatchSnapshot();

    knowledgeGraphService.getEntityRelations.mockResolvedValueOnce({ nodes: [] });
    const defaultDepth = await api.getEntityRelations('Acme');
    expect(defaultDepth.success).toBe(true);
    expect(knowledgeGraphService.getEntityRelations).toHaveBeenCalledWith('Acme', 2);

    knowledgeGraphService.getEntityRelations.mockRejectedValueOnce(new Error('boom'));
    const bad = await api.getEntityRelations('Acme', 2);
    expect(bad.success).toBe(false);
    expect(bad.error).toBe('boom');
    expect(bad).toMatchSnapshot();
  });

  it('getNewsLevelDistribution returns totals', async () => {
    jest.resetModules();
    const api = await import('../../src/apis/graph/query');

    neo4jService.executeQuery.mockResolvedValue({
      records: [
        record({ level: 'Level 1', count: { toNumber: () => 2 } }),
        record({ level: 'Level 2', count: { toNumber: () => 1 } })
      ]
    });

    const result = await api.getNewsLevelDistribution();

    expect(result.success).toBe(true);
    expect(result.total).toBe(3);
    expect(result).toMatchSnapshot();
  });

  it('getNewsLevelDistribution handles errors', async () => {
    jest.resetModules();
    const api = await import('../../src/apis/graph/query');

    neo4jService.executeQuery.mockRejectedValueOnce(new Error('boom'));

    const result = await api.getNewsLevelDistribution();
    expect(result.success).toBe(false);
    expect(result.error).toBe('boom');
    expect(result).toMatchSnapshot();
  });
});
