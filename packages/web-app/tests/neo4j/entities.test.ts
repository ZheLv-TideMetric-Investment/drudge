const executeQuery = jest.fn();

jest.mock('../../src/lib/neo4j/connection', () => ({
  neo4jConnection: {
    executeQuery
  }
}));

import { neo4jEntitiesService } from '../../src/lib/neo4j/entities';

const createRecord = (data: Record<string, any>) => ({
  get: (key: string) => data[key]
});

const toNeo4jInt = (value: number) => ({
  toNumber: () => value
});

const makeEntity = (id: string, labels: string[], properties: Record<string, any>) => ({
  identity: { toString: () => id },
  labels,
  properties
});

describe('neo4j/entities', () => {
  beforeEach(() => {
    executeQuery.mockReset();
  });

  it('searches company entities with search term', async () => {
    executeQuery.mockResolvedValue({
      records: [
        createRecord({
          entity: makeEntity('1', ['Company'], { company_name: 'Acme' }),
          type: 'Company',
          name: 'Acme',
          connections: toNeo4jInt(2)
        })
      ]
    });

    const result = await neo4jEntitiesService.searchEntities('Acme', 'company', 5);

    const [query, params] = executeQuery.mock.calls[0];
    expect(query).toContain('MATCH (c:Company)');
    expect(query).toContain('CONTAINS $searchTerm');
    expect(params).toMatchObject({ searchTerm: 'Acme', limit: 5 });
    expect(result[0]).toMatchObject({ name: 'Acme', type: 'Company', connections: 2 });
  });

  it('searches event entities without search term', async () => {
    executeQuery.mockResolvedValue({
      records: [
        createRecord({
          entity: makeEntity('9', ['Event'], { event_name: 'Event' }),
          type: 'Event',
          name: 'Event',
          connections: toNeo4jInt(1)
        })
      ]
    });

    const result = await neo4jEntitiesService.searchEntities('   ', 'event', 3);

    const [query, params] = executeQuery.mock.calls[0];
    expect(query).toContain('MATCH (e:Event)');
    expect(query).not.toContain('event_description CONTAINS');
    expect(params).toMatchObject({ limit: 3 });
    expect(result).toHaveLength(1);
  });

  it('searches event entities with search term', async () => {
    executeQuery.mockResolvedValue({
      records: [
        createRecord({
          entity: makeEntity('9', ['Event'], { event_name: 'Event' }),
          type: 'Event',
          name: 'Event',
          connections: toNeo4jInt(1)
        })
      ]
    });

    const result = await neo4jEntitiesService.searchEntities('Event', 'event', 2);

    const [query, params] = executeQuery.mock.calls[0];
    expect(query).toContain('event_description CONTAINS $searchTerm');
    expect(params).toMatchObject({ searchTerm: 'Event', limit: 2 });
    expect(result).toHaveLength(1);
  });

  it('searches entities without search term for common types', async () => {
    executeQuery
      .mockResolvedValueOnce({
        records: [
          createRecord({
            entity: makeEntity('1', ['Company'], { company_name: 'Acme' }),
            type: 'Company',
            name: 'Acme',
            connections: toNeo4jInt(1)
          })
        ]
      })
      .mockResolvedValueOnce({
        records: [
          createRecord({
            entity: makeEntity('2', ['Organization'], { organization_name: 'Org' }),
            type: 'Organization',
            name: 'Org',
            connections: toNeo4jInt(1)
          })
        ]
      })
      .mockResolvedValueOnce({
        records: [
          createRecord({
            entity: makeEntity('3', ['Person'], { person_name: 'Alice' }),
            type: 'Person',
            name: 'Alice',
            connections: toNeo4jInt(1)
          })
        ]
      })
      .mockResolvedValueOnce({
        records: [
          createRecord({
            entity: makeEntity('4', ['Location'], { location_name: 'Beijing' }),
            type: 'Location',
            name: 'Beijing',
            connections: toNeo4jInt(1)
          })
        ]
      });

    await neo4jEntitiesService.searchEntities('', 'company');
    await neo4jEntitiesService.searchEntities('', 'organization');
    await neo4jEntitiesService.searchEntities('', 'person');
    await neo4jEntitiesService.searchEntities('', 'location');

    const [companyQuery, companyParams] = executeQuery.mock.calls[0];
    expect(companyQuery).not.toContain('CONTAINS $searchTerm');
    expect(companyParams).toMatchObject({ limit: 20 });
  });

  it('searches organization, person, and location nodes', async () => {
    executeQuery
      .mockResolvedValueOnce({
        records: [
          createRecord({
            entity: makeEntity('1', ['Organization'], { organization_name: 'Org' }),
            type: 'Organization',
            name: 'Org',
            connections: toNeo4jInt(1)
          })
        ]
      })
      .mockResolvedValueOnce({
        records: [
          createRecord({
            entity: makeEntity('2', ['Person'], { person_name: 'Alice' }),
            type: 'Person',
            name: 'Alice',
            connections: toNeo4jInt(2)
          })
        ]
      })
      .mockResolvedValueOnce({
        records: [
          createRecord({
            entity: makeEntity('3', ['Location'], { location_name: 'Beijing' }),
            type: 'Location',
            name: 'Beijing',
            connections: toNeo4jInt(3)
          })
        ]
      });

    const orgResult = await neo4jEntitiesService.searchEntities('Org', 'organization');
    const personResult = await neo4jEntitiesService.searchEntities('Alice', 'person');
    const locResult = await neo4jEntitiesService.searchEntities('Beijing', 'location');

    expect(orgResult[0].type).toBe('Organization');
    expect(personResult[0].type).toBe('Person');
    expect(locResult[0].type).toBe('Location');
  });

  it('throws for unsupported node types', async () => {
    await expect(neo4jEntitiesService.searchEntities('test', 'unknown')).rejects.toThrow(
      '不支持的节点类型'
    );
  });

  it('searches all entity types and skips failed queries', async () => {
    executeQuery
      .mockResolvedValueOnce({
        records: [
          createRecord({
            entity: makeEntity('1', ['Company'], { company_name: 'Co' }),
            type: 'Company',
            name: 'Co',
            connections: toNeo4jInt(1)
          })
        ]
      })
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce({
        records: [
          createRecord({
            entity: makeEntity('2', ['Person'], { person_name: 'Alice' }),
            type: 'Person',
            name: 'Alice',
            connections: toNeo4jInt(3)
          })
        ]
      })
      .mockResolvedValueOnce({
        records: [
          createRecord({
            entity: makeEntity('3', ['Location'], { location_name: 'Beijing' }),
            type: 'Location',
            name: 'Beijing',
            connections: toNeo4jInt(2)
          })
        ]
      })
      .mockResolvedValueOnce({
        records: [
          createRecord({
            entity: makeEntity('4', ['Event'], { event_name: 'Event' }),
            type: 'Event',
            name: 'Event',
            connections: toNeo4jInt(0)
          })
        ]
      });

    const result = await neo4jEntitiesService.searchEntities('query');

    expect(result[0]).toMatchObject({ name: 'Alice', connections: 3 });
    expect(result).toHaveLength(4);
  });

  it('searches all entity types without search term', async () => {
    executeQuery
      .mockResolvedValueOnce({
        records: [
          createRecord({
            entity: makeEntity('1', ['Company'], { company_name: 'Co' }),
            type: 'Company',
            name: 'Co',
            connections: toNeo4jInt(1)
          })
        ]
      })
      .mockResolvedValueOnce({
        records: []
      })
      .mockResolvedValueOnce({
        records: []
      })
      .mockResolvedValueOnce({
        records: []
      })
      .mockResolvedValueOnce({
        records: []
      });

    const result = await neo4jEntitiesService.searchEntities('');

    const [query, params] = executeQuery.mock.calls[0];
    expect(query).not.toContain('CONTAINS $searchTerm');
    expect(params).toEqual({ limit: 20 });
    expect(result).toHaveLength(1);
  });

  it('throws when search query fails', async () => {
    executeQuery.mockRejectedValue(new Error('boom'));

    await expect(neo4jEntitiesService.searchEntities('Acme', 'company')).rejects.toThrow('boom');
  });

  it('returns most connected entities', async () => {
    executeQuery.mockResolvedValue({
      records: [
        createRecord({ labels: ['Company'], name: 'Acme', newsCount: toNeo4jInt(4) })
      ]
    });

    const result = await neo4jEntitiesService.getMostConnectedEntities(1);

    expect(result).toEqual([
      { labels: ['Company'], name: 'Acme', newsCount: 4 }
    ]);
  });

  it('uses default limits for most connected entities and entity news', async () => {
    executeQuery
      .mockResolvedValueOnce({
        records: [
          createRecord({ labels: ['Company'], name: 'Acme', newsCount: toNeo4jInt(1) })
        ]
      })
      .mockResolvedValueOnce({
        records: [
          createRecord({
            id: 'news_1',
            title: 'Title',
            level: 'Level 1',
            timestamp: '2024-01-01T00:00:00.000Z',
            relationType: 'REL'
          })
        ]
      });

    await neo4jEntitiesService.getMostConnectedEntities();
    await neo4jEntitiesService.getEntityNews('Acme');

    expect(executeQuery.mock.calls[0][1]).toEqual({ limit: 20 });
    expect(executeQuery.mock.calls[1][1]).toEqual({ entityName: 'Acme', limit: 10 });
  });

  it('throws when most connected entities query fails', async () => {
    executeQuery.mockRejectedValue(new Error('boom'));

    await expect(neo4jEntitiesService.getMostConnectedEntities()).rejects.toThrow('boom');
  });

  it('returns entity news', async () => {
    executeQuery.mockResolvedValue({
      records: [
        createRecord({
          id: 'news_1',
          title: 'Title',
          level: 'Level 1',
          timestamp: '2024-01-01T00:00:00.000Z',
          relationType: 'REL'
        })
      ]
    });

    const result = await neo4jEntitiesService.getEntityNews('Acme', 1);

    expect(result[0]).toMatchObject({ id: 'news_1', relationType: 'REL' });
  });

  it('throws when entity news query fails', async () => {
    executeQuery.mockRejectedValue(new Error('boom'));

    await expect(neo4jEntitiesService.getEntityNews('Acme')).rejects.toThrow('boom');
  });

  it('maps similar entities and falls back to name', async () => {
    executeQuery.mockResolvedValue({
      records: [
        createRecord({
          entity: makeEntity('1', ['Company'], { company_name: 'Acme' }),
          similarity: toNeo4jInt(0),
          totalConnections: toNeo4jInt(2)
        }),
        createRecord({
          entity: makeEntity('2', ['Person'], { person_name: 'Alice' }),
          similarity: toNeo4jInt(1),
          totalConnections: toNeo4jInt(3)
        }),
        createRecord({
          entity: makeEntity('3', ['Organization'], { organization_name: 'Org' }),
          similarity: toNeo4jInt(2),
          totalConnections: toNeo4jInt(1)
        }),
        createRecord({
          entity: makeEntity('4', ['Location'], { location_name: 'Beijing' }),
          similarity: toNeo4jInt(3),
          totalConnections: toNeo4jInt(1)
        }),
        createRecord({
          entity: makeEntity('5', ['Event'], { event_name: 'Event' }),
          similarity: toNeo4jInt(4),
          totalConnections: toNeo4jInt(1)
        }),
        createRecord({
          entity: makeEntity('6', ['Unknown'], { name: 'Fallback' }),
          similarity: toNeo4jInt(5),
          totalConnections: toNeo4jInt(1)
        })
      ]
    });

    const result = await neo4jEntitiesService.findSimilarEntities('1', 'Company', 5);

    expect(result[0].entity.name).toBe('Acme');
    expect(result[5].entity.name).toBe('Fallback');
    expect(result[0].score).toBe(0);
  });

  it('uses default limits for similarity and relationships', async () => {
    executeQuery
      .mockResolvedValueOnce({
        records: []
      })
      .mockResolvedValueOnce({
        records: []
      });

    await neo4jEntitiesService.findSimilarEntities('1', 'Company');
    await neo4jEntitiesService.getEntityRelationships('Acme');

    expect(executeQuery.mock.calls[0][1]).toEqual({ entityId: '1', limit: 10 });
    expect(executeQuery.mock.calls[1][1]).toEqual({ entityName: 'Acme', limit: 50 });
  });

  it('falls back to empty name for unknown entities', async () => {
    executeQuery.mockResolvedValue({
      records: [
        createRecord({
          entity: makeEntity('7', ['Unknown'], {}),
          similarity: toNeo4jInt(1),
          totalConnections: toNeo4jInt(1)
        })
      ]
    });

    const result = await neo4jEntitiesService.findSimilarEntities('1', 'Company');

    expect(result[0].entity.name).toBe('');
  });

  it('falls back to empty names when properties missing', async () => {
    executeQuery.mockResolvedValue({
      records: [
        createRecord({
          entity: makeEntity('1', ['Company'], {}),
          similarity: toNeo4jInt(1),
          totalConnections: toNeo4jInt(1)
        }),
        createRecord({
          entity: makeEntity('2', ['Person'], {}),
          similarity: toNeo4jInt(1),
          totalConnections: toNeo4jInt(1)
        }),
        createRecord({
          entity: makeEntity('3', ['Organization'], {}),
          similarity: toNeo4jInt(1),
          totalConnections: toNeo4jInt(1)
        }),
        createRecord({
          entity: makeEntity('4', ['Location'], {}),
          similarity: toNeo4jInt(1),
          totalConnections: toNeo4jInt(1)
        }),
        createRecord({
          entity: makeEntity('5', ['Event'], {}),
          similarity: toNeo4jInt(1),
          totalConnections: toNeo4jInt(1)
        })
      ]
    });

    const result = await neo4jEntitiesService.findSimilarEntities('1', 'Company', 5);

    expect(result[0].entity.name).toBe('');
    expect(result[4].entity.name).toBe('');
  });

  it('returns empty results on similarity query error', async () => {
    executeQuery.mockRejectedValue(new Error('boom'));

    const result = await neo4jEntitiesService.findSimilarEntities('1', 'Company', 5);

    expect(result).toEqual([]);
  });

  it('maps entity relationships and handles errors', async () => {
    executeQuery.mockResolvedValueOnce({
      records: [
        createRecord({
          relationType: 'REL',
          description: 'desc',
          confidence: 0.5,
          inferred: undefined,
          entityLabels: ['Company'],
          entity: { properties: { company_name: 'Acme' } },
          connectedLabels: ['Person'],
          connected: { properties: { person_name: 'Alice' } }
        })
      ]
    });

    const result = await neo4jEntitiesService.getEntityRelationships('Acme', 1);
    expect(result[0].inferred).toBe(false);

    executeQuery.mockRejectedValueOnce(new Error('boom'));
    const errorResult = await neo4jEntitiesService.getEntityRelationships('Acme', 1);
    expect(errorResult).toEqual([]);
  });
});
