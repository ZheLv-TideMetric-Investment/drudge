import { buildSummaryParams, buildSummaryRange } from '../../src/lib/utils/summary-request';

describe('summary request ranges', () => {
  it('selects the previous complete Beijing hour across a year boundary', () => {
    const range = buildSummaryRange('previous-hour', new Date('2024-12-31T16:05:00Z'));
    expect(range).toEqual({ start: '2024-12-31T23:00', end: '2025-01-01T00:00' });
    expect(Object.fromEntries(buildSummaryParams(range, false))).toEqual({
      startTime: '2024-12-31T15:00:00.000Z',
      endTime: '2024-12-31T16:00:00.000Z',
      sendNotification: 'false',
    });
  });

  it('uses Beijing midnight for today and a rolling day for the last 24 hours', () => {
    const now = new Date('2025-01-01T01:23:00Z');
    expect(buildSummaryRange('today', now)).toEqual({
      start: '2025-01-01T00:00',
      end: '2025-01-01T09:23',
    });
    expect(buildSummaryRange('last-day', now)).toEqual({
      start: '2024-12-31T09:23',
      end: '2025-01-01T09:23',
    });
  });

  it('sends notifications only when selected', () => {
    const range = { start: '2025-01-01T08:00', end: '2025-01-01T09:00' };
    expect(buildSummaryParams(range, false).get('sendNotification')).toBe('false');
    expect(buildSummaryParams(range, true).get('sendNotification')).toBe('true');
  });

  it.each([
    { start: '', end: '2025-01-01T09:00' },
    { start: 'invalid', end: '2025-01-01T09:00' },
    { start: '2025-01-01T09:00', end: '2025-01-01T08:00' },
    { start: '2025-01-01T09:00', end: '2025-01-01T09:00' },
  ])('rejects incomplete or invalid ranges: %j', range => {
    expect(() => buildSummaryParams(range, false)).toThrow();
  });
});
