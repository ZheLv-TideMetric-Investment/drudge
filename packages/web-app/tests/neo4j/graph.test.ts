const executeQuery = jest.fn();

jest.mock('../../src/lib/neo4j/connection', () => ({
  neo4jConnection: {
    executeQuery
  }
}));

import { neo4jGraphService } from '../../src/lib/neo4j/graph';
import { TimeZoneUtils } from '../../src/lib/utils/timezone';

const createRecord = (data: Record<string, any>) => ({
  get: (key: string) => {
    if (!(key in data)) {
      throw new Error('missing');
    }
    return data[key];
  }
});

const makeNode = (id: string, labels: string[], properties: Record<string, any>) => ({
  identity: { toString: () => id },
  labels,
  properties
});

const makeRel = (id: string, start: string, end: string, type = 'REL', properties: Record<string, any> = {}) => ({
  identity: { toString: () => id },
  start: { toString: () => start },
  end: { toString: () => end },
  type,
  properties
});

const toNeo4jInt = (value: number) => ({
  toNumber: () => value
});

describe('neo4j/graph', () => {
  beforeEach(() => {
    executeQuery.mockReset();
  });

  it('rejects invalid entity id for neighborhood', async () => {
    await expect(neo4jGraphService.getEntityNeighborhood('undefined')).rejects.toThrow('无效的实体ID');
  });

  it('returns graph data for query and default cases', async () => {
    executeQuery.mockResolvedValueOnce({
      records: [
        createRecord({
          n: makeNode('1', ['Company'], { company_name: 'Acme' }),
          m: makeNode('2', ['Person'], { person_name: 'Alice' }),
          node: makeNode('9', ['Mystery'], {}),
          r: makeRel('r1', '1', '2', 'REL', null as any)
        })
      ]
    });

    const searchResult = await neo4jGraphService.getGraphData('query', 2);
    const [searchQuery] = executeQuery.mock.calls[0];
    expect(searchQuery).toContain('WHERE ANY(prop IN keys(n)');
    expect(searchResult.nodes).toHaveLength(3);
    expect(searchResult.edges).toHaveLength(1);

    executeQuery.mockResolvedValueOnce({
      records: [
        createRecord({
          n: makeNode('3', ['Organization'], { organization_name: 'Org' }),
          m: makeNode('4', ['Location'], { location_name: 'Beijing' }),
          r: makeRel('r2', '3', '4')
        })
      ]
    });

    const defaultResult = await neo4jGraphService.getGraphData();
    const [defaultQuery] = executeQuery.mock.calls[1];
    expect(defaultQuery).toContain('ORDER BY rand()');
    expect(defaultResult.nodes).toHaveLength(2);
  });

  it('processes overview graph results', async () => {
    executeQuery.mockResolvedValue({
      records: [
        createRecord({
          n: makeNode('10', ['Event'], { event_name: 'Event' }),
          m: makeNode('11', ['News'], { title: 'News' }),
          r: makeRel('r10', '10', '11', 'REL', null as any)
        })
      ]
    });

    const result = await neo4jGraphService.getGraphOverview(1);

    expect(result.nodes).toHaveLength(2);
    expect(result.edges).toHaveLength(1);
  });

  it('handles overview and search errors', async () => {
    executeQuery.mockRejectedValue(new Error('boom'));

    await expect(neo4jGraphService.getGraphOverview()).rejects.toThrow('boom');
    await expect(neo4jGraphService.searchGraph('q')).rejects.toThrow('boom');
  });

  it('fetches entity neighborhood with depth limit', async () => {
    executeQuery.mockResolvedValue({
      records: [
        createRecord({
          source: makeNode('1', ['Company'], { company_name: 'Acme' }),
          target: makeNode('2', ['Person'], { person_name: 'Alice' }),
          r: makeRel('r1', '1', '2')
        })
      ]
    });

    const result = await neo4jGraphService.getEntityNeighborhood('1', 5, 2);

    const [query] = executeQuery.mock.calls[0];
    expect(query).toContain('[*1..3]');
    expect(result.nodes).toHaveLength(2);
    expect(result.edges).toHaveLength(1);
  });

  it('handles entity neighborhood errors', async () => {
    executeQuery.mockRejectedValue(new Error('boom'));

    await expect(neo4jGraphService.getEntityNeighborhood('1')).rejects.toThrow('boom');
  });

  it('gets graph data by node type and handles errors', async () => {
    executeQuery.mockResolvedValueOnce({ records: [] });

    await neo4jGraphService.getGraphByNodeType('Company', 1);
    const [query] = executeQuery.mock.calls[0];
    expect(query).toContain('MATCH (n:Company)');

    executeQuery.mockResolvedValueOnce({ records: [] });
    await neo4jGraphService.getGraphByNodeType('Company');
    expect(executeQuery.mock.calls[1][1]).toEqual({ limit: 100 });

    executeQuery.mockRejectedValueOnce(new Error('boom'));
    await expect(neo4jGraphService.getGraphByNodeType('Company', 1)).rejects.toThrow('boom');
  });

  it('maps hot rank data', async () => {
    const timeRangeSpy = jest
      .spyOn(TimeZoneUtils, 'getRecentDaysRange')
      .mockReturnValue({ startTime: '2024-01-01T00:00:00.000Z', endTime: '2024-01-02T00:00:00.000Z' });

    executeQuery
      .mockResolvedValueOnce({
        records: [
          createRecord({
            newsId: 'news_1',
            title: 'Title',
            content: 'Content',
            level: 'Level 1',
            timestamp: '2024-01-01T00:00:00.000Z',
            source: 'source',
            entityCount: toNeo4jInt(2),
            hotScore: toNeo4jInt(5)
          })
        ]
      })
      .mockResolvedValueOnce({
        records: [
          createRecord({
            eventId: 'event_1',
            eventName: 'Event',
            eventDescription: 'Desc',
            eventType: 'Type',
            newsCount: toNeo4jInt(3),
            levels: ['Level 1']
          })
        ]
      })
      .mockResolvedValueOnce({
        records: [
          createRecord({
            newsDate: '2024-01-01',
            newsCount: toNeo4jInt(4)
          })
        ]
      });

    const result = await neo4jGraphService.getHotRankData(3, 5);

    expect(result.hotNews[0]).toMatchObject({ newsId: 'news_1', hotScore: 5 });
    expect(result.hotEvents[0]).toMatchObject({ eventId: 'event_1', newsCount: 3 });
    expect(result.timeStats[0]).toMatchObject({ date: '2024-01-01', newsCount: 4 });

    timeRangeSpy.mockRestore();
  });

  it('handles hot rank data errors', async () => {
    executeQuery.mockRejectedValue(new Error('boom'));

    await expect(neo4jGraphService.getHotRankData()).rejects.toThrow('boom');
  });

  it('builds news knowledge graph with relationships', async () => {
    executeQuery.mockResolvedValue({
      records: [
        createRecord({
          n: makeNode('n1', ['News'], {}),
          e: makeNode('e1', ['Event'], { event_name: 'Event' }),
          entity1: makeNode('c1', ['Company'], { company_name: 'Acme' }),
          entity2: makeNode('p1', ['Person'], { person_name: 'Alice' }),
          r1: makeRel('r1', 'e1', 'c1', 'REL', undefined as any),
          r2: makeRel('r2', 'c1', 'p1')
        })
      ]
    });

    const result = await neo4jGraphService.getNewsKnowledgeGraph('news_1');

    expect(result.nodes.length).toBe(4);
    expect(result.edges.length).toBe(2);
    expect(result.nodes.find(node => node.id === 'n1')?.name).toBe('News');
    expect(result.edges[0].properties).toEqual({});
  });

  it('handles news knowledge graph errors', async () => {
    executeQuery.mockRejectedValue(new Error('boom'));

    await expect(neo4jGraphService.getNewsKnowledgeGraph('news_1')).rejects.toThrow('boom');
  });

  it('returns company network with and without company name', async () => {
    executeQuery.mockResolvedValue({ records: [] });

    await neo4jGraphService.getCompanyNetwork('Acme', 5);
    await neo4jGraphService.getCompanyNetwork(undefined, 5);

    const firstCall = executeQuery.mock.calls[0][0];
    const secondCall = executeQuery.mock.calls[1][0];
    expect(firstCall).toContain('companyName');
    expect(secondCall).toContain('MATCH (c1:Company)');
  });

  it('handles company network errors', async () => {
    executeQuery.mockRejectedValue(new Error('boom'));

    await expect(neo4jGraphService.getCompanyNetwork('Acme')).rejects.toThrow('boom');
  });

  it('handles graph data errors', async () => {
    executeQuery.mockRejectedValue(new Error('boom'));

    await expect(neo4jGraphService.getGraphData('q')).rejects.toThrow('boom');
  });

  it('returns results for searchGraph', async () => {
    executeQuery.mockResolvedValue({
      records: [
        createRecord({
          node: makeNode('1', ['Company'], { company_name: 'Acme' }),
          connected: makeNode('2', ['Person'], { person_name: 'Alice' }),
          r: makeRel('r1', '1', '2')
        })
      ]
    });

    const result = await neo4jGraphService.searchGraph('query', 2);

    expect(result.nodes).toHaveLength(2);
    expect(result.edges).toHaveLength(1);
  });

  it('falls back to unknown labels in getNodeName', () => {
    const service = neo4jGraphService as any;
    expect(service.getNodeName(makeNode('1', ['Company'], {}))).toBe('Unknown Company');
    expect(service.getNodeName(makeNode('1', ['Person'], {}))).toBe('Unknown Person');
    expect(service.getNodeName(makeNode('1', ['Organization'], {}))).toBe('Unknown Organization');
    expect(service.getNodeName(makeNode('1', ['Location'], {}))).toBe('Unknown Location');
    expect(service.getNodeName(makeNode('1', ['Event'], {}))).toBe('Unknown Event');
    expect(service.getNodeName(makeNode('1', ['News'], {}))).toBe('Unknown News');
  });
});
