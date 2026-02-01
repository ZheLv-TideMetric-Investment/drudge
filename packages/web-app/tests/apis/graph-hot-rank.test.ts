import { createNextRequest } from '../helpers/next-request';
import { freezeTime } from '../helpers/fake-time';

const neo4jGraphService = {
  getHotRankData: jest.fn()
};

jest.mock('../../src/lib/neo4j', () => ({
  __esModule: true,
  neo4jGraphService
}));

describe('api/graph/hot-rank', () => {
  beforeEach(() => {
    neo4jGraphService.getHotRankData.mockReset();
  });

  it('parses days and limit', async () => {
    const restoreTime = freezeTime('2024-01-01T00:00:00.000Z');
    jest.resetModules();
    const { GET } = await import('../../src/app/api/graph/hot-rank/route');

    neo4jGraphService.getHotRankData.mockResolvedValue({ hotNews: [] });

    const request = createNextRequest('/api/graph/hot-rank', {
      query: { days: 3, limit: 5 }
    });

    try {
      const response = await GET(request);
      const body = await response.json();

      expect(body.success).toBe(true);
      expect(neo4jGraphService.getHotRankData).toHaveBeenCalledWith(3, 5);
      expect(body).toMatchSnapshot();
    } finally {
      restoreTime();
    }
  });

  it('uses defaults and formats time stats', async () => {
    const restoreTime = freezeTime('2024-01-01T00:00:00.000Z');
    jest.resetModules();
    const { GET } = await import('../../src/app/api/graph/hot-rank/route');

    neo4jGraphService.getHotRankData.mockResolvedValue({
      hotNews: [{ timestamp: '2024-01-01T00:00:00.000Z' }],
      timeStats: [
        { newsDate: '2024-01-01' },
        { date: '2024-01-02' }
      ]
    });

    const request = createNextRequest('/api/graph/hot-rank');

    try {
      const response = await GET(request);
      const body = await response.json();

      expect(body.success).toBe(true);
      expect(neo4jGraphService.getHotRankData).toHaveBeenCalledWith(7, 20);
      expect(body.data.hotNews[0]).toHaveProperty('timestamp_display');
      expect(body.data.timeStats[0]).toHaveProperty('date_display');
      expect(body.data.timeStats[1]).toHaveProperty('date_display');
    } finally {
      restoreTime();
    }
  });

  it('handles missing hotNews and timeStats', async () => {
    jest.resetModules();
    const { GET } = await import('../../src/app/api/graph/hot-rank/route');

    neo4jGraphService.getHotRankData.mockResolvedValue({});

    const request = createNextRequest('/api/graph/hot-rank');
    const response = await GET(request);
    const body = await response.json();

    expect(body.success).toBe(true);
    expect(body.data.hotNews).toEqual([]);
    expect(body.data.timeStats).toEqual([]);
  });

  it('returns error response on failure', async () => {
    jest.resetModules();
    const { GET } = await import('../../src/app/api/graph/hot-rank/route');

    neo4jGraphService.getHotRankData.mockRejectedValue(new Error('boom'));

    const request = createNextRequest('/api/graph/hot-rank');
    const response = await GET(request);
    const body = await response.json();

    expect(body.success).toBe(false);
    expect(body.error).toContain('boom');
  });

  it('returns error response on non-error failure', async () => {
    jest.resetModules();
    const { GET } = await import('../../src/app/api/graph/hot-rank/route');

    neo4jGraphService.getHotRankData.mockRejectedValue('fail');

    const request = createNextRequest('/api/graph/hot-rank');
    const response = await GET(request);
    const body = await response.json();

    expect(body.success).toBe(false);
    expect(body.error).toBe('fail');
  });
});
