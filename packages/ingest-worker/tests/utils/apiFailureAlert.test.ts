import { ApiFailureAlertTracker } from '../../src/utils/apiFailureAlert';

describe('ApiFailureAlertTracker', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2024-01-01T00:00:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('recognizes Axios timeout errors only', () => {
    const tracker = new ApiFailureAlertTracker('test');

    expect(
      tracker.isTimeoutError(
        Object.assign(new Error('timeout of 10000ms exceeded'), {
          code: 'ECONNABORTED',
        })
      )
    ).toBe(true);
    expect(tracker.isTimeoutError(Object.assign(new Error('timeout'), { code: 'ETIMEDOUT' }))).toBe(
      false
    );
    expect(tracker.isTimeoutError(new Error('timeout'))).toBe(false);
  });

  it('alerts at the threshold and suppresses duplicates inside the window', () => {
    const tracker = new ApiFailureAlertTracker('test', 3, 1000);

    expect(tracker.shouldNotifyTimeout('first')).toBe(false);
    expect(tracker.shouldNotifyTimeout('second')).toBe(false);
    expect(tracker.shouldNotifyTimeout('third')).toBe(true);
    expect(tracker.shouldNotifyTimeout('fourth')).toBe(false);

    jest.advanceTimersByTime(1000);
    expect(tracker.shouldNotifyTimeout('after-window')).toBe(true);
  });

  it('resets the consecutive timeout count after a success', () => {
    const tracker = new ApiFailureAlertTracker('test', 3, 5000);

    expect(tracker.shouldNotifyTimeout('first')).toBe(false);
    expect(tracker.shouldNotifyTimeout('second')).toBe(false);
    tracker.recordSuccess();
    expect(tracker.shouldNotifyTimeout('after-success')).toBe(false);
  });
});
