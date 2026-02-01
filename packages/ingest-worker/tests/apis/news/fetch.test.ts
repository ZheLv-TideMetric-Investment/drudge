const mockFutuService = {
  fetchNews: jest.fn()
};

const mockAwtmtService = {
  fetchNews: jest.fn()
};

jest.mock('../../../src/services/FutuLiveService', () => ({
  __esModule: true,
  default: mockFutuService
}));

jest.mock('../../../src/services/AwtmtLiveService', () => ({
  __esModule: true,
  default: mockAwtmtService
}));

import { fetchLatestNews } from '../../../src/apis/news/fetch';
import { freezeTime } from '../../helpers/fake-time';

const normalizeErrorDetails = (result: any) => ({
  ...result,
  details: result.details ? { ...result.details, stack: '<stack>' } : result.details
});

describe('news fetch api', () => {
  let restoreTime: (() => void) | undefined;

  beforeEach(() => {
    restoreTime = freezeTime('2024-01-01T00:00:00.000Z');
    mockFutuService.fetchNews.mockReset();
    mockAwtmtService.fetchNews.mockReset();
  });

  afterEach(() => {
    restoreTime?.();
  });

  it('returns empty message when no news', async () => {
    mockFutuService.fetchNews.mockResolvedValue([]);
    mockAwtmtService.fetchNews.mockResolvedValue([]);

    const result = await fetchLatestNews();

    expect(result.success).toBe(true);
    expect(result.count).toBe(0);
    expect(result.message).toContain('没有获取到新的新闻');
    expect(result).toMatchSnapshot();
  });

  it('merges and sorts news', async () => {
    mockFutuService.fetchNews.mockResolvedValue([
      { id: '1', time: 200 }
    ]);
    mockAwtmtService.fetchNews.mockResolvedValue([
      { id: '2', time: 300 },
      { id: '3', time: 100 }
    ]);

    const result = await fetchLatestNews();

    expect(result.success).toBe(true);
    expect(result.count).toBe(3);
    expect(result.news.map((item: any) => item.id)).toEqual(['2', '1', '3']);
    expect(result).toMatchSnapshot();
  });

  it('returns error on failure', async () => {
    mockFutuService.fetchNews.mockRejectedValue(new Error('boom'));
    mockAwtmtService.fetchNews.mockResolvedValue([]);

    const result = await fetchLatestNews();

    expect(result.success).toBe(false);
    expect(result.error).toBe('boom');
    expect(normalizeErrorDetails(result)).toMatchSnapshot();
  });
});
