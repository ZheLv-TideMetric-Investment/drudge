const mockFileStorage = {
  getNewsByLimit: jest.fn(),
  getNewsByTimeRange: jest.fn()
};

jest.mock('../../../src/storage/FileStorage', () => ({
  __esModule: true,
  default: mockFileStorage
}));

import { getNewsList, getNewsByTimeRange } from '../../../src/apis/news/list';
import { freezeTime } from '../../helpers/fake-time';

const normalizeErrorDetails = (result: any) => ({
  ...result,
  details: result.details ? { ...result.details, stack: '<stack>' } : result.details
});

describe('news list api', () => {
  let restoreTime: (() => void) | undefined;

  beforeEach(() => {
    restoreTime = freezeTime('2024-01-01T00:00:00.000Z');
    mockFileStorage.getNewsByLimit.mockReset();
    mockFileStorage.getNewsByTimeRange.mockReset();
  });

  afterEach(() => {
    restoreTime?.();
  });

  it('formats list response with defaults', async () => {
    mockFileStorage.getNewsByLimit.mockResolvedValue([
      { id: '1', title: 'A', source: 'futu_live', time: 1704067200000 },
      { id: '2', title: 'B', time: 1704067200000 }
    ]);

    const result = await getNewsList(10);

    expect(result.success).toBe(true);
    expect(result.count).toBe(2);
    expect(result.news[1].source).toBe('futu_live');
    expect(typeof result.news[0].time).toBe('string');
    expect(result).toMatchSnapshot();
  });

  it('uses default limit when none provided', async () => {
    mockFileStorage.getNewsByLimit.mockResolvedValue([]);

    await getNewsList();

    expect(mockFileStorage.getNewsByLimit).toHaveBeenCalledWith(10);
  });

  it('returns error details on failure', async () => {
    mockFileStorage.getNewsByLimit.mockRejectedValue(new Error('boom'));

    const result = await getNewsList(10);

    expect(result.success).toBe(false);
    expect(result.error).toBe('boom');
    expect(result.details).toBeDefined();
    expect(normalizeErrorDetails(result)).toMatchSnapshot();
  });

  it('formats time range response', async () => {
    mockFileStorage.getNewsByTimeRange.mockResolvedValue([
      { id: '1', title: 'A', source: 'futu_live', time: 1704067200000 }
    ]);

    const result = await getNewsByTimeRange(new Date(), new Date());

    expect(result.success).toBe(true);
    expect(result.count).toBe(1);
    expect(result.news[0].id).toBe('1');
    expect(result).toMatchSnapshot();
  });

  it('defaults missing source in time range response', async () => {
    mockFileStorage.getNewsByTimeRange.mockResolvedValue([
      { id: '2', title: 'B', time: 1704067200000 }
    ]);

    const result = await getNewsByTimeRange(new Date(), new Date());

    expect(result.success).toBe(true);
    expect(result.news[0].source).toBe('futu_live');
  });

  it('returns error on time range failure', async () => {
    mockFileStorage.getNewsByTimeRange.mockRejectedValue(new Error('bad range'));

    const result = await getNewsByTimeRange(new Date(), new Date());

    expect(result.success).toBe(false);
    expect(result.error).toBe('bad range');
    expect(normalizeErrorDetails(result)).toMatchSnapshot();
  });
});
