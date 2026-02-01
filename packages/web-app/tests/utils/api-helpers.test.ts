import { freezeTime } from '../helpers/fake-time';
import { createNextRequest } from '../helpers/next-request';
import { TimeZoneUtils } from '../../src/lib/utils/timezone';
import {
  buildErrorResponse,
  buildPaginationResponse,
  buildSuccessResponse,
  buildTimeRangePreset,
  buildTimezoneAwareQuery,
  parsePaginationParams,
  parseTimeParams,
  validateTimeRange,
  withTimeHandling
} from '../../src/lib/utils/api-helpers';

describe('api-helpers', () => {
  it('parses pagination params with boundaries', () => {
    const params = new URLSearchParams({ page: '0', limit: '500' });
    const result = parsePaginationParams(params);

    expect(result).toEqual({ page: 1, limit: 100, offset: 0 });

    const paramsNext = new URLSearchParams({ page: '3', limit: '10' });
    const resultNext = parsePaginationParams(paramsNext);

    expect(resultNext).toEqual({ page: 3, limit: 10, offset: 20 });
  });

  it('validates time range rules', () => {
    expect(validateTimeRange()).toEqual({ isValid: true });
    expect(validateTimeRange('bad-time', undefined)).toEqual({
      isValid: false,
      error: '开始时间格式无效'
    });
    expect(validateTimeRange(undefined, 'bad-time')).toEqual({
      isValid: false,
      error: '结束时间格式无效'
    });
    expect(validateTimeRange('2024-01-01', '2024-01-02')).toEqual({ isValid: true });

    expect(validateTimeRange('2024-01-02', '2024-01-01')).toEqual({
      isValid: false,
      error: '开始时间不能晚于结束时间'
    });

    expect(validateTimeRange('2024-01-01', '2024-04-15', 30)).toEqual({
      isValid: false,
      error: '时间范围不能超过30天'
    });
  });

  it('parses time params and builds timezone-aware queries', () => {
    const params = new URLSearchParams({ startTime: '2024-01-01', endTime: '2024-01-02' });
    expect(parseTimeParams(params)).toEqual({ startTime: '2024-01-01', endTime: '2024-01-02' });

    const toUTCSpy = jest.spyOn(TimeZoneUtils, 'toUTC').mockReturnValue('converted');
    const result = buildTimezoneAwareQuery({ startTime: '2024-01-01' });
    expect(result.startTime).toBe('converted');
    toUTCSpy.mockRestore();

    const toUTCFailSpy = jest.spyOn(TimeZoneUtils, 'toUTC').mockImplementation(() => {
      throw new Error('bad');
    });
    const fallbackResult = buildTimezoneAwareQuery({ startTime: 'bad-time' });
    expect(fallbackResult.startTime).toBe('bad-time');
    toUTCFailSpy.mockRestore();
  });

  it('builds pagination and error responses', async () => {
    const restoreTime = freezeTime('2024-01-01T00:00:00.000Z');
    try {
      const pagination = buildPaginationResponse([{ id: '1' }], 1, 1, 10);
      expect(pagination.pagination.totalPages).toBe(1);

      const response = buildErrorResponse('boom', 400);
      const body = await response.json();
      expect(body.success).toBe(false);
      expect(body.error).toBe('boom');
    } finally {
      restoreTime();
    }
  });

  it('wraps handlers with time validation', async () => {
    const handler = withTimeHandling(async (_request) => buildSuccessResponse({ ok: true }));
    const request = createNextRequest('/api/news', { query: { startTime: 'bad' } });

    const response = await handler(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.success).toBe(false);
  });

  it('validates time range when start time is missing', async () => {
    const handler = withTimeHandling(async (_request) => buildSuccessResponse({ ok: true }));
    const request = createNextRequest('/api/news', { query: { endTime: '2024-01-01' } });

    const response = await handler(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
  });

  it('skips time validation when disabled', async () => {
    const handler = withTimeHandling(async (_request) => buildSuccessResponse({ ok: true }), {
      parseTimeParams: false,
      validateTimeRange: false
    });
    const request = createNextRequest('/api/news', { query: { startTime: 'bad' } });

    const response = await handler(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
  });

  it('handles time params without validation', async () => {
    const handler = withTimeHandling(async (_request) => buildSuccessResponse({ ok: true }), {
      parseTimeParams: true,
      validateTimeRange: false
    });
    const request = createNextRequest('/api/news', { query: { startTime: 'bad' } });

    const response = await handler(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
  });

  it('returns error response when handler throws', async () => {
    const handler = withTimeHandling(
      async (_request): Promise<ReturnType<typeof buildSuccessResponse>> => {
      throw new Error('boom');
      }
    );

    const request = createNextRequest('/api/news', { query: { startTime: '2024-01-01' } });
    const response = await handler(request);
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe('boom');
  });

  it('builds time range presets', () => {
    expect(buildTimeRangePreset('today')).toHaveProperty('startTime');
    expect(buildTimeRangePreset('yesterday')).toHaveProperty('endTime');
    expect(buildTimeRangePreset('week')).toHaveProperty('startTime');
    expect(buildTimeRangePreset('month')).toHaveProperty('endTime');
    expect(buildTimeRangePreset('custom', '2024-01-01', '2024-01-02')).toEqual({
      startTime: TimeZoneUtils.toUTC('2024-01-01'),
      endTime: TimeZoneUtils.toUTC('2024-01-02')
    });
    expect(() => buildTimeRangePreset('custom')).toThrow('自定义时间范围需要提供开始和结束时间');
    expect(() => buildTimeRangePreset('invalid' as any)).toThrow('不支持的时间预设');
  });

  it('builds success response with formatted times', async () => {
    const restoreTime = freezeTime('2024-01-01T00:00:00.000Z');
    try {
      const response = buildSuccessResponse({
        id: 'news_1',
        timestamp: '2024-01-01T00:00:00.000Z',
        processedAt: '2024-01-02T00:00:00.000Z'
      });

      const body = await response.json();

      expect(body.success).toBe(true);
      expect(body.timezone).toBe('Asia/Shanghai');
      expect(body.timestamp).toBe('2024-01-01 08:00:00');
      expect(body.data).toMatchObject({
        timestamp_display: '2024-01-01 08:00:00',
        processed_at_display: '2024-01-02 08:00:00'
      });
    } finally {
      restoreTime();
    }
  });
});
