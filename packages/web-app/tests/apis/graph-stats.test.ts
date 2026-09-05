import { freezeTime } from '../helpers/fake-time';
import { TimeZoneUtils } from '../../src/lib/utils/timezone';

const neo4jAnalyticsService = {
  getDatabaseStats: jest.fn(),
  getTimeStats: jest.fn(),
  getRelationshipDistribution: jest.fn()
};

const neo4jGraphService = {
  getGraphData: jest.fn()
};

jest.mock('../../src/lib/neo4j', () => ({
  __esModule: true,
  neo4jAnalyticsService,
  neo4jGraphService
}));

describe('api/graph/stats', () => {
  beforeEach(() => {
    neo4jAnalyticsService.getDatabaseStats.mockReset();
    neo4jAnalyticsService.getTimeStats.mockReset();
    neo4jAnalyticsService.getRelationshipDistribution.mockReset().mockResolvedValue({});
    neo4jGraphService.getGraphData.mockReset();
  });

  it('returns graph stats payload', async () => {
    const restoreTime = freezeTime('2024-01-01T00:00:00.000Z');
    const { GET } = await import('../../src/app/api/graph/stats/route');

    neo4jAnalyticsService.getDatabaseStats.mockResolvedValue({ total: 1 });
    neo4jAnalyticsService.getTimeStats.mockResolvedValue({ metadata: { beijing_now: '2024-01-01 08:00:00' } });
    neo4jGraphService.getGraphData.mockResolvedValue({ nodes: [] });

    try {
      const response = await GET();
      const body = await response.json();

      expect(body.success).toBe(true);
      expect(body.data.overview.total).toBe(1);
      expect(body.data.graphStats.nodes).toEqual([]);
      expect(body).toMatchSnapshot();
    } finally {
      restoreTime();
    }
  });

  it('formats time stats fields', async () => {
    const restoreTime = freezeTime('2024-01-01T00:00:00.000Z');
    const { GET } = await import('../../src/app/api/graph/stats/route');

    neo4jAnalyticsService.getDatabaseStats.mockResolvedValue({ total: 2 });
    neo4jAnalyticsService.getTimeStats.mockResolvedValue({
      daily: [{ date: '2024-01-01' }, { dateDisplay: '2024-01-02' }],
      todayHourly: [{ hour: 3 }],
      metadata: {}
    });
    neo4jGraphService.getGraphData.mockResolvedValue({ nodes: [] });

    try {
      const response = await GET();
      const body = await response.json();

      expect(body.success).toBe(true);
      expect(body.data.timeStats.daily[0]).toHaveProperty('date_display');
      expect(body.data.timeStats.daily[1]).toHaveProperty('date_display');
      expect(body.data.timeStats.todayHourly[0]).toHaveProperty('time_display', '03:00');
    } finally {
      restoreTime();
    }
  });

  it('returns error response when service fails', async () => {
    const { GET } = await import('../../src/app/api/graph/stats/route');

    neo4jAnalyticsService.getDatabaseStats.mockRejectedValue(new Error('boom'));

    const response = await GET();
    const body = await response.json();

    expect(body.success).toBe(false);
    expect(body.error).toContain('boom');
  });

  it('includes the stored relationship distribution', async () => {
    const { GET } = await import('../../src/app/api/graph/stats/route');
    neo4jAnalyticsService.getDatabaseStats.mockResolvedValue({ totalNodes: 3 });
    neo4jAnalyticsService.getTimeStats.mockResolvedValue({});
    neo4jGraphService.getGraphData.mockResolvedValue({ nodes: [] });
    neo4jAnalyticsService.getRelationshipDistribution.mockResolvedValue({ MENTIONS: 7, LOCATED_IN: 2 });

    const response = await GET();
    const body = await response.json();

    expect(body.data.relationshipDistribution).toEqual({ MENTIONS: 7, LOCATED_IN: 2 });
  });

  it('rejects a database error result instead of returning an incomplete overview', async () => {
    const { GET } = await import('../../src/app/api/graph/stats/route');
    neo4jAnalyticsService.getDatabaseStats.mockResolvedValue({ error: 'connection failed', connected: false });
    neo4jAnalyticsService.getTimeStats.mockResolvedValue({});
    neo4jGraphService.getGraphData.mockResolvedValue({ nodes: [] });

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.success).toBe(false);
    expect(body.error).toBe('数据库统计暂不可用');
  });

  it('returns error response for non-error failures', async () => {
    const { GET } = await import('../../src/app/api/graph/stats/route');

    neo4jAnalyticsService.getDatabaseStats.mockRejectedValue('fail');

    const response = await GET();
    const body = await response.json();

    expect(body.success).toBe(false);
    expect(body.error).toBe('获取图谱统计失败');
  });

  it('falls back when metadata timestamp is empty', async () => {
    const restoreTime = freezeTime('2024-01-01T00:00:00.000Z');
    const nowSpy = jest.spyOn(TimeZoneUtils, 'now').mockReturnValue('');
    const { GET } = await import('../../src/app/api/graph/stats/route');

    neo4jAnalyticsService.getDatabaseStats.mockResolvedValue({ total: 1 });
    neo4jAnalyticsService.getTimeStats.mockResolvedValue({ metadata: {} });
    neo4jGraphService.getGraphData.mockResolvedValue({ nodes: [] });

    try {
      const response = await GET();
      const body = await response.json();

      expect(body.success).toBe(true);
      expect(body.data.metadata.generated_at).toBe('');
    } finally {
      nowSpy.mockRestore();
      restoreTime();
    }
  });
});
