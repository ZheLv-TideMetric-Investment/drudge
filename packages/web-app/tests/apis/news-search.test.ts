import { createNextRequest } from '../helpers/next-request';
import { freezeTime } from '../helpers/fake-time';

const neo4jNewsService = {
  searchNews: jest.fn()
};

jest.mock('../../src/lib/neo4j', () => ({
  __esModule: true,
  neo4jNewsService
}));

describe('api/news/search', () => {
  beforeEach(() => {
    neo4jNewsService.searchNews.mockReset();
  });

  it('returns error when q is missing', async () => {
    const restoreTime = freezeTime('2024-01-01T00:00:00.000Z');
    jest.resetModules();
    const { GET } = await import('../../src/app/api/news/search/route');

    const request = createNextRequest('/api/news/search');
    const response = await GET(request);
    const body = await response.json();

    try {
      expect(body.success).toBe(false);
      expect(body).toMatchSnapshot();
    } finally {
      restoreTime();
    }
  });

  it('returns 400 for invalid time range', async () => {
    const restoreTime = freezeTime('2024-01-01T00:00:00.000Z');
    jest.resetModules();
    const { GET } = await import('../../src/app/api/news/search/route');

    const request = createNextRequest('/api/news/search', {
      query: { q: 'test', startTime: 'bad', endTime: '2024-01-01T00:00:00.000Z' }
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

  it('returns search results', async () => {
    const restoreTime = freezeTime('2024-01-01T00:00:00.000Z');
    try {
      jest.resetModules();
      const { GET } = await import('../../src/app/api/news/search/route');

      neo4jNewsService.searchNews.mockResolvedValue({
        news: [{ id: 'news_1', title: 'Title', timestamp: '2024-01-01 08:00:00' }],
        total: 1
      });

      const request = createNextRequest('/api/news/search', {
        query: { q: 'test', limit: 10 }
      });

      const response = await GET(request);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data.news).toHaveLength(1);
      expect(body.data.searchInfo.keyword).toBe('test');
      expect(body).toMatchSnapshot();
    } finally {
      restoreTime();
    }
  });

  it('returns error when search fails', async () => {
    const restoreTime = freezeTime('2024-01-01T00:00:00.000Z');
    jest.resetModules();
    const { GET } = await import('../../src/app/api/news/search/route');

    neo4jNewsService.searchNews.mockRejectedValue(new Error('boom'));

    const request = createNextRequest('/api/news/search', {
      query: { q: 'test' }
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

  it('returns error when search fails with non-error', async () => {
    const restoreTime = freezeTime('2024-01-01T00:00:00.000Z');
    jest.resetModules();
    const { GET } = await import('../../src/app/api/news/search/route');

    neo4jNewsService.searchNews.mockRejectedValue('fail');

    const request = createNextRequest('/api/news/search', {
      query: { q: 'test' }
    });

    try {
      const response = await GET(request);
      const body = await response.json();

      expect(response.status).toBe(500);
      expect(body.error).toBe('新闻搜索失败');
    } finally {
      restoreTime();
    }
  });
});
