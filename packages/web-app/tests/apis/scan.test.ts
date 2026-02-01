import { createNextRequest } from '../helpers/next-request';
import { freezeTime } from '../helpers/fake-time';

const highLevelNewsScanner = {
  scanHighLevelNews: jest.fn(),
  getStatus: jest.fn()
};

const initializeServices = jest.fn();

jest.mock('../../src/lib/services/high-level-scanner', () => ({
  __esModule: true,
  highLevelNewsScanner
}));

jest.mock('../../src/lib/services/init', () => ({
  __esModule: true,
  initializeServices
}));

describe('api/scan', () => {
  beforeEach(() => {
    highLevelNewsScanner.scanHighLevelNews.mockReset();
    highLevelNewsScanner.getStatus.mockReset();
    initializeServices.mockReset();
  });

  it('POST triggers scan', async () => {
    const restoreTime = freezeTime('2024-01-01T00:00:00.000Z');
    jest.resetModules();
    const { POST } = await import('../../src/app/api/scan/route');

    highLevelNewsScanner.scanHighLevelNews.mockResolvedValue({
      success: true,
      message: 'ok',
      period: 'period',
      found: 1,
      sent: 0,
      high_level_news: [],
      timestamp: '2024-01-01T00:00:00.000Z'
    });

    const request = createNextRequest('/api/scan', {
      method: 'POST',
      body: { sendNotifications: false, skipProcessed: true }
    });

    try {
      const response = await POST(request);
      const body = await response.json();

      expect(body.success).toBe(true);
      expect(initializeServices).toHaveBeenCalled();
      expect(body).toMatchSnapshot();
    } finally {
      restoreTime();
    }
  });

  it('POST falls back to empty body when json parsing fails', async () => {
    const restoreTime = freezeTime('2024-01-01T00:00:00.000Z');
    jest.resetModules();
    const { POST } = await import('../../src/app/api/scan/route');

    highLevelNewsScanner.scanHighLevelNews.mockResolvedValue({
      success: true,
      message: 'ok',
      period: 'period',
      found: 0,
      sent: 0,
      high_level_news: [],
      timestamp: '2024-01-01T00:00:00.000Z'
    });

    const request = createNextRequest('/api/scan', {
      method: 'POST',
      body: { sendNotifications: false }
    });
    (request as any).json = jest.fn().mockRejectedValue(new Error('bad json'));

    try {
      const response = await POST(request);
      const body = await response.json();

      expect(body.success).toBe(true);
      expect(highLevelNewsScanner.scanHighLevelNews).toHaveBeenCalledWith(undefined, undefined, {
        sendNotifications: true,
        skipProcessed: true
      });
    } finally {
      restoreTime();
    }
  });

  it('GET returns status', async () => {
    const restoreTime = freezeTime('2024-01-01T00:00:00.000Z');
    jest.resetModules();
    const { GET } = await import('../../src/app/api/scan/route');

    highLevelNewsScanner.getStatus.mockReturnValue({ running: false });

    try {
      const response = await GET();
      const body = await response.json();

      expect(body.scanner_status).toEqual({ running: false });
      expect(body).toMatchSnapshot();
    } finally {
      restoreTime();
    }
  });

  it('POST returns error when init fails', async () => {
    const restoreTime = freezeTime('2024-01-01T00:00:00.000Z');
    jest.resetModules();
    const { POST } = await import('../../src/app/api/scan/route');

    initializeServices.mockRejectedValue(new Error('init failed'));

    const request = createNextRequest('/api/scan', {
      method: 'POST',
      body: { sendNotifications: true }
    });

    try {
      const response = await POST(request);
      const body = await response.json();

      expect(response.status).toBe(500);
      expect(body.success).toBe(false);
      expect(body.error).toContain('init failed');
    } finally {
      restoreTime();
    }
  });

  it('POST returns default error when init throws non-error', async () => {
    const restoreTime = freezeTime('2024-01-01T00:00:00.000Z');
    jest.resetModules();
    const { POST } = await import('../../src/app/api/scan/route');

    initializeServices.mockRejectedValue('fail');

    const request = createNextRequest('/api/scan', {
      method: 'POST',
      body: { sendNotifications: true }
    });

    try {
      const response = await POST(request);
      const body = await response.json();

      expect(response.status).toBe(500);
      expect(body.error).toBe('未知错误');
    } finally {
      restoreTime();
    }
  });

  it('GET returns error when status fails', async () => {
    jest.resetModules();
    const { GET } = await import('../../src/app/api/scan/route');

    highLevelNewsScanner.getStatus.mockImplementation(() => {
      throw new Error('boom');
    });

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toContain('boom');
  });

  it('GET returns default error when status throws non-error', async () => {
    jest.resetModules();
    const { GET } = await import('../../src/app/api/scan/route');

    highLevelNewsScanner.getStatus.mockImplementation(() => {
      throw 'fail';
    });

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe('获取状态失败');
  });
});
