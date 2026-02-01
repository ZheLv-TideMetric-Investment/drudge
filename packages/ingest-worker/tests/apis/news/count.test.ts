const mockFileStorage = {
  getNewsStats: jest.fn()
};

jest.mock('../../../src/storage/FileStorage', () => ({
  __esModule: true,
  default: mockFileStorage
}));

import { getNewsCount } from '../../../src/apis/news/count';
import { freezeTime } from '../../helpers/fake-time';

const normalizeErrorDetails = (result: any) => ({
  ...result,
  details: result.details ? { ...result.details, stack: '<stack>' } : result.details
});

describe('news count api', () => {
  let restoreTime: (() => void) | undefined;

  beforeEach(() => {
    restoreTime = freezeTime('2024-01-01T00:00:00.000Z');
    mockFileStorage.getNewsStats.mockReset();
  });

  afterEach(() => {
    restoreTime?.();
  });

  it('returns stats on success', async () => {
    mockFileStorage.getNewsStats.mockResolvedValue({ totalCount: 5 });

    const result = await getNewsCount();

    expect(result.success).toBe(true);
    expect(result.stats.totalCount).toBe(5);
    expect(result).toMatchSnapshot();
  });

  it('returns error on failure', async () => {
    mockFileStorage.getNewsStats.mockRejectedValue(new Error('boom'));

    const result = await getNewsCount();

    expect(result.success).toBe(false);
    expect(result.error).toBe('boom');
    expect(normalizeErrorDetails(result)).toMatchSnapshot();
  });
});
