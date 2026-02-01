import { parseTime } from '../../src/utils/timeUtils';

describe('timeUtils.parseTime', () => {
  it('parses seconds timestamp', () => {
    const result = parseTime(1704067200);
    expect(result).toBe('2024-01-01T00:00:00.000Z');
  });

  it('parses milliseconds timestamp', () => {
    const result = parseTime(1704067200000);
    expect(result).toBe('2024-01-01T00:00:00.000Z');
  });

  it('parses ISO string', () => {
    const result = parseTime('2024-01-01T00:00:00.000Z');
    expect(result).toBe('2024-01-01T00:00:00.000Z');
  });

  it('parses Date instances', () => {
    const date = new Date('2024-01-01T00:00:00.000Z');
    const result = parseTime(date);
    expect(result).toBe('2024-01-01T00:00:00.000Z');
  });

  it('parses numeric strings and natural language', () => {
    const result = parseTime('1704067200000');
    expect(result).toBe('2024-01-01T00:00:00.000Z');

    const natural = parseTime('tomorrow at noon');
    expect(natural).toContain('T');
  });

  it('throws on invalid input', () => {
    expect(() => parseTime('not a date')).toThrow('时间解析错误');
  });

  it('throws on invalid numeric timestamp', () => {
    expect(() => parseTime(Number.POSITIVE_INFINITY)).toThrow('时间解析错误');
  });

  it('throws on empty input', () => {
    expect(() => parseTime('')).toThrow('时间输入不能为空');
  });
});
