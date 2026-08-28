const executeQuery = jest.fn();

jest.mock('../../src/lib/neo4j/connection', () => ({
  neo4jConnection: {
    executeQuery
  }
}));

import { neo4jNewsService } from '../../src/lib/neo4j/news';
import { TimeZoneUtils } from '../../src/lib/utils/timezone';

const createRecord = (data: Record<string, any>) => ({
  get: (key: string) => data[key]
});

const toNeo4jInt = (value: number) => ({
  toNumber: () => value
});

describe('neo4j/news', () => {
  beforeEach(() => {
    executeQuery.mockReset();
  });

  it('builds list query with normalized level and processedAt sorting', async () => {
    executeQuery.mockImplementation((cypher: string) => {
      if (cypher.includes('count(n) as total')) {
        return Promise.resolve({
          records: [createRecord({ total: toNeo4jInt(1) })]
        });
      }

      return Promise.resolve({
        records: [
          createRecord({
            id: 'news_1',
            title: 'Title',
            content: 'Content',
            level: 'Level 1',
            timestamp: '2024-01-01T00:00:00.000Z',
            processedAt: toNeo4jInt(1700000000000),
            source: 'source',
            url: 'http://example.com'
          })
        ]
      });
    });

    const result = await neo4jNewsService.getNewsWithPagination({
      page: 2,
      limit: 10,
      startTime: '2024-01-01T00:00:00.000Z',
      endTime: '2024-01-02T00:00:00.000Z',
      keyword: 'boom',
      level: '1',
      sortBy: 'processedAt',
      sortOrder: 'asc'
    });

    expect(executeQuery).toHaveBeenCalledTimes(2);

    const [query, params] = executeQuery.mock.calls[0];
    expect(query).toContain('n.news_level = $level');
    expect(query).toContain('ORDER BY n.processedAt ASC');
    expect(params).toMatchObject({
      startTime: '2024-01-01T00:00:00.000Z',
      endTime: '2024-01-02T00:00:00.000Z',
      keyword: 'boom',
      level: 'Level 1',
      limit: 10,
      offset: 10
    });

    expect(result.news).toHaveLength(1);
    expect(result.news[0].processedAt).toBe(1700000000000);
    expect(result.total).toBe(1);
  });

  it('builds search query with keyword, level, and sorting', async () => {
    executeQuery.mockImplementation((cypher: string) => {
      if (cypher.includes('count(n) as total')) {
        return Promise.resolve({
          records: [createRecord({ total: toNeo4jInt(1) })]
        });
      }

      return Promise.resolve({
        records: [
          createRecord({
            id: 'news_2',
            title: 'Title',
            content: 'Content',
            level: 'Level 2',
            timestamp: '2024-01-02T00:00:00.000Z',
            processedAt: toNeo4jInt(1700000001000),
            source: 'source',
            url: 'http://example.com',
            relevanceScore: 2
          })
        ]
      });
    });

    const result = await neo4jNewsService.searchNews({
      keyword: 'market',
      page: 1,
      limit: 5,
      level: 'Level 2',
      searchFields: 'title',
      sortBy: 'timestamp'
    });

    const [query, params] = executeQuery.mock.calls[0];
    expect(query).toContain('toLower(n.title) CONTAINS toLower($keyword)');
    expect(query).toContain('ORDER BY n.timestamp DESC');
    expect(params).toMatchObject({
      keyword: 'market',
      level: 'Level 2',
      limit: 5,
      offset: 0
    });

    expect(result.news).toHaveLength(1);
    expect(result.total).toBe(1);
  });

  it('returns empty stats for time range queries', async () => {
    const toUTCSpy = jest
      .spyOn(TimeZoneUtils, 'toUTC')
      .mockImplementation((value: any) => String(value));
    executeQuery.mockResolvedValue({ records: [] });

    const result = await neo4jNewsService.getNewsInTimeRange(
      '2024-01-01T00:00:00.000Z',
      '2024-01-02T00:00:00.000Z'
    );

    expect(result.news_count).toBe(0);
    expect(toUTCSpy).toHaveBeenCalled();
    expect(executeQuery).toHaveBeenCalledTimes(2);
    toUTCSpy.mockRestore();
  });

  it('falls back to processedAt when the news timestamp query is empty', async () => {
    const toUTCSpy = jest
      .spyOn(TimeZoneUtils, 'toUTC')
      .mockImplementation((value: any) => String(value));
    const emptyRecord = createRecord({
      news_count: toNeo4jInt(0)
    });
    const fallbackRecord = createRecord({
      news_count: toNeo4jInt(1),
      event_count: toNeo4jInt(0),
      high_level_count: toNeo4jInt(0),
      critical_count: toNeo4jInt(0),
      companies: [],
      persons: [],
      organizations: [],
      locations: [],
      news_items: [{ title: 'Fallback news' }]
    });
    executeQuery
      .mockResolvedValueOnce({ records: [emptyRecord] })
      .mockResolvedValueOnce({ records: [fallbackRecord] });

    const result = await neo4jNewsService.getNewsInTimeRange(
      '2024-01-01T00:00:00.000Z',
      '2024-01-02T00:00:00.000Z'
    );

    expect(executeQuery).toHaveBeenCalledTimes(2);
    const [fallbackQuery, fallbackParams] = executeQuery.mock.calls[1];
    expect(fallbackQuery).toContain(
      'n.processedAt >= $processedStartTime AND n.processedAt < $processedEndTime'
    );
    expect(fallbackParams).toEqual({
      processedStartTime: Date.parse('2024-01-01T00:00:00.000Z'),
      processedEndTime: Date.parse('2024-01-02T00:00:00.000Z')
    });
    expect(result.news_count).toBe(1);
    expect(result.news_items).toEqual([{ title: 'Fallback news' }]);

    toUTCSpy.mockRestore();
  });

  it('maps time range stats results', async () => {
    const toUTCSpy = jest
      .spyOn(TimeZoneUtils, 'toUTC')
      .mockImplementation((value: any) => `${String(value)}-utc`);
    executeQuery.mockResolvedValue({
      records: [
        createRecord({
          news_count: toNeo4jInt(2),
          event_count: toNeo4jInt(1),
          high_level_count: toNeo4jInt(1),
          critical_count: toNeo4jInt(1),
          companies: ['Company A', null],
          persons: ['Person A'],
          organizations: ['Org'],
          locations: ['Loc'],
          news_items: [{ title: 'Title' }, { title: null }]
        })
      ]
    });

    const result = await neo4jNewsService.getNewsInTimeRange('start', 'end');

    expect(result.news_count).toBe(2);
    expect(result.companies).toEqual(['Company A']);
    expect(result.news_items).toHaveLength(1);

    toUTCSpy.mockRestore();
  });

  it('maps high level news results', async () => {
    const toUTCSpy = jest
      .spyOn(TimeZoneUtils, 'toUTC')
      .mockImplementation((value: any) => `${String(value)}-utc`);
    executeQuery.mockResolvedValue({
      records: [
        createRecord({
          newsId: 'news_1',
          title: 'Title',
          content: 'Content',
          level: 'Level 1',
          timestamp: '2024-01-01T00:00:00.000Z',
          source: 'source',
          url: 'http://example.com',
          companies: ['Company A'],
          persons: ['Person A'],
          organizations: [],
          events: ['Event'],
          event_levels: ['Level 1']
        })
      ]
    });

    const result = await neo4jNewsService.getHighLevelNews('start', 'end');

    expect(result[0]).toMatchObject({ newsId: 'news_1', title: 'Title' });
    expect(toUTCSpy).toHaveBeenCalled();

    toUTCSpy.mockRestore();
  });

  it('handles pagination defaults without filters', async () => {
    executeQuery.mockImplementation((cypher: string) => {
      if (cypher.includes('count(n) as total')) {
        return Promise.resolve({ records: [] });
      }

      return Promise.resolve({
        records: [
          createRecord({
            id: 'news_3',
            title: 'Title',
            content: 'Content',
            level: 'Level 3',
            timestamp: '2024-01-03T00:00:00.000Z',
            processedAt: 1700000003000,
            source: 'source',
            url: null
          })
        ]
      });
    });

    const result = await neo4jNewsService.getNewsWithPagination({});

    const [query, params] = executeQuery.mock.calls[0];
    expect(query).toContain('ORDER BY n.timestamp DESC');
    expect(query).not.toContain('WHERE n.news_level');
    expect(params).toMatchObject({ limit: 20, offset: 0 });
    expect(result.total).toBe(0);
    expect(result.news[0].processedAt).toBe(1700000003000);
  });

  it('normalizes custom level strings', async () => {
    executeQuery.mockImplementation((cypher: string) => {
      if (cypher.includes('count(n) as total')) {
        return Promise.resolve({
          records: [createRecord({ total: toNeo4jInt(0) })]
        });
      }

      return Promise.resolve({ records: [] });
    });

    await neo4jNewsService.getNewsWithPagination({
      level: 'Urgent',
      sortOrder: 'desc'
    });

    const [, params] = executeQuery.mock.calls[0];
    expect(params.level).toBe('Urgent');
  });

  it('searches by content and sorts by processedAt', async () => {
    executeQuery.mockImplementation((cypher: string) => {
      if (cypher.includes('count(n) as total')) {
        return Promise.resolve({
          records: [createRecord({ total: toNeo4jInt(2) })]
        });
      }

      return Promise.resolve({
        records: [
          createRecord({
            id: 'news_4',
            title: 'Market update',
            content: 'content with keyword',
            level: 'Level 2',
            timestamp: '2024-01-04T00:00:00.000Z',
            processedAt: 1700000004000,
            source: 'source',
            url: 'http://example.com',
            relevanceScore: 1
          })
        ]
      });
    });

    const result = await neo4jNewsService.searchNews({
      keyword: 'keyword',
      searchFields: 'content',
      sortBy: 'processedAt'
    });

    const [query] = executeQuery.mock.calls[0];
    expect(query).toContain('toLower(n.content) CONTAINS toLower($keyword)');
    expect(query).toContain('ORDER BY n.processedAt DESC');
    expect(result.total).toBe(2);
    expect(result.news[0].highlightedContent).toContain('<mark>keyword</mark>');
  });

  it('searches with relevance ordering and handles empty content', async () => {
    executeQuery.mockImplementation((cypher: string) => {
      if (cypher.includes('count(n) as total')) {
        return Promise.resolve({
          records: [createRecord({ total: toNeo4jInt(1) })]
        });
      }

      return Promise.resolve({
        records: [
          createRecord({
            id: 'news_5',
            title: 'A+B insight',
            content: null,
            level: 'Level 1',
            timestamp: '2024-01-05T00:00:00.000Z',
            processedAt: toNeo4jInt(1700000005000),
            source: 'source',
            url: 'http://example.com',
            relevanceScore: 2
          })
        ]
      });
    });

    const result = await neo4jNewsService.searchNews({
      keyword: 'A+B'
    });

    const [query] = executeQuery.mock.calls[0];
    expect(query).toContain('CASE WHEN toLower(n.title) CONTAINS toLower($keyword)');
    expect(result.news[0].highlightedTitle).toContain('<mark>A+B</mark>');
    expect(result.news[0].highlightedContent).toBe('');
  });

  it('handles empty keyword and missing fields in search results', async () => {
    executeQuery.mockImplementation((cypher: string) => {
      if (cypher.includes('count(n) as total')) {
        return Promise.resolve({ records: [] });
      }

      return Promise.resolve({
        records: [
          createRecord({
            id: 'news_6',
            title: null,
            content: null,
            level: 'Level 3',
            timestamp: '2024-01-06T00:00:00.000Z',
            processedAt: null,
            source: 'source',
            url: null,
            relevanceScore: 0
          })
        ]
      });
    });

    const result = await neo4jNewsService.searchNews({ keyword: '' });

    expect(result.total).toBe(0);
    expect(result.news[0].highlightedTitle).toBe('');
    expect(result.news[0].highlightedContent).toBe('');
  });

  it('applies time filters and throws on search errors', async () => {
    executeQuery.mockRejectedValue(new Error('boom'));

    await expect(
      neo4jNewsService.searchNews({
        keyword: 'market',
        startTime: '2024-01-01T00:00:00.000Z',
        endTime: '2024-01-02T00:00:00.000Z',
        level: 'Level 1'
      })
    ).rejects.toThrow('boom');
  });

  it('maps news entities and filters unnamed entries', async () => {
    const makeEntity = (id: string, labels: string[], props: Record<string, any>) => ({
      identity: { toString: () => id },
      labels,
      properties: props
    });

    executeQuery.mockResolvedValue({
      records: [
        createRecord({
          entity: makeEntity('1', ['Company'], { company_name: 'Acme' }),
          entityLabels: ['Company'],
          relationType: 'REL'
        }),
        createRecord({
          entity: makeEntity('2', ['Person'], { person_name: 'Alice' }),
          entityLabels: ['Person'],
          relationType: 'REL'
        }),
        createRecord({
          entity: makeEntity('3', ['Organization'], { organization_name: 'Org' }),
          entityLabels: ['Organization'],
          relationType: 'REL'
        }),
        createRecord({
          entity: makeEntity('4', ['Location'], { location_name: 'Beijing' }),
          entityLabels: ['Location'],
          relationType: 'REL'
        }),
        createRecord({
          entity: makeEntity('5', ['Event'], { event_name: 'Event' }),
          entityLabels: ['Event'],
          relationType: 'REL'
        })
      ]
    });

    const result = await neo4jNewsService.getNewsEntities('news_1');

    expect(result).toHaveLength(4);
    expect(result.map(item => item.name)).toEqual(['Acme', 'Alice', 'Org', 'Beijing']);
  });

  it('returns empty entities on error', async () => {
    executeQuery.mockRejectedValue(new Error('boom'));

    const result = await neo4jNewsService.getNewsEntities('news_2');

    expect(result).toEqual([]);
  });

  it('throws on time range queries when neo4j fails', async () => {
    executeQuery.mockRejectedValue(new Error('boom'));

    await expect(
      neo4jNewsService.getNewsInTimeRange('2024-01-01T00:00:00.000Z', '2024-01-02T00:00:00.000Z')
    ).rejects.toThrow('boom');
  });

  it('throws on high level queries when neo4j fails', async () => {
    executeQuery.mockRejectedValue(new Error('boom'));

    await expect(
      neo4jNewsService.getHighLevelNews('2024-01-01T00:00:00.000Z', '2024-01-02T00:00:00.000Z')
    ).rejects.toThrow('boom');
  });

  it('throws on pagination queries when neo4j fails', async () => {
    executeQuery.mockRejectedValue(new Error('boom'));

    await expect(neo4jNewsService.getNewsWithPagination({})).rejects.toThrow('boom');
  });

  it('deduplicates historical news by id', async () => {
    executeQuery
      .mockResolvedValueOnce({
        records: [
          createRecord({
            id: 'news_1',
            title: 'Title A',
            content: 'Content A',
            level: 'Level 1',
            timestamp: '2024-01-01T00:00:00.000Z',
            relationType: 'REL'
          })
        ]
      })
      .mockResolvedValueOnce({
        records: [
          createRecord({
            id: 'news_1',
            title: 'Title A',
            content: 'Content A',
            level: 'Level 1',
            timestamp: '2024-01-01T00:00:00.000Z',
            relationType: 'REL'
          })
        ]
      });

    const result = await neo4jNewsService.getHistoricalNewsByEntities(
      [
        { name: 'Entity A', type: 'Company' },
        { name: 'Entity B', type: 'Person' }
      ],
      '2024-01-01T00:00:00.000Z',
      '2024-01-02T00:00:00.000Z'
    );

    expect(result).toHaveLength(1);
    expect(['Entity A', 'Entity B']).toContain(result[0].relatedEntity);
  });

  it('returns empty historical news on error', async () => {
    executeQuery.mockRejectedValue(new Error('boom'));

    const result = await neo4jNewsService.getHistoricalNewsByEntities(
      [{ name: 'Entity A', type: 'Company' }],
      '2024-01-01T00:00:00.000Z',
      '2024-01-02T00:00:00.000Z'
    );

    expect(result).toEqual([]);
  });

  it('returns empty historical news when entities list is empty', async () => {
    const result = await neo4jNewsService.getHistoricalNewsByEntities(
      [],
      '2024-01-01T00:00:00.000Z',
      '2024-01-02T00:00:00.000Z'
    );

    expect(result).toEqual([]);
    expect(executeQuery).not.toHaveBeenCalled();
  });
});
