const mockFileStorage = {
  getLatestNewsId: jest.fn(),
  saveNews: jest.fn()
};

const mockNotification = {
  sendNewsApiFailureNotification: jest.fn(),
  sendServiceErrorNotification: jest.fn()
};

jest.mock('../../src/storage/FileStorage', () => ({
  __esModule: true,
  default: mockFileStorage
}));

jest.mock('../../src/services/NotificationService', () => ({
  __esModule: true,
  default: mockNotification
}));

import axios from 'axios';
import { setEnv } from '../helpers/env';
import { freezeTime } from '../helpers/fake-time';
import { AwtmtLiveService } from '../../src/services/AwtmtLiveService';

const createService = () => new AwtmtLiveService();

describe('AwtmtLiveService', () => {
  const mockedAxios = axios as jest.Mocked<typeof axios>;

  beforeEach(() => {
    mockFileStorage.getLatestNewsId.mockReset();
    mockFileStorage.saveNews.mockReset();
    mockNotification.sendNewsApiFailureNotification.mockReset();
    mockNotification.sendServiceErrorNotification.mockReset();
    mockNotification.sendServiceErrorNotification.mockResolvedValue(undefined);
    mockNotification.sendNewsApiFailureNotification.mockResolvedValue(undefined);
    mockedAxios.get.mockReset();
  });

  it('transformNewsItem maps fields and converts time', () => {
    const service = createService();
    const item = {
      id: 321,
      title: 'Hello',
      content_text: 'World',
      display_time: 1704067200,
      uri: 'https://example.com',
      global_channel_name: 'finance'
    };

    const result = (service as any).transformNewsItem(item);
    expect(result.id).toBe('321');
    expect(result.source).toBe('awtmt_live');
    expect(result.time).toBe(item.display_time * 1000);
    expect(result.category).toBe('finance');
  });

  it('transformNewsItem fills missing fields', () => {
    const service = createService();
    const item = {
      id: 321,
      display_time: 1704067200
    };

    const result = (service as any).transformNewsItem(item);
    expect(result.title).toBe('');
    expect(result.content).toBe('');
    expect(result.url).toBe('');
    expect(result.category).toBe('');
    expect(result.summary).toBe('');
  });

  it('filterNewNews returns full list when last id missing', async () => {
    const service = createService();
    mockFileStorage.getLatestNewsId.mockResolvedValue(null);

    const news = [
      { id: '1', title: 'A', source: 'awtmt_live', time: 1 },
      { id: '2', title: 'B', source: 'awtmt_live', time: 2 }
    ];

    const result = await (service as any).filterNewNews(news);
    expect(result).toEqual(news);
  });

  it('filterNewNews returns full list when last id not found', async () => {
    const service = createService();
    mockFileStorage.getLatestNewsId.mockResolvedValue('missing');

    const news = [
      { id: '1', title: 'A', source: 'awtmt_live', time: 1 },
      { id: '2', title: 'B', source: 'awtmt_live', time: 2 }
    ];

    const result = await (service as any).filterNewNews(news);
    expect(result).toEqual(news);
  });

  it('filterNewNews slices when last id found', async () => {
    const service = createService();
    mockFileStorage.getLatestNewsId.mockResolvedValue('2');

    const news = [
      { id: '3', title: 'C', source: 'awtmt_live', time: 3 },
      { id: '2', title: 'B', source: 'awtmt_live', time: 2 },
      { id: '1', title: 'A', source: 'awtmt_live', time: 1 }
    ];

    const result = await (service as any).filterNewNews(news);
    expect(result).toEqual([{ id: '3', title: 'C', source: 'awtmt_live', time: 3 }]);
  });

  it('fetchNews handles first run success', async () => {
    const service = createService();
    mockFileStorage.getLatestNewsId.mockResolvedValue(null);

    const response = {
      data: {
        code: 20000,
        data: {
          items: [
            { id: 1, title: 'A', content_text: 'B', display_time: 1704067200, uri: 'x' }
          ]
        }
      }
    };

    (service as any).makeRequest = jest.fn().mockResolvedValue(response);

    const result = await service.fetchNews();

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('1');
    expect(mockFileStorage.saveNews).toHaveBeenCalledTimes(1);
    expect((service as any).isFirstRun).toBe(false);
  });

  it('fetchNews returns empty on first run when items missing', async () => {
    const service = createService();
    mockFileStorage.getLatestNewsId.mockResolvedValue(null);

    const response = {
      data: {
        code: 20000,
        data: {}
      }
    };

    (service as any).makeRequest = jest.fn().mockResolvedValue(response);

    const result = await service.fetchNews();

    expect(result).toEqual([]);
  });

  it('fetchNews first run does not save when no new news', async () => {
    const service = createService();
    mockFileStorage.getLatestNewsId.mockResolvedValue('1');

    const response = {
      data: {
        code: 20000,
        data: {
          items: [
            { id: 1, title: 'A', content_text: 'B', display_time: 1704067200, uri: 'x' }
          ]
        }
      }
    };

    (service as any).makeRequest = jest.fn().mockResolvedValue(response);

    const result = await service.fetchNews();

    expect(result).toHaveLength(1);
    expect(mockFileStorage.saveNews).not.toHaveBeenCalled();
  });

  it('fetchNews paginates and saves new news on subsequent runs', async () => {
    const service = createService();
    (service as any).isFirstRun = false;
    mockFileStorage.getLatestNewsId.mockResolvedValue('2');

    const response = {
      data: {
        code: 20000,
        data: {
          items: [
            { id: 3, title: 'C', content_text: 'C', display_time: 1704067200, uri: 'x' },
            { id: 2, title: 'B', content_text: 'B', display_time: 1704067100, uri: 'x' },
            { id: 1, title: 'A', content_text: 'A', display_time: 1704067000, uri: 'x' }
          ],
          next_cursor: 'next'
        }
      }
    };

    (service as any).makeRequest = jest.fn().mockResolvedValue(response);

    const result = await service.fetchNews();

    expect((service as any).makeRequest).toHaveBeenCalledTimes(1);
    expect(result.map((item: any) => item.id)).toEqual(['3']);
    expect(mockFileStorage.saveNews).toHaveBeenCalledWith([
      expect.objectContaining({ id: '3' })
    ]);
  });

  it('fetchNews stops on invalid response during pagination', async () => {
    const service = createService();
    (service as any).isFirstRun = false;

    (service as any).makeRequest = jest.fn().mockResolvedValue({ data: { code: 500 } });

    const result = await service.fetchNews();

    expect(result).toEqual([]);
    expect(mockFileStorage.saveNews).not.toHaveBeenCalled();
  });

  it('fetchNews returns empty when no new data found', async () => {
    const service = createService();
    (service as any).isFirstRun = false;
    mockFileStorage.getLatestNewsId.mockResolvedValue('1');

    const response = {
      data: {
        code: 20000,
        data: {
          items: [
            { id: 1, title: 'A', content_text: 'A', display_time: 1704067200, uri: 'x' }
          ]
        }
      }
    };

    (service as any).makeRequest = jest.fn().mockResolvedValue(response);

    const result = await service.fetchNews();

    expect(result).toEqual([]);
    expect(mockFileStorage.saveNews).not.toHaveBeenCalled();
  });

  it('fetchNews stops when max page reached', async () => {
    const restoreEnv = setEnv({
      NEWS_API_REQUEST_INTERVAL: '0'
    });

    jest.resetModules();
    const { AwtmtLiveService } = await import('../../src/services/AwtmtLiveService');
    const service = new AwtmtLiveService();
    (service as any).isFirstRun = false;
    mockFileStorage.getLatestNewsId.mockResolvedValue(null);

    const response = {
      data: {
        code: 20000,
        data: {
          items: [
            { id: 1, title: 'A', content_text: 'A', display_time: 1704067200, uri: 'x' }
          ],
          next_cursor: 'next'
        }
      }
    };

    (service as any).makeRequest = jest.fn().mockResolvedValue(response);

    jest.useFakeTimers();
    try {
      const resultPromise = service.fetchNews();
      await jest.runAllTimersAsync();
      const result = await resultPromise;

      expect((service as any).makeRequest).toHaveBeenCalledTimes(10);
      expect(result).toHaveLength(10);
    } finally {
      jest.useRealTimers();
      restoreEnv();
    }
  });

  it('fetchNews clears cursor when next_cursor is missing', async () => {
    const restoreEnv = setEnv({
      NEWS_API_REQUEST_INTERVAL: '0'
    });

    jest.resetModules();
    const { AwtmtLiveService } = await import('../../src/services/AwtmtLiveService');
    const service = new AwtmtLiveService();
    (service as any).isFirstRun = false;
    mockFileStorage.getLatestNewsId.mockResolvedValue(null);

    const response = {
      data: {
        code: 20000,
        data: {
          items: [
            { id: 1, title: 'A', content_text: 'A', display_time: 1704067200, uri: 'x' }
          ],
          next_cursor: ''
        }
      }
    };

    (service as any).makeRequest = jest.fn()
      .mockResolvedValueOnce(response)
      .mockResolvedValueOnce(null);

    jest.useFakeTimers();
    try {
      const resultPromise = service.fetchNews();
      await jest.runAllTimersAsync();
      const result = await resultPromise;

      expect((service as any).makeRequest).toHaveBeenCalledTimes(2);
      expect(result).toHaveLength(1);
    } finally {
      jest.useRealTimers();
      restoreEnv();
    }
  });

  it('fetchNews returns empty on invalid response and notifies', async () => {
    const service = createService();
    (service as any).makeRequest = jest.fn().mockResolvedValue({ data: { code: 500 } });

    const result = await service.fetchNews();

    expect(result).toEqual([]);
    expect(mockNotification.sendNewsApiFailureNotification).toHaveBeenCalled();
  });

  it('fetchNews logs when response notification fails', async () => {
    const service = createService();
    (service as any).makeRequest = jest.fn().mockResolvedValue({ data: { code: 500 } });
    mockNotification.sendNewsApiFailureNotification.mockRejectedValueOnce(new Error('notify fail'));

    const result = await service.fetchNews();

    expect(result).toEqual([]);
    expect(mockNotification.sendNewsApiFailureNotification).toHaveBeenCalled();
  });

  it('fetchNews returns empty on exception and notifies', async () => {
    const service = createService();
    (service as any).makeRequest = jest.fn().mockRejectedValue(new Error('timeout'));

    const result = await service.fetchNews();

    expect(result).toEqual([]);
    expect(mockNotification.sendServiceErrorNotification).toHaveBeenCalled();
  });

  it('fetchNews logs when notification fails', async () => {
    const service = createService();
    (service as any).makeRequest = jest.fn().mockRejectedValue(new Error('timeout'));
    mockNotification.sendServiceErrorNotification.mockRejectedValueOnce(new Error('notify fail'));

    const result = await service.fetchNews();

    expect(result).toEqual([]);
    expect(mockNotification.sendServiceErrorNotification).toHaveBeenCalled();
  });

  it('fetchNews uses fallback error message when empty', async () => {
    const service = createService();
    (service as any).makeRequest = jest.fn().mockRejectedValue(new Error(''));

    await service.fetchNews();

    expect(mockNotification.sendServiceErrorNotification).toHaveBeenCalledWith(
      'AwtmtLiveService',
      '[AWTMT] 新闻获取失败',
      expect.any(Object)
    );
  });

  it('makeRequest sends request with cursor and headers', async () => {
    const service = createService();
    const restoreTime = freezeTime('2024-01-01T00:00:01.000Z');
    const now = Date.now();
    const randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0);
    (service as any).lastRequestTime = now;

    mockedAxios.get.mockResolvedValue({ status: 200, data: {} } as any);

    try {
      const requestPromise = (service as any).makeRequest('cursor-1');
      await jest.runAllTimersAsync();
      const response = await requestPromise;

      expect(response).toEqual({ status: 200, data: {} });
      expect(mockedAxios.get).toHaveBeenCalledTimes(1);
      const [, options] = mockedAxios.get.mock.calls[0] as [
        string,
        {
          params: Record<string, unknown>;
          headers: Record<string, string>;
          validateStatus: (status: number) => boolean;
        }
      ];
      expect(options.params).toEqual(expect.objectContaining({ cursor: 'cursor-1', first_page: false }));
      expect(options.headers['User-Agent']).toEqual(expect.any(String));
      expect(options.headers.Referer).toEqual(expect.any(String));
      expect(options.validateStatus(200)).toBe(true);
      expect(options.validateStatus(400)).toBe(false);
    } finally {
      restoreTime();
      randomSpy.mockRestore();
    }
  });

  it('makeRequest sets first_page for initial request', async () => {
    const service = createService();
    const restoreTime = freezeTime('2024-01-01T00:00:01.000Z');
    const now = Date.now();
    const randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0);
    (service as any).lastRequestTime = now;

    mockedAxios.get.mockResolvedValue({ status: 200, data: {} } as any);

    try {
      const requestPromise = (service as any).makeRequest();
      await jest.runAllTimersAsync();
      const response = await requestPromise;

      expect(response).toEqual({ status: 200, data: {} });
      const [, options] = mockedAxios.get.mock.calls[0] as [
        string,
        {
          params: Record<string, unknown>;
        }
      ];
      expect(options.params).toEqual(expect.objectContaining({ first_page: true }));
    } finally {
      restoreTime();
      randomSpy.mockRestore();
    }
  });

  it('makeRequest notifies on failure and backs off for network errors', async () => {
    const service = createService();
    const restoreTime = freezeTime('2024-01-01T00:00:01.000Z');
    const now = Date.now();
    const randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0);
    (service as any).lastRequestTime = now;

    const error = Object.assign(new Error('timeout'), { code: 'ETIMEDOUT' });
    mockedAxios.get.mockRejectedValueOnce(error);
    mockNotification.sendNewsApiFailureNotification.mockRejectedValueOnce(new Error('notify fail'));

    try {
      const requestPromise = (service as any).makeRequest('cursor-1');
      await jest.runAllTimersAsync();
      const response = await requestPromise;

      expect(response).toBeNull();
      expect(mockNotification.sendNewsApiFailureNotification).toHaveBeenCalled();
    } finally {
      restoreTime();
      randomSpy.mockRestore();
    }
  });

  it('healthCheck returns true for valid response', async () => {
    const service = createService();
    (service as any).makeRequest = jest.fn().mockResolvedValue({
      status: 200,
      data: { code: 20000 }
    });

    await expect(service.healthCheck()).resolves.toBe(true);
  });

  it('healthCheck returns false when response is not ok', async () => {
    const service = createService();
    (service as any).makeRequest = jest.fn().mockResolvedValue({
      status: 200,
      data: { code: 500 }
    });

    await expect(service.healthCheck()).resolves.toBe(false);
  });

  it('healthCheck returns false on error', async () => {
    const service = createService();
    (service as any).makeRequest = jest.fn().mockRejectedValue(new Error('boom'));

    await expect(service.healthCheck()).resolves.toBe(false);
  });

  it('getStatus returns current state', () => {
    const service = createService();
    (service as any).isFirstRun = false;
    (service as any).lastRequestTime = 123;

    expect(service.getStatus()).toEqual({
      service: 'AwtmtLiveService',
      source: 'awtmt_live',
      isFirstRun: false,
      lastRequestTime: 123,
      minRequestInterval: 2000,
      baseUrl: 'https://api-one-wscn.awtmt.com/apiv1/content/lives'
    });
  });
});
