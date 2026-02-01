import { createNextRequest } from '../helpers/next-request';
import { freezeTime } from '../helpers/fake-time';

const neo4jNewsService = {
  getNewsWithPagination: jest.fn()
};

jest.mock('../../src/lib/neo4j', () => ({
  __esModule: true,
  neo4jNewsService
}));

describe('api/news', () => {
  beforeEach(() => {
    neo4jNewsService.getNewsWithPagination.mockReset();
  });

  it('returns 400 for invalid time range', async () => {
    const restoreTime = freezeTime('2024-01-01T00:00:00.000Z');
    jest.resetModules();
    const { GET } = await import('../../src/app/api/news/route');

    const request = createNextRequest('/api/news', {
      query: { startTime: 'bad-time', endTime: '2024-01-01T00:00:00.000Z' }
    });

    const response = await GET(request);
    const body = await response.json();

    try {
      expect(response.status).toBe(400);
      expect(body.success).toBe(false);
      expect(body).toMatchSnapshot();
    } finally {
      restoreTime();
    }
  });

  it('returns paginated news list', async () => {
    const restoreTime = freezeTime('2024-01-01T00:00:00.000Z');
    try {
      jest.resetModules();
      const { GET } = await import('../../src/app/api/news/route');

      neo4jNewsService.getNewsWithPagination.mockResolvedValue({
        news: [{ id: 'news_1', title: 'Title', timestamp: '2024-01-01 08:00:00' }],
        total: 1
      });

      const request = createNextRequest('/api/news', {
        query: { page: 1, limit: 20 }
      });

      const response = await GET(request);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data.news).toHaveLength(1);
      expect(body.data.pagination.total).toBe(1);
      expect(neo4jNewsService.getNewsWithPagination).toHaveBeenCalled();
      expect(body).toMatchSnapshot();
    } finally {
      restoreTime();
    }
  });

  it('returns error when service fails', async () => {
    const restoreTime = freezeTime('2024-01-01T00:00:00.000Z');
    jest.resetModules();
    const { GET } = await import('../../src/app/api/news/route');

    neo4jNewsService.getNewsWithPagination.mockRejectedValue(new Error('boom'));

    const request = createNextRequest('/api/news', {
      query: { page: 1, limit: 20 }
    });

    try {
      const response = await GET(request);
      const body = await response.json();

      expect(response.status).toBe(500);
      expect(body.success).toBe(false);
      expect(body.error).toContain('boom');
    } finally {
      restoreTime();
    }
  });

  it('returns error when service fails with non-error', async () => {
    const restoreTime = freezeTime('2024-01-01T00:00:00.000Z');
    jest.resetModules();
    const { GET } = await import('../../src/app/api/news/route');

    neo4jNewsService.getNewsWithPagination.mockRejectedValue('fail');

    const request = createNextRequest('/api/news', {
      query: { page: 1, limit: 20 }
    });

    try {
      const response = await GET(request);
      const body = await response.json();

      expect(response.status).toBe(500);
      expect(body.error).toBe('获取新闻列表失败');
    } finally {
      restoreTime();
    }
  });
});
