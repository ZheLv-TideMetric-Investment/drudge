import dayjs from 'dayjs';
import { TimeZoneUtils } from '../../src/lib/utils/timezone';
import { freezeTime } from '../helpers/fake-time';

describe('TimeZoneUtils', () => {
  it('converts Beijing time to UTC', () => {
    const beijingDate = TimeZoneUtils.toBeijing('2024-01-01T00:00:00.000Z');
    const utcTime = TimeZoneUtils.toUTC(beijingDate);

    expect(utcTime).toBe('2024-01-01T00:00:00.000Z');
  });

  it('throws when converting missing time', () => {
    expect(() => TimeZoneUtils.toUTC('' as any)).toThrow('时间参数不能为空');
    expect(() => TimeZoneUtils.toBeijing('' as any)).toThrow('时间参数不能为空');
  });

  it('converts UTC time to Beijing', () => {
    const beijingTime = TimeZoneUtils.toBeijing('2024-01-01T00:00:00.000Z');

    expect(TimeZoneUtils.formatBeijingTime(beijingTime)).toBe('2024-01-01 08:00:00');
  });

  it('converts Date inputs and preserves UTC timestamps', () => {
    const utcFromDate = TimeZoneUtils.toUTC(new Date('2024-01-01T00:00:00.000Z'));
    expect(utcFromDate).toBe('2024-01-01T00:00:00.000Z');

    const tzDate = TimeZoneUtils.toBeijing('2024-01-01T00:00:00.000Z');
    const beijingDate = TimeZoneUtils.toBeijing(tzDate);
    expect(TimeZoneUtils.formatBeijingTime(beijingDate)).toBe('2024-01-01 08:00:00');
  });

  it('handles dayjs and numeric inputs', () => {
    const dayjsValue = dayjs('2024-01-01T00:00:00.000Z');
    expect(TimeZoneUtils.formatBeijingTime(dayjsValue)).toBe('2024-01-01 08:00:00');
    expect(TimeZoneUtils.toBeijing(dayjsValue).toISOString()).toBe('2024-01-01T00:00:00.000Z');

    expect(TimeZoneUtils.toUTC(1704067200000)).toBe('2024-01-01T00:00:00.000Z');
    expect(TimeZoneUtils.toUTC('1704067200000')).toBe('2024-01-01T00:00:00.000Z');
    expect(TimeZoneUtils.toBeijing(1704067200000).toISOString()).toBe(
      '2024-01-01T00:00:00.000Z'
    );
    expect(TimeZoneUtils.toBeijing('1704067200000').toISOString()).toBe(
      '2024-01-01T00:00:00.000Z'
    );

    expect(TimeZoneUtils.formatBeijingTime(Number.POSITIVE_INFINITY as any)).toBe('Invalid date');
    expect(() => TimeZoneUtils.toBeijing(Number.POSITIVE_INFINITY)).toThrow('无效的时间格式');
  });

  it('formats time fields for objects and arrays', () => {
    const single = TimeZoneUtils.formatTimeFields(
      { timestamp: '2024-01-01T00:00:00.000Z', processedAt: null },
      ['timestamp', 'processedAt']
    );

    expect(single).toMatchObject({
      timestamp_display: '2024-01-01 08:00:00'
    });

    const list = TimeZoneUtils.formatTimeFields(
      [{ timestamp: '2024-01-02T00:00:00.000Z' }],
      ['timestamp']
    );

    expect(Array.isArray(list)).toBe(true);
    expect((list as Array<Record<string, string>>)[0].timestamp_display).toBe('2024-01-02 08:00:00');
  });

  it('returns empty format when time is missing', () => {
    expect(TimeZoneUtils.formatBeijingTime(undefined as any)).toBe('');
  });

  it('handles empty and invalid timezone strings', () => {
    expect(() => TimeZoneUtils.toBeijing('   ' as any)).toThrow('时间参数不能为空');
    expect(TimeZoneUtils.formatBeijingTime('   ' as any)).toBe('Invalid date');
    expect(TimeZoneUtils.formatBeijingTime('2024-01-99T00:00:00Z')).toBe('Invalid date');
    expect(() => TimeZoneUtils.toBeijing('2024-01-99 00:00:00' as any)).toThrow('无效的时间格式');
  });

  it('parses beijing date strings with optional seconds and milliseconds', () => {
    expect(TimeZoneUtils.toUTC('2024-01-01 08:00')).toBe('2024-01-01T00:00:00.000Z');
    expect(TimeZoneUtils.toUTC('2024-01-01 08:00:00.123')).toBe('2024-01-01T00:00:00.123Z');
  });

  it('normalizes hour 24 when formatting', () => {
    const original = Intl.DateTimeFormat;
    const formatToParts = jest.fn().mockReturnValue([
      { type: 'year', value: '2024' },
      { type: 'month', value: '01' },
      { type: 'day', value: '02' },
      { type: 'hour', value: '24' },
      { type: 'minute', value: '05' },
      { type: 'second', value: '06' }
    ]);

    (Intl as any).DateTimeFormat = jest.fn().mockImplementation(() => ({ formatToParts }));

    const result = TimeZoneUtils.formatBeijingTime('2024-01-01T00:00:00.000Z', 'HH:mm:ss');
    expect(result).toBe('00:05:06');

    (Intl as any).DateTimeFormat = original;
  });

  it('builds ranges and validates time', () => {
    const restoreTime = freezeTime('2024-01-01T00:00:00.000Z');
    try {
      const range = TimeZoneUtils.buildTimeRange('2024-01-01', '2024-01-02');
      expect(range.startTime).toBeDefined();
      expect(range.endTime).toBeDefined();

      const startOnly = TimeZoneUtils.buildTimeRange('2024-01-01');
      expect(startOnly.startTime).toBeDefined();
      expect(startOnly.endTime).toBeUndefined();

      const endOnly = TimeZoneUtils.buildTimeRange(undefined, '2024-01-02');
      expect(endOnly.startTime).toBeUndefined();
      expect(endOnly.endTime).toBeDefined();

      const todayRange = TimeZoneUtils.getTodayRange();
      expect(todayRange.startTime).toBeDefined();

      const recentRange = TimeZoneUtils.getRecentDaysRange(3);
      expect(recentRange.endTime).toBeDefined();

      const hourRange = TimeZoneUtils.getCurrentHourRange();
      expect(hourRange.startTime).toBeDefined();

      expect(TimeZoneUtils.nowUTC()).toContain('2024-01-01T00:00:00.000Z');
      expect(TimeZoneUtils.isValidTime('2024-01-01')).toBe(true);
      expect(TimeZoneUtils.isValidTime('bad-time')).toBe(false);
      expect(TimeZoneUtils.diff('2024-01-01T00:00:00.000Z', '2024-01-01T01:00:00.000Z', 'hours')).toBe(1);
      expect(TimeZoneUtils.diff('2024-01-01T00:00:00.000Z', '2024-01-01T00:00:01.000Z')).toBe(1000);
      expect(
        TimeZoneUtils.diff('2024-01-01T00:00:00.000Z', '2024-01-01T00:00:30.000Z', 'seconds')
      ).toBe(30);
      expect(
        TimeZoneUtils.diff('2024-01-01T00:00:00.000Z', '2024-01-01T00:01:00.000Z', 'minutes')
      ).toBe(1);
    } finally {
      restoreTime();
    }
  });

  it('returns current beijing time', () => {
    const now = TimeZoneUtils.nowBeijing();
    expect(now).toBeInstanceOf(Date);
  });

  it('formats relative and news times', () => {
    const restoreTime = freezeTime('2024-01-01T00:00:00.000Z');

    try {
      expect(TimeZoneUtils.formatRelative('2024-01-01T00:00:00.000Z')).toBe('刚刚');
      expect(TimeZoneUtils.formatRelative('2023-12-31T23:30:00.000Z')).toBe('30分钟前');
      expect(TimeZoneUtils.formatRelative('2023-12-31T21:00:00.000Z')).toBe('3小时前');
      expect(TimeZoneUtils.formatRelative('2023-12-30T00:00:00.000Z')).toBe('2天前');
      expect(TimeZoneUtils.formatRelative('2023-12-01T00:00:00.000Z')).toBe('12-01 08:00');

      expect(TimeZoneUtils.formatNewsTime('2024-01-01T00:00:00.000Z')).toBe('今天 08:00');
      expect(TimeZoneUtils.formatNewsTime('2023-12-31T00:00:00.000Z')).toBe('昨天 08:00');
      expect(TimeZoneUtils.formatNewsTime('2023-12-20T00:00:00.000Z')).toBe('12-20 08:00');
    } finally {
      restoreTime();
    }
  });

  it('formats smart and range outputs', () => {
    const restoreTime = freezeTime('2024-01-08T00:00:00.000Z');

    try {
      expect(TimeZoneUtils.formatSmart('2024-01-07T23:00:00.000Z')).toBe('1小时前');
      expect(TimeZoneUtils.formatSmart('2024-01-05T00:00:00.000Z')).toBe('3天前');
      expect(TimeZoneUtils.formatSmart('2023-12-20T00:00:00.000Z')).toBe('2023-12-20');

      expect(
        TimeZoneUtils.formatTimeRange('2024-01-08T00:00:00.000Z', '2024-01-08T01:00:00.000Z')
      ).toBe('2024-01-08 08:00-09:00');

      expect(
        TimeZoneUtils.formatTimeRange('2024-01-07T00:00:00.000Z', '2024-01-08T00:00:00.000Z')
      ).toBe('2024-01-07 08:00:00 ~ 2024-01-08 08:00:00');
    } finally {
      restoreTime();
    }
  });

  it('handles utility helpers and friendly text', () => {
    const restoreTime = freezeTime('2024-01-01T00:00:00.000Z');

    try {
      expect(TimeZoneUtils.isToday('2024-01-01T00:00:00.000Z')).toBe(true);
      expect(TimeZoneUtils.isYesterday('2023-12-31T00:00:00.000Z')).toBe(true);
      expect(TimeZoneUtils.getHour('2024-01-01T05:00:00.000Z')).toBe(13);

      const dayjsValue = TimeZoneUtils.toAntdValue('2024-01-01T00:00:00.000Z');
      expect(dayjsValue).not.toBeNull();
      expect(typeof dayjsValue?.format).toBe('function');
      expect(TimeZoneUtils.fromAntdValue(dayjsValue)).toBe('2024-01-01T00:00:00.000Z');

      const formattedArray = TimeZoneUtils.formatDataArray(
        [{ id: 'n1', timestamp: '2024-01-01T00:00:00.000Z' }],
        ['timestamp']
      );
      expect(formattedArray[0]).toMatchObject({ timestamp_display: '2024-01-01 08:00:00' });

      const friendly = TimeZoneUtils.getFriendlyText('2024-01-01T00:00:00.000Z');
      expect(friendly).toContain('2024年01月01日');
      expect(friendly).toContain('(刚刚)');

      const beijingNow = TimeZoneUtils.toBeijingDayjs(null as any);
      expect(typeof beijingNow.format).toBe('function');
      expect(TimeZoneUtils.toBeijingDayjs(dayjsValue as any).isValid()).toBe(true);

      expect(TimeZoneUtils.now()).toContain('2024-01-01');
    } finally {
      restoreTime();
    }
  });

  it('returns empty strings for falsy inputs', () => {
    expect(TimeZoneUtils.format(null as any)).toBe('');
    expect(TimeZoneUtils.formatRelative(undefined as any)).toBe('');
    expect(TimeZoneUtils.formatNewsTime(null as any)).toBe('');
    expect(TimeZoneUtils.formatSmart(undefined as any)).toBe('');
    expect(TimeZoneUtils.formatTimeRange(null as any, '2024-01-01T00:00:00.000Z')).toBe('');
    expect(TimeZoneUtils.isToday(null as any)).toBe(false);
    expect(TimeZoneUtils.isYesterday(undefined as any)).toBe(false);
    expect(TimeZoneUtils.getHour(undefined as any)).toBe(0);
    expect(TimeZoneUtils.toAntdValue(undefined)).toBeNull();
    expect(TimeZoneUtils.getFriendlyText(undefined as any)).toBe('');
  });

  it('handles formatting errors gracefully', () => {
    const formatSpy = jest
      .spyOn(TimeZoneUtils, 'formatBeijingTime')
      .mockImplementation(() => {
        throw new Error('boom');
      });

    expect(TimeZoneUtils.format('bad-time')).toBe('bad-time');
    formatSpy.mockRestore();

    const toBeijingSpy = jest
      .spyOn(TimeZoneUtils, 'toBeijingDayjs')
      .mockImplementation(() => {
        throw new Error('bad');
      });

    expect(TimeZoneUtils.formatRelative('bad-time')).toBe('bad-time');
    expect(TimeZoneUtils.formatNewsTime('bad-time')).toBe('bad-time');
    expect(TimeZoneUtils.formatSmart('bad-time')).toBe('bad-time');
    expect(TimeZoneUtils.formatTimeRange('bad-start', 'bad-end')).toBe('bad-start ~ bad-end');

    toBeijingSpy.mockRestore();
  });

  it('handles invalid inputs for helper conversions', () => {
    const toBeijingSpy = jest
      .spyOn(TimeZoneUtils, 'toBeijingDayjs')
      .mockImplementation(() => {
        throw new Error('bad');
      });

    expect(TimeZoneUtils.toAntdValue('bad-time')).toBeNull();
    expect(TimeZoneUtils.isToday('bad-time')).toBe(false);
    expect(TimeZoneUtils.isYesterday('bad-time')).toBe(false);
    expect(TimeZoneUtils.getHour('bad-time')).toBe(0);

    toBeijingSpy.mockRestore();

    const badDayjs = { tz: () => { throw new Error('boom'); } } as any;
    expect(TimeZoneUtils.fromAntdValue(null)).toBeUndefined();
    expect(TimeZoneUtils.fromAntdValue(badDayjs)).toBeUndefined();
  });
});
