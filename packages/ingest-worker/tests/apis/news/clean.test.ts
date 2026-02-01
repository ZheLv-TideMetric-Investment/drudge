const mockFileStorage = {
  cleanOldFiles: jest.fn()
};

jest.mock('../../../src/storage/FileStorage', () => ({
  __esModule: true,
  default: mockFileStorage
}));

import { cleanOldNews } from '../../../src/apis/news/clean';
import { freezeTime } from '../../helpers/fake-time';

const normalizeErrorDetails = (result: any) => ({
  ...result,
  details: result.details ? { ...result.details, stack: '<stack>' } : result.details
});

describe('news clean api', () => {
  let restoreTime: (() => void) | undefined;

  beforeEach(() => {
    restoreTime = freezeTime('2024-01-01T00:00:00.000Z');
    mockFileStorage.cleanOldFiles.mockReset();
  });

  afterEach(() => {
    restoreTime?.();
  });

  it('returns clean stats', async () => {
    mockFileStorage.cleanOldFiles.mockResolvedValue({
      deletedCount: 1,
      remainingCount: 2,
      message: 'ok'
    });

    const result = await cleanOldNews(7);

    expect(result.success).toBe(true);
    expect(result.deletedCount).toBe(1);
    expect(result.remainingCount).toBe(2);
    expect(result).toMatchSnapshot();
  });

  it('uses default days when none provided', async () => {
    mockFileStorage.cleanOldFiles.mockResolvedValue({
      deletedCount: 0,
      remainingCount: 0,
      message: 'ok'
    });

    await cleanOldNews();

    expect(mockFileStorage.cleanOldFiles).toHaveBeenCalledWith(7);
  });

  it('returns error on failure', async () => {
    mockFileStorage.cleanOldFiles.mockRejectedValue(new Error('boom'));

    const result = await cleanOldNews(7);

    expect(result.success).toBe(false);
    expect(result.error).toBe('boom');
    expect(normalizeErrorDetails(result)).toMatchSnapshot();
  });
});
