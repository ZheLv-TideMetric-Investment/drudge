import { createNextRequest } from '../helpers/next-request';
import { freezeTime } from '../helpers/fake-time';

const summaryService = {
  generateSummary: jest.fn()
};

jest.mock('../../src/lib/services/summary', () => ({
  __esModule: true,
  summaryService
}));

describe('api/summary', () => {
  beforeEach(() => {
    summaryService.generateSummary.mockReset();
  });

  it('returns 400 when missing params', async () => {
    const restoreTime = freezeTime('2024-01-01T00:00:00.000Z');
    jest.resetModules();
    const { GET } = await import('../../src/app/api/summary/route');

    const request = createNextRequest('/api/summary');
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

  it('returns summary result', async () => {
    const restoreTime = freezeTime('2024-01-01T00:00:00.000Z');
    jest.resetModules();
    const { GET } = await import('../../src/app/api/summary/route');

    summaryService.generateSummary.mockResolvedValue({
      success: true,
      message: 'ok',
      period: 'period',
      timestamp: '2024-01-01T00:00:00.000Z',
      data: { empty: true }
    });

    const request = createNextRequest('/api/summary', {
      query: { startTime: '2024-01-01T00:00:00.000Z', endTime: '2024-01-01T01:00:00.000Z' }
    });

    try {
      const response = await GET(request);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.period).toBe('period');
      expect(body).toMatchSnapshot();
    } finally {
      restoreTime();
    }
  });

  it('returns summary result with news data', async () => {
    const restoreTime = freezeTime('2024-01-01T00:00:00.000Z');
    jest.resetModules();
    const { GET } = await import('../../src/app/api/summary/route');

    summaryService.generateSummary.mockResolvedValue({
      success: true,
      message: 'ok',
      period: 'period',
      timestamp: '2024-01-01T00:00:00.000Z',
      data: { empty: false, news_count: 2, high_level_count: 1 }
    });

    const request = createNextRequest('/api/summary', {
      query: { startTime: '2024-01-01T00:00:00.000Z', endTime: '2024-01-01T01:00:00.000Z' }
    });

    try {
      const response = await GET(request);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data.news_count).toBe(2);
    } finally {
      restoreTime();
    }
  });

  it('returns summary result when data is missing', async () => {
    const restoreTime = freezeTime('2024-01-01T00:00:00.000Z');
    jest.resetModules();
    const { GET } = await import('../../src/app/api/summary/route');

    summaryService.generateSummary.mockResolvedValue({
      success: true,
      message: 'ok',
      period: 'period',
      timestamp: '2024-01-01T00:00:00.000Z'
    } as any);

    const request = createNextRequest('/api/summary', {
      query: { startTime: '2024-01-01T00:00:00.000Z', endTime: '2024-01-01T01:00:00.000Z' }
    });

    try {
      const response = await GET(request);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.period).toBe('period');
    } finally {
      restoreTime();
    }
  });

  it('returns 500 when summary generation fails', async () => {
    const restoreTime = freezeTime('2024-01-01T00:00:00.000Z');
    jest.resetModules();
    const { GET } = await import('../../src/app/api/summary/route');

    summaryService.generateSummary.mockResolvedValue({
      success: false,
      message: 'fail',
      period: 'period',
      timestamp: '2024-01-01T00:00:00.000Z',
      error: 'boom'
    });

    const request = createNextRequest('/api/summary', {
      query: { startTime: '2024-01-01T00:00:00.000Z', endTime: '2024-01-01T01:00:00.000Z' }
    });

    try {
      const response = await GET(request);
      const body = await response.json();

      expect(response.status).toBe(500);
      expect(body.success).toBe(false);
      expect(body.message).toBe('fail');
    } finally {
      restoreTime();
    }
  });

  it('returns 400 when summary generation throws', async () => {
    const restoreTime = freezeTime('2024-01-01T00:00:00.000Z');
    jest.resetModules();
    const { GET } = await import('../../src/app/api/summary/route');

    summaryService.generateSummary.mockRejectedValue('fail');

    const request = createNextRequest('/api/summary', {
      query: { startTime: '2024-01-01T00:00:00.000Z', endTime: '2024-01-01T01:00:00.000Z' }
    });

    try {
      const response = await GET(request);
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.error).toBe('未知错误');
    } finally {
      restoreTime();
    }
  });

  it('returns 400 when summary generation throws Error', async () => {
    const restoreTime = freezeTime('2024-01-01T00:00:00.000Z');
    jest.resetModules();
    const { GET } = await import('../../src/app/api/summary/route');

    summaryService.generateSummary.mockRejectedValue(new Error('boom'));

    const request = createNextRequest('/api/summary', {
      query: { startTime: '2024-01-01T00:00:00.000Z', endTime: '2024-01-01T01:00:00.000Z' }
    });

    try {
      const response = await GET(request);
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.error).toBe('boom');
    } finally {
      restoreTime();
    }
  });
});
