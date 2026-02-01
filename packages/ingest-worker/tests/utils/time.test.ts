import { freezeTime } from '../helpers/fake-time';
import { formatISO, getTimestamp, parseTime } from '../../src/utils/time';

describe('parseTime', () => {
  it('parses seconds and milliseconds consistently', () => {
    const seconds = 1704067200;
    const millis = 1704067200000;

    expect(parseTime(seconds).valueOf()).toBe(millis);
    expect(parseTime(millis).valueOf()).toBe(millis);
  });

  it('parses numeric strings and Date values', () => {
    const millis = 1704067200000;
    const date = new Date('2024-01-01T00:00:00.000Z');

    expect(parseTime(String(millis)).valueOf()).toBe(millis);
    expect(parseTime(date).valueOf()).toBe(millis);
  });

  it('returns timezone-aware instance', () => {
    const result = parseTime('2024-01-01T00:00:00.000Z');
    expect(result.format('Z')).toBe('+08:00');
  });

  it('formatISO uses provided time or current time', () => {
    const restoreTime = freezeTime('2024-01-01T00:00:00.000Z');
    try {
      const explicit = parseTime('2024-01-02T00:00:00.000Z');

      expect(formatISO(explicit)).toBe(explicit.toISOString());
      expect(formatISO()).toBe(parseTime(Date.now()).toISOString());
    } finally {
      restoreTime();
    }
  });

  it('getTimestamp uses provided time or current time', () => {
    const restoreTime = freezeTime('2024-01-01T00:00:00.000Z');
    try {
      const explicit = parseTime('2024-01-02T00:00:00.000Z');

      expect(getTimestamp(explicit)).toBe(explicit.unix());
      expect(getTimestamp()).toBe(parseTime(Date.now()).unix());
    } finally {
      restoreTime();
    }
  });
});
