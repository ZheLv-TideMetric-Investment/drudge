const mockFetch = jest.fn();

jest.mock('../../../src/apis/news/fetch', () => ({
  __esModule: true,
  fetchLatestNews: mockFetch
}));

import { getSchedulerStatus, triggerNewsTask } from '../../../src/apis/system/scheduler';
import { freezeTime } from '../../helpers/fake-time';

const normalizeErrorDetails = (result: any) => ({
  ...result,
  details: result.details ? { ...result.details, stack: '<stack>' } : result.details
});

describe('scheduler api', () => {
  let restoreTime: (() => void) | undefined;

  beforeEach(() => {
    restoreTime = freezeTime('2024-01-01T00:00:00.000Z');
    mockFetch.mockReset();
  });

  afterEach(() => {
    restoreTime?.();
  });

  it('returns scheduler status', async () => {
    const result = await getSchedulerStatus();

    expect(result.success).toBe(true);
    expect(result.tasks['news-fetch']).toBeDefined();
    expect(result.totalTasks).toBe(1);
    expect(result).toMatchSnapshot();
  });

  it('returns error when status build fails', async () => {
    const isoSpy = jest.spyOn(Date.prototype, 'toISOString');
    let callCount = 0;
    isoSpy.mockImplementation(() => {
      callCount += 1;
      if (callCount === 1) {
        throw new Error('boom');
      }
      return '2024-01-01T00:00:00.000Z';
    });

    const result = await getSchedulerStatus();

    expect(result.success).toBe(false);
    expect(result.error).toContain('boom');
    expect(normalizeErrorDetails(result)).toMatchSnapshot();

    isoSpy.mockRestore();
  });

  it('returns trigger result', async () => {
    mockFetch.mockResolvedValue({ success: true });

    const result = await triggerNewsTask();

    expect(result.success).toBe(true);
    expect(result.result).toEqual({ success: true });
    expect(result).toMatchSnapshot();
  });

  it('returns error on trigger failure', async () => {
    mockFetch.mockRejectedValue(new Error('boom'));

    const result = await triggerNewsTask();

    expect(result.success).toBe(false);
    expect(result.error).toBe('boom');
    expect(normalizeErrorDetails(result)).toMatchSnapshot();
  });
});
