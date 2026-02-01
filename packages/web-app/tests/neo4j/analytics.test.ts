const executeQuery = jest.fn();
const isConnected = jest.fn(() => true);

jest.mock('../../src/lib/neo4j/connection', () => ({
  neo4jConnection: {
    executeQuery,
    isConnected
  }
}));

import { neo4jAnalyticsService } from '../../src/lib/neo4j/analytics';
import { TimeZoneUtils } from '../../src/lib/utils/timezone';

const createRecord = (data: Record<string, any>) => ({
  get: (key: string) => data[key]
});

const toNeo4jInt = (value: number) => ({
  toNumber: () => value
});

describe('neo4j/analytics', () => {
  beforeEach(() => {
    executeQuery.mockReset();
    isConnected.mockClear();
  });

  it('maps time stats results with UTC conversion', async () => {
    const toUTCSpy = jest
      .spyOn(TimeZoneUtils, 'toUTC')
      .mockImplementation((value: any) => `${String(value)}-utc`);

    executeQuery.mockResolvedValue({
      records: [
        createRecord({
          newsDate: '2024-01-01',
          dailyCount: toNeo4jInt(2),
          highLevelCount: toNeo4jInt(1)
        })
      ]
    });

    const result = await neo4jAnalyticsService.getNewsTimeStats('start', 'end');

    expect(toUTCSpy).toHaveBeenCalledWith('start');
    expect(toUTCSpy).toHaveBeenCalledWith('end');
    expect(executeQuery).toHaveBeenCalledWith(expect.any(String), {
      startTime: 'start-utc',
      endTime: 'end-utc'
    });
    expect(result).toEqual({
      timeStats: [
        {
          date: '2024-01-01',
          dailyCount: 2,
          highLevelCount: 1
        }
      ],
      summary: {
        totalDays: 1,
        totalNews: 2,
        totalHighLevel: 1
      }
    });

    toUTCSpy.mockRestore();
  });

  it('returns empty database stats when no records', async () => {
    executeQuery.mockResolvedValueOnce({ records: [] });
    isConnected.mockReturnValue(true);

    const result = await neo4jAnalyticsService.getDatabaseStats();

    expect(result).toMatchObject({ totalNodes: 0, relationships: 0, connected: true });
  });

  it('returns database stats using simple stats', async () => {
    const simpleSpy = jest
      .spyOn(neo4jAnalyticsService, 'getSimpleStats')
      .mockResolvedValue({ totalNodes: 5, relationships: 2, news: 1 });

    executeQuery.mockResolvedValueOnce({ records: [createRecord({ totalNodes: toNeo4jInt(5) })] });
    isConnected.mockReturnValue(true);

    const result = await neo4jAnalyticsService.getDatabaseStats();

    expect(simpleSpy).toHaveBeenCalled();
    expect(result).toMatchObject({ totalNodes: 5, relationships: 2, news: 1, connected: true });

    simpleSpy.mockRestore();
  });

  it('maps simple stats values', async () => {
    executeQuery.mockResolvedValue({
      records: [
        createRecord({
          totalNodes: toNeo4jInt(5),
          relationships: toNeo4jInt(2),
          news: toNeo4jInt(1),
          companies: toNeo4jInt(1),
          persons: toNeo4jInt(1),
          organizations: toNeo4jInt(1),
          locations: toNeo4jInt(1),
          events: toNeo4jInt(0)
        })
      ]
    });

    const result = await neo4jAnalyticsService.getSimpleStats();

    expect(result).toMatchObject({ totalNodes: 5, relationships: 2, news: 1 });
  });

  it('maps news level distribution', async () => {
    executeQuery.mockResolvedValue({
      records: [
        createRecord({ level: 'Level 1', count: toNeo4jInt(2) }),
        createRecord({ level: null, count: toNeo4jInt(1) })
      ]
    });

    const result = await neo4jAnalyticsService.getNewsLevelDistribution();

    expect(result.total).toBe(3);
    expect(result.distribution[1].level).toBe('Unknown');
  });

  it('maps entity connectivity stats', async () => {
    executeQuery.mockResolvedValue({
      records: [
        createRecord({
          entityType: 'Company',
          company_name: 'Acme',
          connections: toNeo4jInt(5)
        }),
        createRecord({
          entityType: 'Person',
          person_name: 'Alice',
          connections: toNeo4jInt(3)
        })
      ]
    });

    const result = await neo4jAnalyticsService.getEntityConnectivityStats(2);

    expect(result).toEqual([
      { entityType: 'Company', entityName: 'Acme', connections: 5 },
      { entityType: 'Person', entityName: 'Alice', connections: 3 }
    ]);
  });

  it('maps entity connectivity stats with missing name fields', async () => {
    executeQuery.mockResolvedValue({
      records: [
        createRecord({ entityType: 'Company', company_name: undefined, connections: toNeo4jInt(1) }),
        createRecord({ entityType: 'Person', person_name: undefined, connections: toNeo4jInt(1) }),
        createRecord({ entityType: 'Organization', organization_name: undefined, connections: toNeo4jInt(1) }),
        createRecord({ entityType: 'Location', location_name: undefined, connections: toNeo4jInt(1) }),
        createRecord({ entityType: 'Event', event_name: undefined, connections: toNeo4jInt(1) })
      ]
    });

    const result = await neo4jAnalyticsService.getEntityConnectivityStats(5);

    expect(result[0].entityName).toBe('');
    expect(result[4].entityName).toBe('');
  });

  it('maps entity type distribution', async () => {
    executeQuery
      .mockResolvedValueOnce({ records: [createRecord({ count: toNeo4jInt(2) })] })
      .mockResolvedValueOnce({ records: [createRecord({ count: toNeo4jInt(1) })] })
      .mockResolvedValueOnce({ records: [createRecord({ count: toNeo4jInt(0) })] })
      .mockResolvedValueOnce({ records: [createRecord({ count: toNeo4jInt(1) })] })
      .mockResolvedValueOnce({ records: [createRecord({ count: toNeo4jInt(0) })] });

    const result = await neo4jAnalyticsService.getEntityTypeDistribution();

    expect(result.total).toBe(4);
    expect(result.distribution[0].percentage).toBe('50.0');
  });

  it('defaults entity type counts to zero when records are missing', async () => {
    executeQuery
      .mockResolvedValueOnce({ records: [] })
      .mockResolvedValueOnce({ records: [] })
      .mockResolvedValueOnce({ records: [] })
      .mockResolvedValueOnce({ records: [] })
      .mockResolvedValueOnce({ records: [] });

    const result = await neo4jAnalyticsService.getEntityTypeDistribution();

    expect(result.total).toBe(0);
    expect(result.distribution[0].count).toBe(0);
  });

  it('maps relationship type stats', async () => {
    executeQuery.mockResolvedValue({
      records: [
        createRecord({ relationshipType: 'REL', count: toNeo4jInt(3) }),
        createRecord({ relationshipType: 'REL2', count: toNeo4jInt(1) })
      ]
    });

    const result = await neo4jAnalyticsService.getRelationshipTypeStats();

    expect(result.total).toBe(4);
    expect(result.relationships[0]).toMatchObject({ type: 'REL', count: 3 });
  });

  it('maps data growth trend', async () => {
    executeQuery.mockResolvedValue({
      records: [
        createRecord({ createdDate: '2024-01-01', nodeType: 'Company', count: toNeo4jInt(2) }),
        createRecord({ createdDate: '2024-01-01', nodeType: 'Person', count: toNeo4jInt(1) })
      ]
    });

    const result = await neo4jAnalyticsService.getDataGrowthTrend(2);

    expect(result.summary.totalNodes).toBe(3);
    expect(result.trend[0]).toMatchObject({ date: '2024-01-01', Company: 2, Person: 1 });
  });

  it('maps relationship distribution', async () => {
    executeQuery.mockResolvedValue({
      records: [
        createRecord({ relationType: 'REL', count: toNeo4jInt(2) }),
        createRecord({ relationType: 'REL2', count: toNeo4jInt(1) })
      ]
    });

    const result = await neo4jAnalyticsService.getRelationshipDistribution();

    expect(result).toEqual({ REL: 2, REL2: 1 });
  });

  it('returns error result when database stats query fails', async () => {
    executeQuery.mockRejectedValue(new Error('db down'));
    isConnected.mockReturnValue(false);

    const result = await neo4jAnalyticsService.getDatabaseStats();

    expect(result).toMatchObject({ error: 'db down', connected: false });
  });

  it('returns empty simple stats when no records', async () => {
    executeQuery.mockResolvedValue({ records: [] });

    const result = await neo4jAnalyticsService.getSimpleStats();

    expect(result).toEqual({
      totalNodes: 0,
      relationships: 0,
      news: 0,
      companies: 0,
      persons: 0,
      organizations: 0,
      locations: 0,
      events: 0
    });
  });

  it('maps entity connectivity stats for multiple types', async () => {
    executeQuery.mockResolvedValue({
      records: [
        createRecord({
          entityType: 'Organization',
          organization_name: 'Org',
          connections: toNeo4jInt(2)
        }),
        createRecord({
          entityType: 'Location',
          location_name: 'Beijing',
          connections: toNeo4jInt(1)
        }),
        createRecord({
          entityType: 'Event',
          event_name: 'Event',
          connections: toNeo4jInt(4)
        })
      ]
    });

    const result = await neo4jAnalyticsService.getEntityConnectivityStats(3);

    expect(result).toEqual([
      { entityType: 'Organization', entityName: 'Org', connections: 2 },
      { entityType: 'Location', entityName: 'Beijing', connections: 1 },
      { entityType: 'Event', entityName: 'Event', connections: 4 }
    ]);
  });

  it('handles zero totals in distributions', async () => {
    executeQuery
      .mockResolvedValueOnce({ records: [createRecord({ count: toNeo4jInt(0) })] })
      .mockResolvedValueOnce({ records: [createRecord({ count: toNeo4jInt(0) })] })
      .mockResolvedValueOnce({ records: [createRecord({ count: toNeo4jInt(0) })] })
      .mockResolvedValueOnce({ records: [createRecord({ count: toNeo4jInt(0) })] })
      .mockResolvedValueOnce({ records: [createRecord({ count: toNeo4jInt(0) })] });

    const entityDistribution = await neo4jAnalyticsService.getEntityTypeDistribution();

    expect(entityDistribution.total).toBe(0);
    expect(entityDistribution.distribution[0].percentage).toBe('0.0');

    executeQuery.mockResolvedValue({
      records: [createRecord({ relationshipType: 'REL', count: toNeo4jInt(0) })]
    });

    const relationshipStats = await neo4jAnalyticsService.getRelationshipTypeStats();

    expect(relationshipStats.relationships[0].percentage).toBe('0.0');
  });

  it('maps time stats with hourly and daily records', async () => {
    const getTodayRangeSpy = jest
      .spyOn(TimeZoneUtils, 'getTodayRange')
      .mockReturnValue({ startTime: '2024-01-01T00:00:00.000Z', endTime: '2024-01-01T23:59:59.000Z' });
    const getRecentRangeSpy = jest
      .spyOn(TimeZoneUtils, 'getRecentDaysRange')
      .mockReturnValue({ startTime: '2023-12-26T00:00:00.000Z', endTime: '2024-01-01T23:59:59.000Z' });

    executeQuery
      .mockResolvedValueOnce({
        records: [
          createRecord({ timestamp: '2024-01-01T00:00:00.000Z', level: 'Level 1' })
        ]
      })
      .mockResolvedValueOnce({
        records: [
          createRecord({
            hour: toNeo4jInt(8),
            newsCount: toNeo4jInt(3),
            highLevelCount: toNeo4jInt(1),
            time: '08:00'
          })
        ]
      })
      .mockResolvedValueOnce({
        records: [
          createRecord({
            date: '2024-01-01',
            dateDisplay: '2024-01-01',
            newsCount: toNeo4jInt(2),
            highLevelCount: toNeo4jInt(1)
          })
        ]
      });

    const result = await neo4jAnalyticsService.getTimeStats();

    expect(result.todayHourly[0]).toMatchObject({ hour: 8, newsCount: 3, highLevelCount: 1 });
    expect(result.daily[0]).toMatchObject({ date: '2024-01-01', newsCount: 2 });
    expect(result.metadata).toHaveProperty('todayStart');

    getTodayRangeSpy.mockRestore();
    getRecentRangeSpy.mockRestore();
  });

  it('throws on analytics query failures', async () => {
    executeQuery.mockRejectedValueOnce(new Error('boom'));
    await expect(neo4jAnalyticsService.getSimpleStats()).rejects.toThrow('boom');

    executeQuery.mockRejectedValueOnce(new Error('boom'));
    await expect(neo4jAnalyticsService.getNewsLevelDistribution()).rejects.toThrow('boom');

    executeQuery.mockRejectedValueOnce(new Error('boom'));
    await expect(neo4jAnalyticsService.getEntityConnectivityStats()).rejects.toThrow('boom');

    executeQuery.mockRejectedValueOnce(new Error('boom'));
    await expect(
      neo4jAnalyticsService.getNewsTimeStats('2024-01-01T00:00:00.000Z', '2024-01-02T00:00:00.000Z')
    ).rejects.toThrow('boom');

    executeQuery.mockRejectedValueOnce(new Error('boom'));
    await expect(neo4jAnalyticsService.getEntityTypeDistribution()).rejects.toThrow('boom');

    executeQuery.mockRejectedValueOnce(new Error('boom'));
    await expect(neo4jAnalyticsService.getRelationshipTypeStats()).rejects.toThrow('boom');

    executeQuery.mockRejectedValueOnce(new Error('boom'));
    await expect(neo4jAnalyticsService.getDataGrowthTrend()).rejects.toThrow('boom');

    executeQuery.mockRejectedValueOnce(new Error('boom'));
    await expect(neo4jAnalyticsService.getRelationshipDistribution()).rejects.toThrow('boom');

    executeQuery.mockRejectedValueOnce(new Error('boom'));
    await expect(neo4jAnalyticsService.getTimeStats()).rejects.toThrow('boom');
  });
});
