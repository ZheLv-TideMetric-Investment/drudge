import { createNextRequest } from '../helpers/next-request';
import { freezeTime } from '../helpers/fake-time';
import { SchedulerTrigger } from '../../src/types/scheduler';

const highLevelNewsScanner = {
  scanHighLevelNews: jest.fn(),
};

const summaryService = {
  generateSummary: jest.fn(),
};

const initializeServices = jest.fn();

jest.mock('../../src/lib/services/summary', () => ({
  __esModule: true,
  summaryService,
}));

jest.mock('../../src/lib/services/high-level-scanner', () => ({
  __esModule: true,
  highLevelNewsScanner,
}));

jest.mock('../../src/lib/services/init', () => ({
  __esModule: true,
  initializeServices,
}));

describe('api/scheduler', () => {
  beforeEach(() => {
    highLevelNewsScanner.scanHighLevelNews.mockReset();
    summaryService.generateSummary.mockReset();
    initializeServices.mockReset();
  });

  const baseTimestamp = '2024-01-01T00:00:00.000Z';

  const createSchedulerRequest = (trigger: SchedulerTrigger, metadata?: Record<string, unknown>) =>
    createNextRequest('/api/scheduler', {
      method: 'POST',
      body: {
        trigger,
        timestamp: baseTimestamp,
        metadata,
      },
    });

  it('handles simple trigger', async () => {
    const restoreTime = freezeTime('2024-01-01T00:00:00.000Z');
    jest.resetModules();
    const { POST } = await import('../../src/app/api/scheduler/route');

    const request = createSchedulerRequest(SchedulerTrigger.EVERY_MINUTE);

    try {
      const response = await POST(request);
      const body = await response.json();

      expect(body.success).toBe(true);
      expect(body.trigger).toBe(SchedulerTrigger.EVERY_MINUTE);
      expect(body).toMatchSnapshot();
    } finally {
      restoreTime();
    }
  });

  it('handles summary trigger', async () => {
    const restoreTime = freezeTime('2024-01-01T00:00:00.000Z');
    jest.resetModules();
    const { POST } = await import('../../src/app/api/scheduler/route');

    summaryService.generateSummary.mockResolvedValue({
      success: true,
      period: 'period',
      message: 'ok',
    });

    const request = createSchedulerRequest(SchedulerTrigger.DAYTIME_05);

    try {
      const response = await POST(request);
      const body = await response.json();

      expect(body.success).toBe(true);
      expect(summaryService.generateSummary).toHaveBeenCalled();
      expect(body).toMatchSnapshot();
    } finally {
      restoreTime();
    }
  });

  it('handles scan trigger', async () => {
    const restoreTime = freezeTime(baseTimestamp);
    jest.resetModules();
    const { POST } = await import('../../src/app/api/scheduler/route');

    highLevelNewsScanner.scanHighLevelNews.mockResolvedValue({
      success: true,
      found: 2,
      sent: 1,
      period: 'period',
      message: 'ok',
    });

    const request = createSchedulerRequest(SchedulerTrigger.EVERY_5_MINUTES, {
      source: 'test',
    });

    try {
      const response = await POST(request);
      const body = await response.json();

      expect(body.success).toBe(true);
      expect(body.trigger).toBe(SchedulerTrigger.EVERY_5_MINUTES);
      expect(highLevelNewsScanner.scanHighLevelNews).toHaveBeenCalledWith(undefined, undefined, {
        sendNotifications: true,
        skipProcessed: true,
      });
      expect(body.data.found).toBe(2);
      expect(body.data.metadata).toEqual({ source: 'test' });
    } finally {
      restoreTime();
    }
  });

  it('returns error when scan trigger reports failure', async () => {
    const restoreTime = freezeTime(baseTimestamp);
    jest.resetModules();
    const { POST } = await import('../../src/app/api/scheduler/route');

    highLevelNewsScanner.scanHighLevelNews.mockResolvedValue({
      success: false,
      error: 'scan failed',
    });

    const request = createSchedulerRequest(SchedulerTrigger.EVERY_5_MINUTES);

    try {
      const response = await POST(request);
      const body = await response.json();

      expect(response.status).toBe(500);
      expect(body.success).toBe(false);
      expect(body.error).toContain('高级别新闻扫描失败');
    } finally {
      restoreTime();
    }
  });

  it('returns error when scan trigger fails without error message', async () => {
    const restoreTime = freezeTime(baseTimestamp);
    jest.resetModules();
    const { POST } = await import('../../src/app/api/scheduler/route');

    highLevelNewsScanner.scanHighLevelNews.mockResolvedValue({
      success: false,
    });

    const request = createSchedulerRequest(SchedulerTrigger.EVERY_5_MINUTES);

    try {
      const response = await POST(request);
      const body = await response.json();

      expect(response.status).toBe(500);
      expect(body.success).toBe(false);
      expect(body.error).toContain('高级别新闻扫描失败');
    } finally {
      restoreTime();
    }
  });

  it('returns error when scan trigger throws non-error', async () => {
    const restoreTime = freezeTime(baseTimestamp);
    jest.resetModules();
    const { POST } = await import('../../src/app/api/scheduler/route');

    highLevelNewsScanner.scanHighLevelNews.mockRejectedValue('boom');

    const request = createSchedulerRequest(SchedulerTrigger.EVERY_5_MINUTES);

    try {
      const response = await POST(request);
      const body = await response.json();

      expect(response.status).toBe(500);
      expect(body.success).toBe(false);
      expect(body.error).toContain('高级别新闻扫描失败');
    } finally {
      restoreTime();
    }
  });

  it.each([
    SchedulerTrigger.EVERY_30_MINUTES,
    SchedulerTrigger.EVERY_HOUR,
    SchedulerTrigger.EVERY_HOUR_05,
    SchedulerTrigger.DAYTIME,
    SchedulerTrigger.OVERNIGHT,
  ])('handles trigger %s', async trigger => {
    const restoreTime = freezeTime(baseTimestamp);
    jest.resetModules();
    const { POST } = await import('../../src/app/api/scheduler/route');

    try {
      const response = await POST(createSchedulerRequest(trigger, { source: 'test' }));
      const body = await response.json();

      expect(body.success).toBe(true);
      expect(body.trigger).toBe(trigger);
      expect(body.data.metadata).toEqual({ source: 'test' });
    } finally {
      restoreTime();
    }
  });

  it.each([
    SchedulerTrigger.DAYTIME_05,
    SchedulerTrigger.OVERNIGHT_05,
    SchedulerTrigger.WEEKLY_FRIDAY_1605,
  ])('handles summary trigger %s', async trigger => {
    const restoreTime = freezeTime('2024-01-05T08:05:00.000Z');
    jest.resetModules();
    const { POST } = await import('../../src/app/api/scheduler/route');

    summaryService.generateSummary.mockResolvedValue({
      success: true,
      period: 'period',
      message: 'ok',
    });

    try {
      const response = await POST(createSchedulerRequest(trigger));
      const body = await response.json();

      expect(body.success).toBe(true);
      expect(body.trigger).toBe(trigger);
      expect(summaryService.generateSummary).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        true
      );
    } finally {
      restoreTime();
    }
  });

  it('returns error when summary generation fails', async () => {
    const restoreTime = freezeTime('2024-01-01T03:05:00.000Z');
    jest.resetModules();
    const { POST } = await import('../../src/app/api/scheduler/route');

    summaryService.generateSummary.mockRejectedValue(new Error('boom'));

    try {
      const response = await POST(createSchedulerRequest(SchedulerTrigger.DAYTIME_05));
      const body = await response.json();

      expect(response.status).toBe(500);
      expect(body.success).toBe(false);
      expect(body.error).toContain('小时总结生成失败');
    } finally {
      restoreTime();
    }
  });

  it.each([
    [SchedulerTrigger.DAYTIME_05, '小时总结生成失败'],
    [SchedulerTrigger.OVERNIGHT_05, '每日总结生成失败'],
    [SchedulerTrigger.WEEKLY_FRIDAY_1605, '周报生成失败'],
  ])('returns error when summary trigger %s reports a failed result', async (trigger, label) => {
    const restoreTime = freezeTime('2024-01-05T08:05:00.000Z');
    jest.resetModules();
    const { POST } = await import('../../src/app/api/scheduler/route');

    summaryService.generateSummary.mockResolvedValue({
      success: false,
      period: 'period',
      message: '通知未发送',
      error: 'recipient not configured',
    });

    try {
      const response = await POST(createSchedulerRequest(trigger));
      const body = await response.json();

      expect(response.status).toBe(500);
      expect(body.success).toBe(false);
      expect(body.error).toContain(label);
      expect(body.error).toContain('recipient not configured');
    } finally {
      restoreTime();
    }
  });

  it('returns error when daily summary generation fails', async () => {
    const restoreTime = freezeTime('2024-01-01T16:05:00.000Z');
    jest.resetModules();
    const { POST } = await import('../../src/app/api/scheduler/route');

    summaryService.generateSummary.mockRejectedValue(new Error('boom'));

    try {
      const response = await POST(createSchedulerRequest(SchedulerTrigger.OVERNIGHT_05));
      const body = await response.json();

      expect(response.status).toBe(500);
      expect(body.error).toContain('每日总结生成失败');
    } finally {
      restoreTime();
    }
  });

  it('returns error when weekly summary generation fails', async () => {
    const restoreTime = freezeTime('2024-01-05T08:05:00.000Z');
    jest.resetModules();
    const { POST } = await import('../../src/app/api/scheduler/route');

    summaryService.generateSummary.mockRejectedValue(new Error('boom'));

    try {
      const response = await POST(createSchedulerRequest(SchedulerTrigger.WEEKLY_FRIDAY_1605));
      const body = await response.json();

      expect(response.status).toBe(500);
      expect(body.error).toContain('周报生成失败');
    } finally {
      restoreTime();
    }
  });

  it('returns error when summary generation throws non-error', async () => {
    const restoreTime = freezeTime('2024-01-01T03:05:00.000Z');
    jest.resetModules();
    const { POST } = await import('../../src/app/api/scheduler/route');

    summaryService.generateSummary.mockRejectedValue('fail');

    try {
      const response = await POST(createSchedulerRequest(SchedulerTrigger.DAYTIME_05));
      const body = await response.json();

      expect(response.status).toBe(500);
      expect(body.error).toContain('小时总结生成失败');
    } finally {
      restoreTime();
    }
  });

  it('returns error for invalid payload', async () => {
    const restoreTime = freezeTime(baseTimestamp);
    jest.resetModules();
    const { POST } = await import('../../src/app/api/scheduler/route');

    try {
      const request = createNextRequest('/api/scheduler', {
        method: 'POST',
        body: {
          trigger: 'bad_trigger',
          timestamp: baseTimestamp,
        },
      });
      const response = await POST(request);
      const body = await response.json();

      expect(response.status).toBe(500);
      expect(body.success).toBe(false);
      expect(body.trigger).toBe(SchedulerTrigger.EVERY_MINUTE);
    } finally {
      restoreTime();
    }
  });

  it('returns error when init fails', async () => {
    const restoreTime = freezeTime(baseTimestamp);
    jest.resetModules();
    const { POST } = await import('../../src/app/api/scheduler/route');

    initializeServices.mockRejectedValue(new Error('init failed'));

    try {
      const response = await POST(createSchedulerRequest(SchedulerTrigger.EVERY_MINUTE));
      const body = await response.json();

      expect(response.status).toBe(500);
      expect(body.success).toBe(false);
      expect(body.error).toBe('init failed');
    } finally {
      restoreTime();
    }
  });

  it('returns default error when init throws non-error', async () => {
    const restoreTime = freezeTime(baseTimestamp);
    jest.resetModules();
    const { POST } = await import('../../src/app/api/scheduler/route');

    initializeServices.mockRejectedValue('fail');

    try {
      const response = await POST(createSchedulerRequest(SchedulerTrigger.EVERY_MINUTE));
      const body = await response.json();

      expect(response.status).toBe(500);
      expect(body.error).toBe('未知错误');
    } finally {
      restoreTime();
    }
  });

  it('returns error when trigger is unknown', async () => {
    const restoreTime = freezeTime(baseTimestamp);
    jest.resetModules();

    jest.doMock('zod', () => ({
      ...jest.requireActual('zod'),
      z: {
        ...jest.requireActual('zod').z,
        object: () => ({
          parse: () => ({ trigger: 'UNKNOWN', timestamp: baseTimestamp }),
        }),
      },
    }));

    const { POST } = await import('../../src/app/api/scheduler/route');

    try {
      const request = createSchedulerRequest(SchedulerTrigger.EVERY_MINUTE);
      const response = await POST(request);
      const body = await response.json();

      expect(response.status).toBe(500);
      expect(body.error).toContain('未知的触发器类型');
    } finally {
      jest.dontMock('zod');
      jest.resetModules();
      restoreTime();
    }
  });

  it('returns error when overnight summary throws non-error', async () => {
    const restoreTime = freezeTime('2024-01-05T08:05:00.000Z');
    jest.resetModules();
    const { POST } = await import('../../src/app/api/scheduler/route');

    summaryService.generateSummary.mockRejectedValue('fail');

    try {
      const response = await POST(createSchedulerRequest(SchedulerTrigger.OVERNIGHT_05));
      const body = await response.json();

      expect(response.status).toBe(500);
      expect(body.error).toContain('每日总结生成失败');
    } finally {
      restoreTime();
    }
  });

  it('returns error when weekly summary throws non-error', async () => {
    const restoreTime = freezeTime('2024-01-05T08:05:00.000Z');
    jest.resetModules();
    const { POST } = await import('../../src/app/api/scheduler/route');

    summaryService.generateSummary.mockRejectedValue('fail');

    try {
      const response = await POST(createSchedulerRequest(SchedulerTrigger.WEEKLY_FRIDAY_1605));
      const body = await response.json();

      expect(response.status).toBe(500);
      expect(body.error).toContain('周报生成失败');
    } finally {
      restoreTime();
    }
  });

  it('returns status on GET', async () => {
    const restoreTime = freezeTime(baseTimestamp);
    jest.resetModules();
    const { GET } = await import('../../src/app/api/scheduler/route');

    try {
      const response = await GET();
      const body = await response.json();

      expect(body.status).toBe('active');
      expect(body.available_triggers).toContain(SchedulerTrigger.EVERY_MINUTE);
      expect(body.implemented_triggers).toEqual([
        SchedulerTrigger.EVERY_5_MINUTES,
        SchedulerTrigger.DAYTIME_05,
        SchedulerTrigger.OVERNIGHT_05,
        SchedulerTrigger.WEEKLY_FRIDAY_1605,
      ]);
      expect(body.implemented_triggers).not.toContain(SchedulerTrigger.EVERY_MINUTE);
    } finally {
      restoreTime();
    }
  });

  it('returns error status when GET init fails', async () => {
    const restoreTime = freezeTime(baseTimestamp);
    jest.resetModules();
    const { GET } = await import('../../src/app/api/scheduler/route');

    initializeServices.mockRejectedValue(new Error('init failed'));

    try {
      const response = await GET();
      const body = await response.json();

      expect(response.status).toBe(500);
      expect(body.error).toBe('init failed');
    } finally {
      restoreTime();
    }
  });

  it('returns default error when GET init fails with non-error', async () => {
    const restoreTime = freezeTime(baseTimestamp);
    jest.resetModules();
    const { GET } = await import('../../src/app/api/scheduler/route');

    initializeServices.mockRejectedValue('fail');

    try {
      const response = await GET();
      const body = await response.json();

      expect(response.status).toBe(500);
      expect(body.error).toBe('获取状态失败');
    } finally {
      restoreTime();
    }
  });
});
